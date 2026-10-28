package com.ssafy.mozzi.domain.diary.entity;

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

import com.ssafy.mozzi.domain.emoticon.entity.Emoticon;
import com.ssafy.mozzi.domain.icon.entity.MyIcon;
import com.ssafy.mozzi.domain.image.entity.ImageStatus;
import com.ssafy.mozzi.global.entity.BaseTimeEntity;

/**
 * One member's record of one day (ERD {@code diary}).
 *
 * <p>The member and the emoticon are held by id, not by association: every diary query is
 * already scoped by the member's id, and the emotion the app shows is copied onto the diary.
 *
 * <p>"One diary per day" is enforced by the partial unique index
 * {@code uq_diary_member_record_date}, not by this class — a check in Java cannot see a
 * concurrent insert.
 *
 * <p>Writes to an existing diary must start from {@code DiaryRepository#findForUpdate}. Today
 * that is the picture request, which must not let two requests both see "no picture yet".
 * {@link DynamicUpdate} keeps an update to only the columns it changed.
 */
@Entity
@Table(name = "diary")
@DynamicUpdate
@SQLRestriction("deleted_at is null")
public class Diary extends BaseTimeEntity {

    public static final int CONTENT_MAX_LENGTH = 50;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "diary_id")
    private Long id;

    @Column(name = "member_id", nullable = false)
    private Long memberId;

    /** The day the diary was written, in the service timezone. */
    @Column(name = "record_date", nullable = false)
    private LocalDate recordDate;

    @Column(name = "emoticon_id", nullable = false)
    private Long emoticonId;

    /** Copy of the emoticon's emotion, so the calendar and the emotion filter need no join. */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Emotion emotion;

    /** The one-line diary, or {@code null}. */
    @Column(length = CONTENT_MAX_LENGTH)
    private String content;

    /**
     * Never fetched together with a list of diaries. Deleted icons are filtered out by the
     * restriction on {@link MyIcon}.
     */
    @ManyToMany
    @JoinTable(
            name = "diary_icon",
            joinColumns = @JoinColumn(name = "diary_id"),
            inverseJoinColumns = @JoinColumn(name = "my_icon_id"))
    private Set<MyIcon> myIcons = new HashSet<>();

    /** Copy of {@code diary_image.status}; {@code null} until a picture is requested. */
    @Enumerated(EnumType.STRING)
    @Column(name = "diary_image_status", length = 12)
    private ImageStatus diaryImageStatus;

    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;

    protected Diary() {
        // JPA
    }

    private Diary(Long memberId, LocalDate recordDate, Emoticon emoticon, String content, Collection<MyIcon> myIcons) {
        this.memberId = memberId;
        this.recordDate = recordDate;
        this.emoticonId = emoticon.getId();
        this.emotion = emoticon.getEmotion();
        this.content = content;
        this.myIcons.addAll(myIcons);
    }

    public static Diary create(
            Long memberId, LocalDate recordDate, Emoticon emoticon, String content, Collection<MyIcon> myIcons) {
        return new Diary(memberId, recordDate, emoticon, content, myIcons);
    }

    /** Mirrors the picture's status; change both in the same transaction. */
    public void showImageStatus(ImageStatus status) {
        this.diaryImageStatus = status;
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

    public Long getEmoticonId() {
        return emoticonId;
    }

    public Emotion getEmotion() {
        return emotion;
    }

    public String getContent() {
        return content;
    }

    public Set<MyIcon> getMyIcons() {
        return myIcons;
    }

    public ImageStatus getDiaryImageStatus() {
        return diaryImageStatus;
    }

    public OffsetDateTime getDeletedAt() {
        return deletedAt;
    }

}
