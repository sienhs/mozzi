package com.ssafy.mozzi.domain.image.entity;

import java.time.Clock;
import java.time.OffsetDateTime;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * One image generation attempt for a diary (API spec ERD 5.7).
 *
 * <p>The diary is referenced by id rather than by association: the image worker only ever
 * needs the id, and keeping the two apart stops a diary load from dragging its whole attempt
 * history along.
 *
 * <p>No {@code BaseTimeEntity}: the ERD gives this table {@code requested_at},
 * {@code started_at} and {@code completed_at}, which say more than created/updated would.
 */
@Entity
@Table(name = "diary_image")
public class DiaryImage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "diary_image_id")
    private Long id;

    @Column(name = "diary_id", nullable = false)
    private Long diaryId;

    @Column(name = "attempt_no", nullable = false)
    private int attemptNo;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private ImageStatus status;

    @Enumerated(EnumType.STRING)
    @Column(length = 12)
    private ImageStage stage;

    @Enumerated(EnumType.STRING)
    @Column(name = "trigger_type", nullable = false, length = 12)
    private ImageTriggerType triggerType;

    /** Contains diary text. Never log it (convention 5.4). */
    @Column(columnDefinition = "text")
    private String prompt;

    @Column(length = 50)
    private String model;

    /** Private S3 key; the URL is presigned per request and never stored. */
    @Column(name = "image_key")
    private String imageKey;

    @Enumerated(EnumType.STRING)
    @Column(name = "failure_code", length = 30)
    private ImageFailureCode failureCode;

    @Column(name = "requested_at", nullable = false)
    private OffsetDateTime requestedAt;

    @Column(name = "started_at")
    private OffsetDateTime startedAt;

    @Column(name = "completed_at")
    private OffsetDateTime completedAt;

    protected DiaryImage() {
        // JPA
    }

    private DiaryImage(Long diaryId, int attemptNo, ImageTriggerType triggerType, OffsetDateTime requestedAt) {
        this.diaryId = diaryId;
        this.attemptNo = attemptNo;
        this.triggerType = triggerType;
        this.status = ImageStatus.PENDING;
        this.requestedAt = requestedAt;
    }

    /** The attempt queued when a diary is saved (spec 4.4 {@code POST /diaries}). */
    public static DiaryImage initial(Long diaryId, Clock clock) {
        return new DiaryImage(diaryId, 1, ImageTriggerType.INITIAL, OffsetDateTime.now(clock));
    }

    public Long getId() {
        return id;
    }

    public Long getDiaryId() {
        return diaryId;
    }

    public int getAttemptNo() {
        return attemptNo;
    }

    public ImageStatus getStatus() {
        return status;
    }

    public ImageStage getStage() {
        return stage;
    }

    public ImageTriggerType getTriggerType() {
        return triggerType;
    }

    public String getModel() {
        return model;
    }

    public String getImageKey() {
        return imageKey;
    }

    public ImageFailureCode getFailureCode() {
        return failureCode;
    }

    public OffsetDateTime getRequestedAt() {
        return requestedAt;
    }

    public OffsetDateTime getStartedAt() {
        return startedAt;
    }

    public OffsetDateTime getCompletedAt() {
        return completedAt;
    }

}
