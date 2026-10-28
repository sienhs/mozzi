package com.ssafy.mozzi.domain.emoticon.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import com.ssafy.mozzi.domain.diary.entity.Emotion;
import com.ssafy.mozzi.global.entity.BaseTimeEntity;

/**
 * The face picked for a diary's emotion; one per {@link Emotion} (ERD {@code emoticon}).
 *
 * <p>Rows are registered by the server outside the migrations, so the application only reads
 * them: no id generation and no setters.
 */
@Entity
@Table(name = "emoticon")
public class Emoticon extends BaseTimeEntity {

    @Id
    @Column(name = "emoticon_id")
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Emotion emotion;

    /** Public S3 URL. */
    @Column(name = "image_url", nullable = false)
    private String imageUrl;

    protected Emoticon() {
        // JPA
    }

    public Long getId() {
        return id;
    }

    public Emotion getEmotion() {
        return emotion;
    }

    public String getImageUrl() {
        return imageUrl;
    }

}
