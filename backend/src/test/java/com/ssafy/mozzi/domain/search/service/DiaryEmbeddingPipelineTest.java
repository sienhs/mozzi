package com.ssafy.mozzi.domain.search.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.stream.IntStream;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import com.ssafy.mozzi.domain.diary.dto.DiaryCreateRequestDto;
import com.ssafy.mozzi.domain.diary.entity.ActivityCode;
import com.ssafy.mozzi.domain.diary.entity.Diary;
import com.ssafy.mozzi.domain.diary.entity.Emotion;
import com.ssafy.mozzi.domain.diary.repository.ActivityRepository;
import com.ssafy.mozzi.domain.diary.repository.DiaryRepository;
import com.ssafy.mozzi.domain.diary.service.DiaryService;
import com.ssafy.mozzi.domain.member.entity.AuthProvider;
import com.ssafy.mozzi.domain.member.entity.Member;
import com.ssafy.mozzi.domain.member.repository.MemberRepository;
import com.ssafy.mozzi.domain.search.repository.DiaryEmbeddingStore;
import com.ssafy.mozzi.integration.gms.GmsEmbeddingClient;
import com.ssafy.mozzi.integration.gms.GmsUnavailableException;
import com.ssafy.mozzi.support.IntegrationTest;

/**
 * The embedding pipeline against the real schema and pgvector, with GMS replaced.
 *
 * <p>Diaries are inserted through the repository, which publishes no event, except where a
 * test is about the event itself.
 */
@IntegrationTest
class DiaryEmbeddingPipelineTest {

    private static final String MODEL = "text-embedding-3-large@1536";

    @Autowired
    private DiaryEmbeddingService diaryEmbeddingService;

    @Autowired
    private DiaryEmbeddingSweeper diaryEmbeddingSweeper;

    @Autowired
    private DiaryEmbeddingStore store;

    @Autowired
    private DiaryService diaryService;

    @Autowired
    private DiaryRepository diaryRepository;

    @Autowired
    private ActivityRepository activityRepository;

    @Autowired
    private MemberRepository memberRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private Clock clock;

    @MockitoBean
    private GmsEmbeddingClient embeddingClient;

    private Long me;
    private LocalDate today;

    @BeforeEach
    void setUp() {
        // Cascades to diary and diary_embedding.
        jdbcTemplate.execute("truncate table member cascade");
        me = memberRepository.saveAndFlush(Member.signUp("me@gmail.com", AuthProvider.GOOGLE, "me", "me")).getId();
        today = LocalDate.now(clock);
        when(embeddingClient.embedAll(anyList())).thenAnswer(invocation -> {
            List<String> texts = invocation.getArgument(0);
            return IntStream.range(0, texts.size()).mapToObj(i -> unit()).toList();
        });
    }

    /** The event path: saved, committed, embedded in the background, deleted with the diary. */
    @Test
    void savedDiaryIsEmbeddedAndDeletedDiaryLosesItsRow() {
        Long diaryId = diaryService.create(me, new DiaryCreateRequestDto(
                today, Emotion.CALM, List.of(ActivityCode.FAMILY, ActivityCode.REST), "엄마랑 산책")).diaryId();

        await().atMost(Duration.ofSeconds(10)).until(() -> rowCount(diaryId) == 1);
        // Activities in chip order (REST before FAMILY), whatever order they were sent in.
        verify(embeddingClient).embedAll(List.of(today + " 평온 / 휴식, 가족 / 엄마랑 산책"));
        assertThat(jdbcTemplate.queryForObject(
                "select model from diary_embedding where diary_id = ?", String.class, diaryId)).isEqualTo(MODEL);
        assertThat(embeddingVersion(diaryId)).isEqualTo(diaryVersion(diaryId));

        diaryService.delete(me, diaryId);

        await().atMost(Duration.ofSeconds(10)).until(() -> rowCount(diaryId) == 0);
    }

    /** Nothing for a meaning search to find, and nothing to send to GMS. */
    @Test
    void diaryWithoutAMemoIsNotEmbedded() {
        Diary diary = insertDiary(null);

        diaryEmbeddingService.refresh(diary.getId());

        assertThat(rowCount(diary.getId())).isZero();
        verify(embeddingClient, never()).embedAll(anyList());
    }

    /** A title from the picture worker changes the diary, not the embedded text. */
    @Test
    void changeOutsideTheTextOnlyMarksTheRowCurrent() {
        Diary diary = insertDiary("엄마랑 산책");
        diaryEmbeddingService.refresh(diary.getId());
        jdbcTemplate.update("update diary set title = '산책', updated_at = updated_at + interval '1 minute' "
                + "where diary_id = ?", diary.getId());

        diaryEmbeddingService.refresh(diary.getId());

        verify(embeddingClient, times(1)).embedAll(anyList());
        assertThat(embeddingVersion(diary.getId())).isEqualTo(diaryVersion(diary.getId()));
    }

    @Test
    void editedMemoIsEmbeddedAgain() {
        Diary diary = insertDiary("엄마랑 산책");
        diaryEmbeddingService.refresh(diary.getId());
        String firstHash = contentHash(diary.getId());
        jdbcTemplate.update("update diary set memo = '아빠랑 등산', updated_at = updated_at + interval '1 minute' "
                + "where diary_id = ?", diary.getId());

        diaryEmbeddingService.refresh(diary.getId());

        verify(embeddingClient).embedAll(List.of(today + " 평온 / 휴식 / 아빠랑 등산"));
        assertThat(contentHash(diary.getId())).isNotEqualTo(firstHash);
    }

    @Test
    void clearedMemoRemovesTheRow() {
        Diary diary = insertDiary("엄마랑 산책");
        diaryEmbeddingService.refresh(diary.getId());
        jdbcTemplate.update("update diary set memo = null where diary_id = ?", diary.getId());

        diaryEmbeddingService.refresh(diary.getId());

        assertThat(rowCount(diary.getId())).isZero();
    }

    /**
     * One sweep fills a missing row and rebuilds another model's in a single call, and
     * drops rows whose diary no longer qualifies.
     */
    @Test
    void sweepCatchesUpInOneCall() {
        Diary missing = insertDiary("처음 쓰는 일기");
        Diary otherModel = insertDiary("모델이 바뀐 일기");
        Diary noMemo = insertDiary(null);
        Diary deleted = insertDiary("지운 일기");
        insertRow(otherModel.getId(), "text-embedding-3-small@1536");
        insertRow(deleted.getId(), MODEL);
        jdbcTemplate.update("update diary set deleted_at = now() where diary_id = ?", deleted.getId());

        DiaryEmbeddingService.SweepResult result = diaryEmbeddingService.sweep(DiaryEmbeddingSweeper.BATCH);

        assertThat(result).isEqualTo(new DiaryEmbeddingService.SweepResult(1, 2));
        verify(embeddingClient, times(1)).embedAll(anyList());
        assertThat(jdbcTemplate.queryForList("select diary_id from diary_embedding where model = ? order by diary_id",
                Long.class, MODEL)).containsExactly(missing.getId(), otherModel.getId());
        assertThat(rowCount(noMemo.getId())).isZero();
        assertThat(rowCount(deleted.getId())).isZero();

        // Everything is current now, so the next sweep has nothing to send.
        diaryEmbeddingService.sweep(DiaryEmbeddingSweeper.BATCH);
        verify(embeddingClient, times(1)).embedAll(anyList());
    }

    /** Two edits whose embeddings come back in the wrong order: the newer one stays. */
    @Test
    void olderBuildDoesNotOverwriteANewerOne() {
        Diary diary = insertDiary("엄마랑 산책");
        OffsetDateTime older = diaryVersion(diary.getId());
        OffsetDateTime newer = older.plusMinutes(1);
        OffsetDateTime now = OffsetDateTime.now(clock);

        store.upsert(diary.getId(), MODEL, "newer", unit(), newer, now);
        store.upsert(diary.getId(), MODEL, "older", unit(), older, now);

        assertThat(contentHash(diary.getId())).isEqualTo("newer");
    }

    /**
     * A refresh checked the row (text A), then a late build of another text (B) landed
     * before it marked the row current. Marking it now would stamp the diary's latest
     * version on B's vector, and no sweep would ever look at it again.
     */
    @Test
    void markingCurrentVouchesOnlyForTheVectorThatWasChecked() {
        Diary diary = insertDiary("엄마랑 산책");
        OffsetDateTime v1 = diaryVersion(diary.getId());
        OffsetDateTime now = OffsetDateTime.now(clock);
        store.upsert(diary.getId(), MODEL, "hash-a", unit(), v1, now);
        store.upsert(diary.getId(), MODEL, "hash-b", unit(), v1.plusMinutes(1), now);

        boolean marked = store.markCurrent(diary.getId(), MODEL, "hash-a", v1.plusMinutes(2));

        assertThat(marked).isFalse();
        assertThat(contentHash(diary.getId())).isEqualTo("hash-b");
        assertThat(embeddingVersion(diary.getId())).isEqualTo(v1.plusMinutes(1));
    }

    /** The service side of the same race: a refused mark means the text is embedded again. */
    @Test
    void refusedMarkFallsBackToEmbedding() {
        Diary diary = insertDiary("엄마랑 산책");
        String hash = DiaryEmbeddingService.sha256(DiaryEmbeddingService.text(store.source(diary.getId()).orElseThrow()));
        // Same text, but stamped with a version newer than the diary's: the mark is refused.
        store.upsert(diary.getId(), MODEL, hash, unit(), diaryVersion(diary.getId()).plusMinutes(5),
                OffsetDateTime.now(clock));

        diaryEmbeddingService.refresh(diary.getId());

        verify(embeddingClient).embedAll(List.of(today + " 평온 / 휴식 / 엄마랑 산책"));
    }

    /**
     * The memo is cleared while GMS is answering, and that change's refresh has already run.
     * The late vector must not bring the old memo's row back.
     */
    @Test
    void vectorForAMemoClearedMeanwhileIsDropped() {
        Diary diary = insertDiary("엄마랑 산책");
        changeWhileEmbedding("update diary set memo = null, updated_at = updated_at + interval '1 minute' "
                + "where diary_id = ?", diary.getId());

        diaryEmbeddingService.refresh(diary.getId());

        assertThat(rowCount(diary.getId())).isZero();
    }

    @Test
    void vectorForADiaryDeletedMeanwhileIsDropped() {
        Diary diary = insertDiary("엄마랑 산책");
        changeWhileEmbedding("update diary set deleted_at = now(), updated_at = updated_at + interval '1 minute' "
                + "where diary_id = ?", diary.getId());

        diaryEmbeddingService.refresh(diary.getId());

        assertThat(rowCount(diary.getId())).isZero();
    }

    /** An edit meanwhile: the old text's vector is dropped and the row is left for the edit's own refresh. */
    @Test
    void vectorForAnOutdatedVersionIsDropped() {
        Diary diary = insertDiary("엄마랑 산책");
        changeWhileEmbedding("update diary set memo = '아빠랑 등산', updated_at = updated_at + interval '1 minute' "
                + "where diary_id = ?", diary.getId());

        diaryEmbeddingService.refresh(diary.getId());

        assertThat(rowCount(diary.getId())).isZero();
        assertThat(store.stale(MODEL, 10)).extracting(DiaryEmbeddingStore.Source::diaryId).contains(diary.getId());
    }

    /** The sweep is a background job: a GMS outage is logged, not thrown at the scheduler. */
    @Test
    void sweepSurvivesAnOutage() {
        Diary diary = insertDiary("엄마랑 산책");
        when(embeddingClient.embedAll(anyList())).thenThrow(new GmsUnavailableException("embeddings answered 503"));

        diaryEmbeddingSweeper.sweep();

        assertThat(rowCount(diary.getId())).isZero();
    }

    private Diary insertDiary(String memo) {
        return diaryRepository.saveAndFlush(Diary.create(
                me, today.minusDays(diaryRepository.count()), Emotion.CALM, memo,
                activityRepository.findByCodeInAndActiveTrue(List.of(ActivityCode.REST))));
    }

    /**
     * Runs {@code sql} between reading the diary and writing its vector, the window a real
     * edit or delete can fall into while GMS is answering.
     */
    private void changeWhileEmbedding(String sql, Long diaryId) {
        when(embeddingClient.embedAll(anyList())).thenAnswer(invocation -> {
            jdbcTemplate.update(sql, diaryId);
            List<String> texts = invocation.getArgument(0);
            return IntStream.range(0, texts.size()).mapToObj(i -> unit()).toList();
        });
    }

    private void insertRow(Long diaryId, String model) {
        store.upsert(diaryId, model, "hash", unit(), diaryVersion(diaryId), OffsetDateTime.now(clock));
    }

    private int rowCount(Long diaryId) {
        return jdbcTemplate.queryForObject("select count(*) from diary_embedding where diary_id = ?", Integer.class,
                diaryId);
    }

    private String contentHash(Long diaryId) {
        return jdbcTemplate.queryForObject("select content_hash from diary_embedding where diary_id = ?", String.class,
                diaryId);
    }

    private OffsetDateTime diaryVersion(Long diaryId) {
        return jdbcTemplate.queryForObject("select updated_at from diary where diary_id = ?", OffsetDateTime.class,
                diaryId);
    }

    private OffsetDateTime embeddingVersion(Long diaryId) {
        return jdbcTemplate.queryForObject("select updated_at from diary_embedding where diary_id = ?",
                OffsetDateTime.class, diaryId);
    }

    private static float[] unit() {
        float[] vector = new float[1536];
        vector[0] = 1f;
        return vector;
    }

}
