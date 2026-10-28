package com.ssafy.mozzi.domain.search.entity;

import java.io.Serializable;
import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

@Embeddable
public record EmotionSearchResultId(
        @Column(name = "emotion_search_id") Long emotionSearchId,
        @Column(name = "diary_id") Long diaryId) implements Serializable {
}
