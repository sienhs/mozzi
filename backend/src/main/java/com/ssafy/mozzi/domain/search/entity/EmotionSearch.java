package com.ssafy.mozzi.domain.search.entity;

import java.time.OffsetDateTime;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * One question and how it was answered (ERD {@code emotion_search}).
 *
 * <p>Written once, when the answer or the failure is known, and never changed — so it has
 * no {@code updated_at} and does not extend {@code BaseTimeEntity}.
 *
 * <p>{@code interpreted_filter} is mapped as JSON text and serialised by the application's
 * mapper. Letting Hibernate serialise an object would pick its own JSON library, which here
 * is the Jackson 2 that springdoc drags in (convention 5.2), with none of the application's
 * date settings.
 */
@Entity
@Table(name = "emotion_search")
public class EmotionSearch {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "emotion_search_id")
    private Long id;

    @Column(name = "member_id", nullable = false)
    private Long memberId;

    /** The member's own words. Never logged (convention 5.4). */
    @Column(nullable = false, length = 200)
    private String question;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "interpreted_filter")
    private String interpretedFilter;

    @Enumerated(EnumType.STRING)
    @Column(name = "result_type", nullable = false, length = 12)
    private SearchResultType resultType;

    @Column(length = 500)
    private String answer;

    @Column(name = "latency_ms")
    private Integer latencyMs;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    protected EmotionSearch() {
        // JPA
    }

    private EmotionSearch(Long memberId, String question, String interpretedFilter, SearchResultType resultType,
            String answer, Integer latencyMs, OffsetDateTime createdAt) {
        this.memberId = memberId;
        this.question = question;
        this.interpretedFilter = interpretedFilter;
        this.resultType = resultType;
        this.answer = answer;
        this.latencyMs = latencyMs;
        this.createdAt = createdAt;
    }

    /**
     * @param interpretedFilter JSON of the conditions, or {@code null} when the question
     *                          failed before they were known
     * @param answer            {@code null} for {@link SearchResultType#EMPTY} and
     *                          {@link SearchResultType#FAILED}
     */
    public static EmotionSearch record(Long memberId, String question, String interpretedFilter,
            SearchResultType resultType, String answer, int latencyMs, OffsetDateTime createdAt) {
        return new EmotionSearch(memberId, question, interpretedFilter, resultType, answer, latencyMs, createdAt);
    }

    public Long getId() {
        return id;
    }

    public Long getMemberId() {
        return memberId;
    }

    public String getQuestion() {
        return question;
    }

    public String getInterpretedFilter() {
        return interpretedFilter;
    }

    public SearchResultType getResultType() {
        return resultType;
    }

    public String getAnswer() {
        return answer;
    }

    public Integer getLatencyMs() {
        return latencyMs;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

}
