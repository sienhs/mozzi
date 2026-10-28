package com.ssafy.mozzi.domain.diary.service;

import java.time.Clock;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

import org.hibernate.exception.ConstraintViolationException;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.auditing.AuditingHandler;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import com.ssafy.mozzi.domain.diary.dto.DiaryCreateRequestDto;
import com.ssafy.mozzi.domain.diary.dto.DiaryCreateResponseDto;
import com.ssafy.mozzi.domain.diary.dto.DiaryDetailResponseDto;
import com.ssafy.mozzi.domain.diary.dto.DiarySearchRequestDto;
import com.ssafy.mozzi.domain.diary.dto.DiarySummaryResponseDto;
import com.ssafy.mozzi.domain.diary.dto.DiaryUpdateRequestDto;
import com.ssafy.mozzi.domain.diary.entity.Activity;
import com.ssafy.mozzi.domain.diary.entity.ActivityCode;
import com.ssafy.mozzi.domain.diary.entity.Diary;
import com.ssafy.mozzi.domain.diary.exception.DiaryAlreadyExistsException;
import com.ssafy.mozzi.domain.diary.repository.ActivityRepository;
import com.ssafy.mozzi.domain.diary.repository.DiaryActivityRow;
import com.ssafy.mozzi.domain.diary.repository.DiaryRepository;
import com.ssafy.mozzi.domain.image.entity.DiaryImage;
import com.ssafy.mozzi.domain.image.entity.ImageStatus;
import com.ssafy.mozzi.domain.image.repository.DiaryImageRepository;
import com.ssafy.mozzi.domain.image.service.ImageGenerationRequestedEvent;
import com.ssafy.mozzi.domain.image.service.ImageUrlSigner;
import com.ssafy.mozzi.global.exception.BusinessException;
import com.ssafy.mozzi.global.exception.CommonErrorCode;
import com.ssafy.mozzi.global.response.CursorPage;

/**
 * Diary CRUD (API spec 4.4).
 *
 * <p>Every method takes the authenticated member's id and scopes its query by it, so another
 * member's diary is indistinguishable from a missing one (spec 1.3).
 */
@Service
public class DiaryService {

    /** Name of the partial unique index behind "one diary per day" (V3 migration). */
    static final String ONE_DIARY_PER_DAY = "uq_diary_member_record_date";

    private final DiaryRepository diaryRepository;
    private final ActivityRepository activityRepository;
    private final DiaryImageRepository diaryImageRepository;
    private final RecordDatePolicy recordDatePolicy;
    private final ImageUrlSigner imageUrlSigner;
    private final ApplicationEventPublisher eventPublisher;
    private final TransactionTemplate transactionTemplate;
    private final AuditingHandler auditingHandler;
    private final Clock clock;

    public DiaryService(
            DiaryRepository diaryRepository,
            ActivityRepository activityRepository,
            DiaryImageRepository diaryImageRepository,
            RecordDatePolicy recordDatePolicy,
            ImageUrlSigner imageUrlSigner,
            ApplicationEventPublisher eventPublisher,
            PlatformTransactionManager transactionManager,
            AuditingHandler auditingHandler,
            Clock clock) {
        this.diaryRepository = diaryRepository;
        this.activityRepository = activityRepository;
        this.diaryImageRepository = diaryImageRepository;
        this.recordDatePolicy = recordDatePolicy;
        this.imageUrlSigner = imageUrlSigner;
        this.eventPublisher = eventPublisher;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
        this.auditingHandler = auditingHandler;
        this.clock = clock;
    }

    /**
     * Saves the diary and queues its first picture in one transaction (spec 4.4).
     *
     * <p>Two requests for the same day can both pass the existence check and race to the
     * insert. The unique index decides the winner; the loser's transaction is rolled back,
     * and only then — outside it, because PostgreSQL refuses further statements in a failed
     * transaction — is the winner's id looked up for the 409 body. That is why this method
     * runs its transaction through a template instead of {@code @Transactional}.
     */
    public DiaryCreateResponseDto create(Long memberId, DiaryCreateRequestDto request) {
        recordDatePolicy.validate(request.recordDate());
        try {
            return transactionTemplate.execute(status -> insert(memberId, request));
        } catch (DataIntegrityViolationException e) {
            if (!violates(e, ONE_DIARY_PER_DAY)) {
                throw e;
            }
            Diary existing = diaryRepository
                    .findByMemberIdAndRecordDateAndDeletedAtIsNull(memberId, request.recordDate())
                    .orElseThrow(() -> e);
            throw new DiaryAlreadyExistsException(existing.getId());
        }
    }

    private DiaryCreateResponseDto insert(Long memberId, DiaryCreateRequestDto request) {
        diaryRepository.findByMemberIdAndRecordDateAndDeletedAtIsNull(memberId, request.recordDate())
                .ifPresent(existing -> {
                    throw new DiaryAlreadyExistsException(existing.getId());
                });

        Diary diary = diaryRepository.save(Diary.create(
                memberId, request.recordDate(), request.emotion(), request.memo(),
                activitiesFor(request.activities())));
        DiaryImage image = diaryImageRepository.save(DiaryImage.initial(diary.getId(), clock));
        diary.showImage(image);

        eventPublisher.publishEvent(new ImageGenerationRequestedEvent(image.getId()));
        eventPublisher.publishEvent(new DiaryContentChangedEvent(diary.getId()));
        return new DiaryCreateResponseDto(
                diary.getId(), diary.getRecordDate(),
                new DiaryCreateResponseDto.Image(image.getId(), image.getStatus()));
    }

    @Transactional(readOnly = true)
    public DiaryDetailResponseDto get(Long memberId, Long diaryId) {
        return toDetail(find(memberId, diaryId));
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
                memberId, request.emotion(), request.activity(), request.from(), request.to(),
                cursor == null ? null : cursor.recordDate(),
                cursor == null ? null : cursor.diaryId(),
                PageRequest.ofSize(size + 1));

        Map<Long, List<ActivityCode>> activities = activityCodesOf(fetched);
        List<DiarySummaryResponseDto> rows = fetched.stream()
                .map(diary -> DiarySummaryResponseDto.of(diary, activities.getOrDefault(diary.getId(), List.of())))
                .toList();
        return CursorPage.of(rows, size,
                row -> new DiaryCursor(row.recordDate(), row.diaryId()).encode());
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
                .collect(Collectors.toMap(Diary::getId, diary -> diary));
        Map<Long, List<ActivityCode>> activities = activityCodesOf(List.copyOf(byId.values()));
        return diaryIds.stream()
                .map(byId::get)
                .filter(Objects::nonNull)
                .map(diary -> DiarySummaryResponseDto.of(diary, activities.getOrDefault(diary.getId(), List.of())))
                .toList();
    }

    /**
     * Changes only the fields present in the request (spec 4.4). The picture is kept as it
     * is (policy 5).
     */
    @Transactional
    public DiaryDetailResponseDto update(Long memberId, Long diaryId, DiaryUpdateRequestDto request) {
        Diary diary = findForUpdate(memberId, diaryId);
        if (request.emotion() != null) {
            diary.changeEmotion(request.emotion());
        }
        if (request.activities() != null && diary.changeActivities(activitiesFor(request.activities()))) {
            // A collection change alone does not make Hibernate update the diary row (only
            // versioned entities get that), so auditing would never see it. Marking the
            // entity modified changes updated_at, which in turn makes the row dirty.
            auditingHandler.markModified(diary);
        }
        if (request.changesMemo()) {
            diary.changeMemo(request.normalizedMemo());
        }
        // Flush so updatedAt in the response is the value auditing just wrote.
        diaryRepository.flush();
        eventPublisher.publishEvent(new DiaryContentChangedEvent(diaryId));
        return toDetail(diary);
    }

    @Transactional
    public void delete(Long memberId, Long diaryId) {
        findForUpdate(memberId, diaryId).delete(clock);
        eventPublisher.publishEvent(new DiaryContentChangedEvent(diaryId));
    }

    private Diary find(Long memberId, Long diaryId) {
        return diaryRepository.findByIdAndMemberIdAndDeletedAtIsNull(diaryId, memberId)
                .orElseThrow(() -> notFound(diaryId));
    }

    /** For writes; see {@link DiaryRepository#findForUpdate} for why reads cannot be shared. */
    private Diary findForUpdate(Long memberId, Long diaryId) {
        return diaryRepository.findForUpdate(diaryId, memberId).orElseThrow(() -> notFound(diaryId));
    }

    private static BusinessException notFound(Long diaryId) {
        return new BusinessException(CommonErrorCode.NOT_FOUND, "diary not found: diaryId=" + diaryId);
    }

    /**
     * @throws BusinessException {@code 400 INVALID_INPUT} for a code whose chip has been
     *                           switched off; the enum alone cannot tell
     */
    private List<Activity> activitiesFor(Collection<ActivityCode> codes) {
        if (codes.isEmpty()) {
            return List.of();
        }
        List<Activity> activities = activityRepository.findByCodeInAndActiveTrue(codes);
        if (activities.size() != codes.size()) {
            throw new BusinessException(CommonErrorCode.INVALID_INPUT, "inactive activity in " + codes);
        }
        return activities;
    }

    private Map<Long, List<ActivityCode>> activityCodesOf(List<Diary> diaries) {
        if (diaries.isEmpty()) {
            return Map.of();
        }
        List<Long> ids = diaries.stream().map(Diary::getId).toList();
        return diaryRepository.findActivityCodes(ids).stream()
                .collect(Collectors.groupingBy(
                        DiaryActivityRow::diaryId,
                        Collectors.mapping(DiaryActivityRow::code, Collectors.toList())));
    }

    private DiaryDetailResponseDto toDetail(Diary diary) {
        List<ActivityCode> activities = diary.getActivities().stream()
                .sorted(Comparator.comparingInt(Activity::getSortOrder))
                .map(Activity::getCode)
                .toList();
        return new DiaryDetailResponseDto(
                diary.getId(),
                diary.getRecordDate(),
                diary.getEmotion(),
                activities,
                diary.getMemo(),
                diary.getTitle(),
                imageOf(diary),
                diary.getCreatedAt(),
                diary.getUpdatedAt());
    }

    private DiaryDetailResponseDto.Image imageOf(Diary diary) {
        if (diary.getCurrentImageId() == null) {
            return null;
        }
        DiaryImage image = diaryImageRepository.findById(diary.getCurrentImageId()).orElse(null);
        if (image == null) {
            return null;
        }
        if (image.getStatus() != ImageStatus.SUCCEEDED || image.getImageKey() == null) {
            return new DiaryDetailResponseDto.Image(image.getId(), image.getStatus(), null, null);
        }
        return imageUrlSigner.sign(image.getImageKey())
                .map(url -> new DiaryDetailResponseDto.Image(
                        image.getId(), image.getStatus(), url.url(), url.expiresAt()))
                .orElseGet(() -> new DiaryDetailResponseDto.Image(image.getId(), image.getStatus(), null, null));
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
