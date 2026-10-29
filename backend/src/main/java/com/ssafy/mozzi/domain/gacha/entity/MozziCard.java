package com.ssafy.mozzi.domain.gacha.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import com.ssafy.mozzi.domain.diary.entity.Emotion;

/**
 * A collectible card (ERD {@code mozzi_card}). Registered by the server outside migrations;
 * only active cards are drawn, exchanged or listed.
 */
@Entity
@Table(name = "mozzi_card")
public class MozziCard {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "card_id")
    private Long id;

    /** {@code S2-04-01}: set, mozzi and emotion number. The collection sorts by it within a tier. */
    @Column(nullable = false, length = 12)
    private String code;

    @Column(nullable = false, length = 20)
    private String series;

    @Column(nullable = false, length = 30)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private CardTier tier;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Emotion emotion;

    /** Public S3 key, such as {@code GACHA/{code}_{source file}_{emotion}.png}. */
    @Column(name = "image_key", nullable = false, length = 100)
    private String imageKey;

    @Column(name = "is_active", nullable = false)
    private boolean active;

    /** The card's look in English, for the picture. Null for cards registered without one. */
    @Column(length = 200)
    private String prompt;

    protected MozziCard() {
        // JPA
    }

    /** An active card, as {@code MozziCardSeeder} registers it. */
    public static MozziCard register(String code, String series, String name, CardTier tier,
            Emotion emotion, String imageKey, String prompt) {
        MozziCard card = new MozziCard();
        card.code = code;
        card.series = series;
        card.name = name;
        card.tier = tier;
        card.emotion = emotion;
        card.imageKey = imageKey;
        card.prompt = prompt;
        card.active = true;
        return card;
    }

    public Long getId() {
        return id;
    }

    public String getCode() {
        return code;
    }

    public String getSeries() {
        return series;
    }

    public String getName() {
        return name;
    }

    public CardTier getTier() {
        return tier;
    }

    public Emotion getEmotion() {
        return emotion;
    }

    public String getImageKey() {
        return imageKey;
    }

    public boolean isActive() {
        return active;
    }

    public String getPrompt() {
        return prompt;
    }

}
