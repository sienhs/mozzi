package com.ssafy.mozzi.domain.search.service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.stream.Collectors;
import jakarta.annotation.PreDestroy;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import com.ssafy.mozzi.domain.diary.dto.DiaryDetailResponseDto;
import com.ssafy.mozzi.domain.diary.dto.DiarySummaryResponseDto;
import com.ssafy.mozzi.domain.diary.entity.Activity;
import com.ssafy.mozzi.domain.diary.entity.ActivityCode;
import com.ssafy.mozzi.domain.diary.entity.Emotion;
import com.ssafy.mozzi.domain.diary.repository.ActivityRepository;
import com.ssafy.mozzi.domain.diary.service.DiaryService;
import com.ssafy.mozzi.domain.image.entity.ImageStatus;
import com.ssafy.mozzi.domain.search.dto.EmotionSearchResponseDto;
import com.ssafy.mozzi.domain.search.dto.EmotionSearchResponseDto.InterpretedFilter;
import com.ssafy.mozzi.domain.search.dto.EmotionSearchResponseDto.Stats;
import com.ssafy.mozzi.domain.search.dto.EmotionSearchSuggestionsResponseDto;
import com.ssafy.mozzi.domain.search.entity.EmotionSearch;
import com.ssafy.mozzi.domain.search.entity.EmotionSearchResult;
import com.ssafy.mozzi.domain.search.entity.SearchResultType;
import com.ssafy.mozzi.domain.search.exception.SearchErrorCode;
import com.ssafy.mozzi.domain.search.repository.EmotionSearchRepository;
import com.ssafy.mozzi.domain.search.repository.EmotionSearchResultRepository;
import com.ssafy.mozzi.domain.search.repository.SearchCriteria;
import com.ssafy.mozzi.domain.search.repository.SearchDiaryQuery;
import com.ssafy.mozzi.domain.search.repository.SearchDiaryQuery.ActivityCount;
import com.ssafy.mozzi.domain.search.repository.SearchDiaryQuery.Candidate;
import com.ssafy.mozzi.domain.search.repository.SearchDiaryQuery.EmotionCount;
import com.ssafy.mozzi.domain.search.service.QuestionInterpreter.Intent;
import com.ssafy.mozzi.domain.search.service.QuestionInterpreter.Interpretation;
import com.ssafy.mozzi.global.exception.BusinessException;
import com.ssafy.mozzi.global.exception.CommonErrorCode;
import com.ssafy.mozzi.integration.gms.GmsEmbeddingClient;
import com.ssafy.mozzi.integration.gms.GmsProperties;
import com.ssafy.mozzi.integration.gms.GmsUnavailableException;

import tools.jackson.databind.ObjectMapper;

/**
 * Emotion search (API spec emotion-search.md): the question is read into conditions (①),
 * diaries are found by SQL and ranked by meaning (②), the week is read (③), and the model
 * answers from those alone (④).
 *
 * <p>No transaction is held across a GMS call: each read runs on its own, and the question
 * and its result rows are written together at the end.
 *
 * <p>The question's embedding is requested at the same time as ①, since it needs nothing
 * but the question. That keeps three GMS calls within two calls' time and the 10 seconds
 * the spec allows.
 */
@Service
public class EmotionSearchService {

    private static final Logger log = LoggerFactory.getLogger(EmotionSearchService.class);

    /** Spec: "분당 10회 초과" answers 429. */
    static final int PER_MINUTE = 10;

    /** Diaries handed to the answer; about 50 tokens each. */
    static final int CANDIDATE_LIMIT = 20;

    static final int TOP_ACTIVITIES = 3;

    /** S-01. Fixed for now (spec). */
    static final List<String> SUGGESTIONS = List.of(
            "마음이 편했던 날을 보여 줘",
            "가족과 보낸 날은 언제였어?",
            "이번 달엔 어떤 기분이 많았어?");

    private final QuestionInterpreter questionInterpreter;
    private final AnswerWriter answerWriter;
    private final WeeklyContextReader weeklyContextReader;
    private final SearchDiaryQuery searchDiaryQuery;
    private final EmotionSearchRepository emotionSearchRepository;
    private final EmotionSearchResultRepository emotionSearchResultRepository;
    private final ActivityRepository activityRepository;
    private final DiaryService diaryService;
    private final GmsEmbeddingClient embeddingClient;
    private final GmsProperties gmsProperties;
    private final SearchProperties searchProperties;
    private final ObjectMapper objectMapper;
    private final TransactionTemplate transactionTemplate;
    private final Clock clock;

    /**
     * Kept inside this class rather than declared as a bean: an {@code Executor} bean would
     * switch off Boot's default task executor, and with it the executor any later
     * {@code @Async} expects. Calls are bounded by the GMS read timeout, so four threads
     * cover the per-member limit many times over.
     */
    private final ExecutorService embeddingExecutor = Executors.newFixedThreadPool(4, runnable -> {
        Thread thread = new Thread(runnable, "emotion-search-embedding");
        thread.setDaemon(true);
        return thread;
    });

    public EmotionSearchService(
            QuestionInterpreter questionInterpreter,
            AnswerWriter answerWriter,
            WeeklyContextReader weeklyContextReader,
            SearchDiaryQuery searchDiaryQuery,
            EmotionSearchRepository emotionSearchRepository,
            EmotionSearchResultRepository emotionSearchResultRepository,
            ActivityRepository activityRepository,
            DiaryService diaryService,
            GmsEmbeddingClient embeddingClient,
            GmsProperties gmsProperties,
            SearchProperties searchProperties,
            ObjectMapper objectMapper,
            PlatformTransactionManager transactionManager,
            Clock clock) {
        this.questionInterpreter = questionInterpreter;
        this.answerWriter = answerWriter;
        this.weeklyContextReader = weeklyContextReader;
        this.searchDiaryQuery = searchDiaryQuery;
        this.emotionSearchRepository = emotionSearchRepository;
        this.emotionSearchResultRepository = emotionSearchResultRepository;
        this.activityRepository = activityRepository;
        this.diaryService = diaryService;
        this.embeddingClient = embeddingClient;
        this.gmsProperties = gmsProperties;
        this.searchProperties = searchProperties;
        this.objectMapper = objectMapper;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
        this.clock = clock;
    }

    @PreDestroy
    void shutdown() {
        embeddingExecutor.shutdownNow();
    }

    public EmotionSearchSuggestionsResponseDto suggestions() {
        return new EmotionSearchSuggestionsResponseDto(SUGGESTIONS);
    }

    /**
     * @throws BusinessException {@code 429 RATE_LIMITED} past {@value #PER_MINUTE} questions a
     *                           minute; {@code 503 SEARCH_UNAVAILABLE} when GMS gave no
     *                           usable answer — the question is still stored as
     *                           {@code FAILED}
     */
    public EmotionSearchResponseDto search(Long memberId, String rawQuestion) {
        String question = rawQuestion.strip();
        checkRateLimit(memberId);
        long started = System.nanoTime();
        long deadline = started + searchProperties.timeBudget().toNanos();
        LocalDate today = LocalDate.now(clock);
        Map<ActivityCode, String> labels = activityLabels();

        CompletableFuture<float[]> queryVector =
                CompletableFuture.supplyAsync(() -> embeddingClient.embed(question), embeddingExecutor);
        SearchCriteria criteria = null;
        try {
            Interpretation interpretation = questionInterpreter.interpret(question, today, labels);
            criteria = interpretation.criteria();
            boolean statsQuestion = interpretation.intent() == Intent.STATS;
            // A count over a keyword ("칭찬받은 날은 몇 번이야?") cannot be counted by SQL: only
            // the model can tell which diaries are about the keyword, so it goes through the
            // same pick as a list and is counted from what was picked.
            Outcome outcome = statsQuestion && criteria.keyword() == null
                    ? stats(memberId, question, today, criteria, labels, deadline)
                    : list(memberId, question, today, criteria, statsQuestion, queryVector, labels, deadline);
            requireTime(deadline, "answer");
            return finish(memberId, question, criteria, outcome, started, deadline);
        } catch (GmsUnavailableException e) {
            record(memberId, question, criteria, SearchResultType.FAILED, null, started);
            throw new BusinessException(SearchErrorCode.SEARCH_UNAVAILABLE, "emotion search failed: " + e.getMessage(), e);
        } finally {
            queryVector.cancel(false);
        }
    }

    /** What the answer is, before it is stored and the diaries are rendered. */
    private record Outcome(SearchResultType type, String answer, Stats stats, List<Long> diaryIds) {

        static Outcome empty() {
            return new Outcome(SearchResultType.EMPTY, null, new Stats(0, List.of(), null), List.of());
        }

    }

    private Outcome stats(Long memberId, String question, LocalDate today, SearchCriteria criteria,
            Map<ActivityCode, String> labels, long deadline) {
        List<EmotionCount> emotionCounts = searchDiaryQuery.emotionCounts(memberId, criteria);
        long matched = emotionCounts.stream().mapToLong(EmotionCount::count).sum();
        if (matched == 0) {
            return Outcome.empty();
        }
        List<ActivityCount> topActivities = searchDiaryQuery.topActivities(memberId, criteria, TOP_ACTIVITIES);
        WeeklyContext weekly = weeklyContextReader.read(memberId, today);
        requireTime(deadline, "reading diaries");
        AnswerWriter.Answer answer = answerWriter.write(new AnswerWriter.Material(
                question, today, criteria, List.of(), matched, topActivities, emotionCounts, false, weekly), labels);
        return new Outcome(SearchResultType.STATS_ONLY, answer.answer(),
                new Stats(matched, activityDtos(topActivities), emotionDtos(emotionCounts)), List.of());
    }

    /**
     * Without a keyword the conditions are the whole question: every candidate is a match and
     * the counts come from SQL. With one, candidates are only ranked by meaning, so the model
     * picks the ones the question is about and the counts follow its pick.
     *
     * @param statsQuestion a count over a keyword: answered as {@code STATS_ONLY}, counted
     *                      from the pick, which covers at most {@value #CANDIDATE_LIMIT}
     *                      diaries
     */
    private Outcome list(Long memberId, String question, LocalDate today, SearchCriteria criteria,
            boolean statsQuestion, CompletableFuture<float[]> queryVector, Map<ActivityCode, String> labels,
            long deadline) {
        boolean pickRelevant = criteria.keyword() != null;
        float[] vector = pickRelevant ? vectorOrNull(queryVector, deadline) : null;
        List<Candidate> candidates = searchDiaryQuery.candidates(
                memberId, criteria, vector, gmsProperties.embeddingModelId(), CANDIDATE_LIMIT);
        if (candidates.isEmpty()) {
            return Outcome.empty();
        }

        long matched;
        List<ActivityCount> topActivities;
        if (pickRelevant) {
            matched = candidates.size();
            topActivities = List.of();
        } else {
            matched = searchDiaryQuery.emotionCounts(memberId, criteria).stream()
                    .mapToLong(EmotionCount::count).sum();
            topActivities = searchDiaryQuery.topActivities(memberId, criteria, TOP_ACTIVITIES);
        }
        WeeklyContext weekly = weeklyContextReader.read(memberId, today);
        requireTime(deadline, "reading diaries");
        AnswerWriter.Answer answer = answerWriter.write(new AnswerWriter.Material(
                question, today, criteria, candidates, matched, topActivities, List.of(), pickRelevant, weekly),
                labels);

        List<Candidate> chosen = candidates;
        String text = answer.answer();
        if (pickRelevant) {
            Set<Long> cited = Set.copyOf(answer.diaryIds());
            chosen = candidates.stream().filter(candidate -> cited.contains(candidate.diaryId())).toList();
            if (chosen.isEmpty()) {
                return Outcome.empty();
            }
            matched = chosen.size();
            topActivities = topActivitiesOf(chosen);
            text = AnswerWriter.withCount(chosen.size(), text);
        }
        if (statsQuestion) {
            return new Outcome(SearchResultType.STATS_ONLY, text,
                    new Stats(matched, activityDtos(topActivities), emotionDtos(emotionCountsOf(chosen))), List.of());
        }
        return new Outcome(SearchResultType.FOUND, text,
                new Stats(matched, activityDtos(topActivities), null),
                chosen.stream().map(Candidate::diaryId).toList());
    }

    /**
     * The question's embedding, or {@code null} to rank by date. A failed or late embedding
     * costs the ordering, not the answer, so it is not worth a 503.
     *
     * <p>Waits only as long as still leaves the answer call its full read timeout. The GMS
     * timeout alone does not bound this wait: a request queued behind busy embedding threads
     * has not started its call yet.
     */
    private float[] vectorOrNull(CompletableFuture<float[]> queryVector, long deadline) {
        long wait = deadline - System.nanoTime() - gmsProperties.readTimeout().toNanos();
        try {
            float[] vector = wait > 0 ? queryVector.get(wait, TimeUnit.NANOSECONDS) : queryVector.getNow(null);
            if (vector == null) {
                log.warn("question embedding not ready within the time budget, ranking by date");
            }
            return vector;
        } catch (TimeoutException e) {
            log.warn("question embedding not ready within the time budget, ranking by date");
            return null;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return null;
        } catch (ExecutionException | RuntimeException e) {
            Throwable cause = e.getCause() == null ? e : e.getCause();
            log.warn("question embedding unavailable, ranking by date: cause={}", cause.getMessage());
            return null;
        }
    }

    /**
     * Spec: past 10 seconds the question answers 503. Checked between steps, so a step that
     * starts late fails instead of adding its own timeout on top.
     */
    private static void requireTime(long deadline, String step) {
        if (System.nanoTime() >= deadline) {
            throw new GmsUnavailableException("time budget spent after " + step);
        }
    }

    /**
     * Renders the diaries, then stores the question as answered. The budget is checked once
     * more in between: past it the answer is not stored as a success, but thrown out as
     * {@code FAILED} like any other late answer.
     */
    private EmotionSearchResponseDto finish(Long memberId, String question, SearchCriteria criteria,
            Outcome outcome, long started, long deadline) {
        List<DiarySummaryResponseDto> diaries = diaryService.summaries(memberId, outcome.diaryIds());
        if (outcome.type() == SearchResultType.FOUND && diaries.isEmpty()) {
            // Every diary found was deleted while the answer was being written.
            outcome = Outcome.empty();
        }
        DiarySummaryResponseDto featured = diaries.stream()
                .filter(diary -> diary.image() != null && diary.image().status() == ImageStatus.SUCCEEDED)
                .findFirst()
                .orElse(diaries.isEmpty() ? null : diaries.get(0));
        DiaryDetailResponseDto featuredDetail = featured == null ? null : diaryService.get(memberId, featured.diaryId());
        requireTime(deadline, "rendering diaries");

        Outcome stored = outcome;
        EmotionSearch search = transactionTemplate.execute(status -> {
            EmotionSearch saved = record(memberId, question, criteria, stored.type(), stored.answer(), started);
            List<EmotionSearchResult> results = new ArrayList<>();
            for (int i = 0; i < diaries.size(); i++) {
                Long diaryId = diaries.get(i).diaryId();
                results.add(EmotionSearchResult.of(saved.getId(), diaryId, i + 1, diaryId.equals(featured.diaryId())));
            }
            emotionSearchResultRepository.saveAll(results);
            return saved;
        });
        return new EmotionSearchResponseDto(
                search.getId(), question, outcome.type(), outcome.answer(), InterpretedFilter.of(criteria),
                outcome.stats(), featuredDetail, diaries);
    }

    private EmotionSearch record(Long memberId, String question, SearchCriteria criteria, SearchResultType type,
            String answer, long started) {
        String filter = criteria == null ? null : objectMapper.writeValueAsString(InterpretedFilter.of(criteria));
        int latencyMs = (int) ((System.nanoTime() - started) / 1_000_000);
        return emotionSearchRepository.save(EmotionSearch.record(
                memberId, question, filter, type, answer, latencyMs, OffsetDateTime.now(clock)));
    }

    /**
     * Counted from stored questions, failed ones included. Two questions sent in the same
     * instant can both pass and make it eleven; the limit protects GMS spend, not a balance,
     * so that is not worth a lock.
     */
    private void checkRateLimit(Long memberId) {
        OffsetDateTime oneMinuteAgo = OffsetDateTime.now(clock).minusMinutes(1);
        if (emotionSearchRepository.countByMemberIdAndCreatedAtAfter(memberId, oneMinuteAgo) >= PER_MINUTE) {
            throw new BusinessException(CommonErrorCode.RATE_LIMITED, "emotion search limit: memberId=" + memberId);
        }
    }

    private Map<ActivityCode, String> activityLabels() {
        Map<ActivityCode, String> labels = new EnumMap<>(ActivityCode.class);
        activityRepository.findAll().forEach(activity -> labels.put(activity.getCode(), activity.getLabel()));
        return labels;
    }

    /** {@link SearchDiaryQuery#topActivities} over the chosen diaries, same ordering. */
    private List<ActivityCount> topActivitiesOf(List<Candidate> chosen) {
        Map<ActivityCode, Integer> sortOrder = activityRepository.findAll().stream()
                .collect(Collectors.toMap(Activity::getCode, Activity::getSortOrder));
        Map<ActivityCode, Long> counts = new LinkedHashMap<>();
        chosen.forEach(candidate -> candidate.activities().forEach(code -> counts.merge(code, 1L, Long::sum)));
        return counts.entrySet().stream()
                .sorted(Comparator.<Map.Entry<ActivityCode, Long>>comparingLong(Map.Entry::getValue).reversed()
                        .thenComparing(entry -> sortOrder.getOrDefault(entry.getKey(), Integer.MAX_VALUE)))
                .limit(TOP_ACTIVITIES)
                .map(entry -> new ActivityCount(entry.getKey(), entry.getValue()))
                .toList();
    }

    /** {@link SearchDiaryQuery#emotionCounts} over the chosen diaries, same ordering. */
    private static List<EmotionCount> emotionCountsOf(List<Candidate> chosen) {
        return chosen.stream()
                .collect(Collectors.groupingBy(Candidate::emotion, Collectors.counting()))
                .entrySet().stream()
                .sorted(Comparator.<Map.Entry<Emotion, Long>>comparingLong(Map.Entry::getValue).reversed()
                        .thenComparing(entry -> entry.getKey().name()))
                .map(entry -> new EmotionCount(entry.getKey(), entry.getValue()))
                .toList();
    }

    private static List<EmotionSearchResponseDto.ActivityCount> activityDtos(List<ActivityCount> counts) {
        return counts.stream()
                .map(count -> new EmotionSearchResponseDto.ActivityCount(count.activity(), count.count()))
                .toList();
    }

    private static List<EmotionSearchResponseDto.EmotionCount> emotionDtos(List<EmotionCount> counts) {
        return counts.stream()
                .map(count -> new EmotionSearchResponseDto.EmotionCount(count.emotion(), count.count()))
                .toList();
    }

}
