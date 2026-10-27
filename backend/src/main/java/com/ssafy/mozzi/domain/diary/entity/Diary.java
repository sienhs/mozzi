package com.ssafy.mozzi.domain.diary.entity;

import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.HashSet;
import java.util.Set;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.Table;

import org.hibernate.annotations.DynamicUpdate;
import org.hibernate.annotations.SQLRestriction;

import com.ssafy.mozzi.domain.image.entity.DiaryImage;
import com.ssafy.mozzi.domain.image.entity.ImageStatus;
import com.ssafy.mozzi.global.entity.BaseTimeEntity;

/**
 * One member's record of one day (API spec ERD 5.5).
 *
 * <p>The member is held by id, not by association: every diary query is already scoped by
 * the authenticated member's id, and nothing here needs the member's fields.
 *
 * <p>"One diary per day" is enforced by the partial unique index
 * {@code uq_diary_member_record_date}, not by this class — a check in Java cannot see a
 * concurrent insert.
 *
 * <p>Writes to an existing diary must start from {@code DiaryRepository#findForUpdate}. That
 * includes recording a finished picture: the image worker only generates and uploads, and
 * this application writes its result ({@code title}, {@code image_status}) — possibly while
 * the member is editing the memo.
 *
 * <p>{@link DynamicUpdate} is a second line behind that lock: by default Hibernate writes
 * every column on update, so a writer that did not lock would also write back the columns
 * it never touched, and one of the two changes above would be lost. With it, each update
 * writes only what that writer changed.
 */
@Entity
@Table(name = "diary")
@DynamicUpdate
@SQLRestriction("deleted_at is null")
public class Diary extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "diary_id")
    private Long id;

    @Column(name = "member_id", nullable = false)
    private Long memberId;

    @Column(name = "record_date", nullable = false)
    private LocalDate recordDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Emotion emotion;

    @Column(length = 100)
    private String memo;

    /** Short title the image model writes alongside the picture; null until then. */
    @Column(length = 30)
    private String title;

    /**
     * Never fetched together with a list of diaries: list responses fill activities with a
     * second query by id (convention 4.4), so this stays lazy.
     */
    @ManyToMany
    @JoinTable(
            name = "diary_activity",
            joinColumns = @JoinColumn(name = "diary_id"),
            inverseJoinColumns = @JoinColumn(name = "activity_id"))
    private Set<Activity> activities = new HashSet<>();

    /** The attempt this diary shows; see {@link #showImage}. */
    @Column(name = "current_image_id")
    private Long currentImageId;

    /** Denormalised copy of the current attempt's status, for home and calendar. */
    @Enumerated(EnumType.STRING)
    @Column(name = "image_status", nullable = false, length = 12)
    private ImageStatus imageStatus;

    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;

    protected Diary() {
        // JPA
    }

    private Diary(Long memberId, LocalDate recordDate, Emotion emotion, String memo, Collection<Activity> activities) {
        this.memberId = memberId;
        this.recordDate = recordDate;
        this.emotion = emotion;
        this.memo = memo;
        this.activities.addAll(activities);
        // Saving a diary always queues its first picture (spec 4.4).
        this.imageStatus = ImageStatus.PENDING;
    }

    public static Diary create(
            Long memberId, LocalDate recordDate, Emotion emotion, String memo, Collection<Activity> activities) {
        return new Diary(memberId, recordDate, emotion, memo, activities);
    }

    /**
     * Points the diary at an attempt and mirrors its status.
     *
     * <p>The ERD describes {@code current_image_id} as "the picture to show now". Until
     * redrawing a finished picture exists (v2 G-03, outside the MVP) the latest attempt is
     * always that picture — pending, failed or done — so the diary follows each new attempt.
     */
    public void showImage(DiaryImage image) {
        this.currentImageId = image.getId();
        this.imageStatus = image.getStatus();
    }

    public void changeEmotion(Emotion emotion) {
        this.emotion = emotion;
    }

    /**
     * @return whether the set actually changed. Hibernate does not count a collection change
     *         as a change to this row, so the caller has to move {@code updatedAt} itself.
     */
    public boolean changeActivities(Collection<Activity> activities) {
        Set<Activity> replacement = new HashSet<>(activities);
        if (this.activities.equals(replacement)) {
            return false;
        }
        this.activities.clear();
        this.activities.addAll(replacement);
        return true;
    }

    public void changeMemo(String memo) {
        this.memo = memo;
    }

    /** Soft delete (spec 4.4). The day can be written again afterwards (policy 6). */
    public void delete(Clock clock) {
        this.deletedAt = OffsetDateTime.now(clock);
    }

    public Long getId() {
        return id;
    }

    public Long getMemberId() {
        return memberId;
    }

    public LocalDate getRecordDate() {
        return recordDate;
    }

    public Emotion getEmotion() {
        return emotion;
    }

    public String getMemo() {
        return memo;
    }

    public String getTitle() {
        return title;
    }

    public Set<Activity> getActivities() {
        return activities;
    }

    public Long getCurrentImageId() {
        return currentImageId;
    }

    public ImageStatus getImageStatus() {
        return imageStatus;
    }

    public OffsetDateTime getDeletedAt() {
        return deletedAt;
    }

}
