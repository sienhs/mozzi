package com.ssafy.mozzi.domain.image.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import com.ssafy.mozzi.global.entity.BaseTimeEntity;

/**
 * A diary's picture (ERD {@code diary_image}). One row per diary.
 *
 * <p>A request after a failure resets this row rather than adding another. Only a request
 * that has settled as {@link ImageStatus#FAILED} can be asked again, and a pending one
 * cannot be replaced. That is what lets a result from the AI server carry nothing but the
 * diary id: while a request is pending it is the only one the result can belong to.
 *
 * <p>{@link #failureCount} counts the failures the AI server reported. Once it reaches
 * {@link #MAX_FAILURES} the diary cannot ask again. A request that never reached the queue
 * is not the member's failure and is not counted.
 *
 * <p>Every state change starts from the diary row lock ({@code DiaryRepository}), so a
 * result and a new request never interleave.
 */
@Entity
@Table(name = "diary_image")
public class DiaryImage extends BaseTimeEntity {

    /** Failures allowed per diary, so at most three failed pictures in all. */
    public static final int MAX_FAILURES = 3;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "diary_image_id")
    private Long id;

    @Column(name = "diary_id", nullable = false)
    private Long diaryId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private ImageStatus status;

    @Column(name = "failure_count", nullable = false)
    private int failureCount;

    /** No association yet: the character table arrives with the gacha work. */
    @Column(name = "character_id", nullable = false)
    private Long characterId;

    @Enumerated(EnumType.STRING)
    @Column(name = "time_of_day", length = 10)
    private TimeOfDay timeOfDay;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Weather weather;

    /** Icon names are copied so a deleted icon does not erase what the picture was drawn from. */
    @Column(name = "where_name", length = 10)
    private String whereName;

    @Column(name = "who_name", length = 10)
    private String whoName;

    @Column(name = "what_name", nullable = false, length = 10)
    private String whatName;

    /** Public S3 URL, set once the picture is done. */
    @Column(name = "image_url")
    private String imageUrl;

    protected DiaryImage() {
        // JPA
    }

    private DiaryImage(Long diaryId, Selection selection) {
        this.diaryId = diaryId;
        apply(selection);
    }

    public static DiaryImage request(Long diaryId, Selection selection) {
        return new DiaryImage(diaryId, selection);
    }

    /**
     * Asks again after a failure, with what the member picked this time.
     *
     * @throws IllegalStateException unless {@link #canRetry()}; callers check first so the
     *                               member gets a proper error instead
     */
    public void retry(Selection selection) {
        if (!canRetry()) {
            throw new IllegalStateException("cannot retry: status=" + status + ", failures=" + failureCount);
        }
        apply(selection);
    }

    /**
     * Draws again whatever the picture ended as, for the temporary test API
     * (S15P31D102-132). A finished picture is overwritten. The failure count is left as it is.
     *
     * @throws IllegalStateException while a request is pending; its result could not be told
     *                               apart from the new one's
     */
    public void redrawForTest(Selection selection) {
        if (status == ImageStatus.PENDING) {
            throw new IllegalStateException("cannot redraw while pending");
        }
        apply(selection);
    }

    public boolean canRetry() {
        return status == ImageStatus.FAILED && failureCount < MAX_FAILURES;
    }

    /**
     * Records the finished picture.
     *
     * @return whether anything changed; {@code false} for a duplicate or a request that is no
     *         longer pending
     */
    public boolean succeed(String imageUrl) {
        if (status != ImageStatus.PENDING) {
            return false;
        }
        this.status = ImageStatus.SUCCEEDED;
        this.imageUrl = imageUrl;
        return true;
    }

    /**
     * Records a failure the AI server reported. This one counts toward {@link #MAX_FAILURES}.
     *
     * @return whether anything changed; {@code false} for a duplicate
     */
    public boolean fail() {
        if (status != ImageStatus.PENDING) {
            return false;
        }
        this.status = ImageStatus.FAILED;
        this.failureCount++;
        return true;
    }

    /**
     * Gives up a request that never reached the AI server, without counting a failure.
     *
     * @return whether anything changed
     */
    public boolean abandon() {
        if (status != ImageStatus.PENDING) {
            return false;
        }
        this.status = ImageStatus.FAILED;
        return true;
    }

    private void apply(Selection selection) {
        this.status = ImageStatus.PENDING;
        this.characterId = selection.characterId();
        this.timeOfDay = selection.timeOfDay();
        this.weather = selection.weather() == null ? Weather.NONE : selection.weather();
        this.whereName = selection.whereName();
        this.whoName = selection.whoName();
        this.whatName = selection.whatName();
        this.imageUrl = null;
    }

    public Long getId() {
        return id;
    }

    public Long getDiaryId() {
        return diaryId;
    }

    public ImageStatus getStatus() {
        return status;
    }

    public int getFailureCount() {
        return failureCount;
    }

    public Long getCharacterId() {
        return characterId;
    }

    public TimeOfDay getTimeOfDay() {
        return timeOfDay;
    }

    public Weather getWeather() {
        return weather;
    }

    public String getWhereName() {
        return whereName;
    }

    public String getWhoName() {
        return whoName;
    }

    public String getWhatName() {
        return whatName;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    /**
     * What the member picked for one request.
     *
     * @param timeOfDay optional
     * @param weather   optional; {@code null} is stored as {@link Weather#NONE}
     * @param whereName optional
     * @param whoName   optional
     */
    public record Selection(
            Long characterId,
            TimeOfDay timeOfDay,
            Weather weather,
            String whereName,
            String whoName,
            String whatName) {
    }

}
