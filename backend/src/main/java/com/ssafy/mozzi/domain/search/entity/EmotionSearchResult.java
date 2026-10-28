package com.ssafy.mozzi.domain.search.entity;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PostPersist;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;

import org.springframework.data.domain.Persistable;

/**
 * A diary an answer was based on (ERD {@code emotion_search_result}).
 *
 * <p>The key is assigned, not generated, so Spring Data cannot tell a new row from an
 * existing one and would {@code select} each row before inserting it. {@link Persistable}
 * says "new" until the row is persisted or loaded.
 */
@Entity
@Table(name = "emotion_search_result")
public class EmotionSearchResult implements Persistable<EmotionSearchResultId> {

    @EmbeddedId
    private EmotionSearchResultId id;

    /** Display order, from 1. */
    @Column(name = "rank_no", nullable = false)
    private int rankNo;

    /** The big card ({@code featured}); at most one per search (partial unique index). */
    @Column(name = "is_featured", nullable = false)
    private boolean featured;

    @Transient
    private boolean isNew = true;

    protected EmotionSearchResult() {
        // JPA
    }

    private EmotionSearchResult(Long emotionSearchId, Long diaryId, int rankNo, boolean featured) {
        this.id = new EmotionSearchResultId(emotionSearchId, diaryId);
        this.rankNo = rankNo;
        this.featured = featured;
    }

    public static EmotionSearchResult of(Long emotionSearchId, Long diaryId, int rankNo, boolean featured) {
        return new EmotionSearchResult(emotionSearchId, diaryId, rankNo, featured);
    }

    @Override
    public EmotionSearchResultId getId() {
        return id;
    }

    @Override
    public boolean isNew() {
        return isNew;
    }

    @PostPersist
    @PostLoad
    void markNotNew() {
        this.isNew = false;
    }

    public int getRankNo() {
        return rankNo;
    }

    public boolean isFeatured() {
        return featured;
    }

}
