package com.ssafy.mozzi.domain.diary.service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.hibernate.exception.ConstraintViolationException;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import com.ssafy.mozzi.domain.diary.dto.DiaryCreateRequestDto;
import com.ssafy.mozzi.domain.diary.dto.DiaryCreateResponseDto;
import com.ssafy.mozzi.domain.diary.dto.DiaryDetailResponseDto;
import com.ssafy.mozzi.domain.diary.dto.DiaryMonthlyResponseDto;
import com.ssafy.mozzi.domain.diary.dto.DiarySearchRequestDto;
import com.ssafy.mozzi.domain.diary.dto.DiarySummaryResponseDto;
import com.ssafy.mozzi.domain.diary.entity.Diary;
import com.ssafy.mozzi.domain.diary.exception.DiaryAlreadyExistsException;
import com.ssafy.mozzi.domain.diary.repository.DiaryRepository;
import com.ssafy.mozzi.domain.emoticon.entity.Emoticon;
import com.ssafy.mozzi.domain.emoticon.repository.EmoticonRepository;
import com.ssafy.mozzi.domain.icon.dto.MyIconResponseDto;
import com.ssafy.mozzi.domain.icon.entity.IconCategory;
import com.ssafy.mozzi.domain.icon.entity.MyIcon;
import com.ssafy.mozzi.domain.icon.repository.MyIconRepository;
import com.ssafy.mozzi.domain.image.dto.DiaryImageResponseDto;
import com.ssafy.mozzi.domain.image.entity.DiaryImage;
import com.ssafy.mozzi.domain.image.repository.DiaryImageRepository;
import com.ssafy.mozzi.domain.wallet.dto.RewardResponseDto;
import com.ssafy.mozzi.domain.wallet.service.RewardService;
import com.ssafy.mozzi.global.exception.BusinessException;
import com.ssafy.mozzi.global.exception.CommonErrorCode;
import com.ssafy.mozzi.global.response.CursorPage;

/**
 * Writing and reading diaries.
 *
 * <p>Every method takes the authenticated member's id and scopes its query by it, so another
 * member's diary or icon is indistinguishable from a missing one (spec 1.3).
 */
@Service
public class DiaryService {

    /** Name of the partial unique index behind "one diary per day" (V3 migration). */
    static final String ONE_DIARY_PER_DAY = "uq_diary_member_record_date";

    private final DiaryRepository diaryRepository;
    private final EmoticonRepository emoticonRepository;
    private final MyIconRepository myIconRepository;
    private final DiaryImageRepository diaryImageRepository;
    private final RewardService rewardService;
    private final ApplicationEventPublisher eventPublisher;
    private final TransactionTemplate transactionTemplate;
    private final Clock clock;

    public DiaryService(
            DiaryRepository diaryRepository,
            EmoticonRepository emoticonRepository,
            MyIconRepository myIconRepository,
            DiaryImageRepository diaryImageRepository,
            RewardService rewardService,
            ApplicationEventPublisher eventPublisher,
            PlatformTransactionManager transactionManager,
            Clock clock) {
        this.diaryRepository = diaryRepository;
        this.emoticonRepository = emoticonRepository;
        this.myIconRepository = myIconRepository;
        this.diaryImageRepository = diaryImageRepository;
        this.rewardService = rewardService;
        this.eventPublisher = eventPublisher;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
        this.clock = clock;
    }

    /**
     * Saves today's diary.
     *
     * <p>Two requests for the same day (a double tap) can both pass the existence check and
     * race to the insert. The unique index decides the winner; the loser's transaction is
     * rolled back, and only then — outside it, because PostgreSQL refuses further statements
     * in a failed transaction — is the winner's id looked up for the 409 body. That is why
     * this method runs its transaction through a template instead of {@code @Transactional}.
     */
    public DiaryCreateResponseDto create(Long memberId, DiaryCreateRequestDto request) {
        LocalDate today = LocalDate.now(clock);
        try {
            return transactionTemplate.execute(status -> insert(memberId, today, request));
        } catch (DataIntegrityViolationException e) {
            if (!violates(e, ONE_DIARY_PER_DAY)) {
                throw e;
            }
            Diary existing = diaryRepository.findByMemberIdAndRecordDateAndDeletedAtIsNull(memberId, today)
                    .orElseThrow(() -> e);
            throw new DiaryAlreadyExistsException(existing.getId());
        }
    }

    private DiaryCreateResponseDto insert(Long memberId, LocalDate today, DiaryCreateRequestDto request) {
        diaryRepository.findByMemberIdAndRecordDateAndDeletedAtIsNull(memberId, today)
                .ifPresent(existing -> {
                    throw new DiaryAlreadyExistsException(existing.getId());
                });
        Emoticon emoticon = emoticonRepository.findById(request.emoticonId())
                .orElseThrow(() -> new BusinessException(
                        CommonErrorCode.NOT_FOUND, "emoticon not found: emoticonId=" + request.emoticonId()));
        List<MyIcon> myIcons = iconsFor(memberId, request.myIconIds());

        Diary diary = diaryRepository.save(Diary.create(memberId, today, emoticon, request.content(), myIcons));
        // Emotion search embeds the diary once this commits. Diaries are never edited or
        // deleted, so saving is the only change it needs to hear about.
        eventPublisher.publishEvent(new DiaryContentChangedEvent(diary.getId()));
        RewardResponseDto reward = rewardService.dailyRecord(memberId, diary.getId(), diary.getRecordDate());
        return new DiaryCreateResponseDto(diary.getId(), diary.getRecordDate(), reward);
    }

    /**
     * @throws BusinessException {@code 400 INVALID_INPUT} when an icon is not the member's
     *                           live icon, or none of them says what the member did
     */
    private List<MyIcon> iconsFor(Long memberId, List<Long> myIconIds) {
        List<MyIcon> myIcons = myIconIds.isEmpty() ? List.of() : myIconRepository.findActiveByIds(myIconIds, memberId);
        if (myIcons.size() != myIconIds.size()) {
            throw new BusinessException(CommonErrorCode.INVALID_INPUT,
                    "unusable icon in " + myIconIds, "사용할 수 없는 아이콘이 있어요.");
        }
        if (myIcons.stream().noneMatch(icon -> icon.getCategory() == IconCategory.WHAT)) {
            throw new BusinessException(CommonErrorCode.INVALID_INPUT,
                    "no WHAT icon in " + myIconIds, DiaryCreateRequestDto.WHAT_REQUIRED);
        }
        return myIcons;
    }

    /** {@code GET /diaries/daily}. */
    @Transactional(readOnly = true)
    public DiaryDetailResponseDto getDaily(Long memberId, LocalDate date) {
        return findDaily(memberId, date)
                .orElseThrow(() -> new BusinessException(
                        CommonErrorCode.NOT_FOUND, "no diary on " + date, "이 날은 기록이 없어요."));
    }

    /** The day's diary, or empty when none was written; for the home screen, where that is normal. */
    @Transactional(readOnly = true)
    public Optional<DiaryDetailResponseDto> findDaily(Long memberId, LocalDate date) {
        return diaryRepository.findByMemberIdAndRecordDateAndDeletedAtIsNull(memberId, date).map(this::toDetail);
    }

    /** The most recent diary written before {@code date}, for the home screen's "지난 기록". */
    @Transactional(readOnly = true)
    public Optional<DiaryDetailResponseDto> findLatestBefore(Long memberId, LocalDate date) {
        return diaryRepository
                .findFirstByMemberIdAndRecordDateBeforeAndDeletedAtIsNullOrderByRecordDateDesc(memberId, date)
                .map(this::toDetail);
    }

    /** One diary by id, for emotion search's big card. */
    @Transactional(readOnly = true)
    public DiaryDetailResponseDto get(Long memberId, Long diaryId) {
        Diary diary = diaryRepository.findByIdAndMemberIdAndDeletedAtIsNull(diaryId, memberId)
                .orElseThrow(() -> new BusinessException(
                        CommonErrorCode.NOT_FOUND, "diary not found: diaryId=" + diaryId));
        return toDetail(diary);
    }

    /**
     * List rows for diaries another feature has already picked (emotion search), in the
     * order given. Ids of deleted diaries or of another member's are left out.
     */
    @Transactional(readOnly = true)
    public List<DiarySummaryResponseDto> summaries(Long memberId, List<Long> diaryIds) {
        if (diaryIds.isEmpty()) {
            return List.of();
        }
        Map<Long, Diary> byId = diaryRepository.findAllById(diaryIds).stream()
                .filter(diary -> diary.getMemberId().equals(memberId))
                .collect(Collectors.toMap(Diary::getId, Function.identity()));
        Map<Long, DiaryImage> images = imagesOf(List.copyOf(byId.values()));
        return diaryIds.stream()
                .map(byId::get)
                .filter(Objects::nonNull)
                .map(diary -> DiarySummaryResponseDto.of(diary, DiaryImageResponseDto.of(images.get(diary.getId()))))
                .toList();
    }

    private DiaryDetailResponseDto toDetail(Diary diary) {
        return new DiaryDetailResponseDto(
                diary.getId(),
                diary.getRecordDate(),
                diary.getEmoticonId(),
                diary.getEmotion(),
                diary.getContent(),
                iconsByCategory(diaryRepository.findActiveIcons(diary.getId())),
                DiaryImageResponseDto.of(diaryImageRepository.findByDiaryId(diary.getId()).orElse(null)),
                diary.getCreatedAt(),
                diary.getUpdatedAt());
    }

    /** Every category is present, in {@link IconCategory} order, so the app never checks for a key. */
    private static Map<IconCategory, List<MyIconResponseDto>> iconsByCategory(List<MyIcon> myIcons) {
        Map<IconCategory, List<MyIconResponseDto>> grouped = new EnumMap<>(IconCategory.class);
        for (IconCategory category : IconCategory.values()) {
            grouped.put(category, new ArrayList<>());
        }
        myIcons.forEach(icon -> grouped.get(icon.getCategory()).add(MyIconResponseDto.of(icon)));
        return grouped;
    }

    /** {@code GET /diaries/monthly}. A month in the future simply has no rows. */
    @Transactional(readOnly = true)
    public DiaryMonthlyResponseDto getMonthly(Long memberId, YearMonth yearMonth) {
        List<DiaryMonthlyResponseDto.Item> items = diaryRepository
                .findByMemberIdAndRecordDateBetweenAndDeletedAtIsNullOrderByRecordDateAsc(
                        memberId, yearMonth.atDay(1), yearMonth.atEndOfMonth())
                .stream()
                .map(DiaryMonthlyResponseDto.Item::of)
                .toList();
        return new DiaryMonthlyResponseDto(yearMonth.toString(), items);
    }

    @Transactional(readOnly = true)
    public CursorPage<DiarySummaryResponseDto> search(Long memberId, DiarySearchRequestDto request) {
        if (request.from() != null && request.to() != null && request.from().isAfter(request.to())) {
            throw new BusinessException(
                    CommonErrorCode.INVALID_INPUT, "from after to", "기간을 다시 확인해 주세요.");
        }
        DiaryCursor cursor = request.cursor() == null || request.cursor().isBlank()
                ? null
                : DiaryCursor.decode(request.cursor());
        int size = request.sizeOrDefault();

        List<Diary> fetched = diaryRepository.search(
                memberId, request.emotion(), request.from(), request.to(),
                cursor == null ? null : cursor.recordDate(),
                cursor == null ? null : cursor.diaryId(),
                PageRequest.ofSize(size + 1));

        Map<Long, DiaryImage> images = imagesOf(fetched);
        List<DiarySummaryResponseDto> rows = fetched.stream()
                .map(diary -> DiarySummaryResponseDto.of(diary, DiaryImageResponseDto.of(images.get(diary.getId()))))
                .toList();
        return CursorPage.of(rows, size,
                row -> new DiaryCursor(row.recordDate(), row.diaryId()).encode());
    }

    /** Pictures of a page in one query rather than one per row. */
    private Map<Long, DiaryImage> imagesOf(List<Diary> diaries) {
        if (diaries.isEmpty()) {
            return Map.of();
        }
        List<Long> ids = diaries.stream().map(Diary::getId).toList();
        return diaryImageRepository.findByDiaryIdIn(ids).stream()
                .collect(Collectors.toMap(DiaryImage::getDiaryId, Function.identity()));
    }

    private static boolean violates(DataIntegrityViolationException e, String constraintName) {
        for (Throwable cause = e; cause != null; cause = cause.getCause()) {
            if (cause instanceof ConstraintViolationException violation) {
                return constraintName.equals(violation.getConstraintName());
            }
        }
        return false;
    }

}
