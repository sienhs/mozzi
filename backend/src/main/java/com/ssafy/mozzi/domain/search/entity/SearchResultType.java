package com.ssafy.mozzi.domain.search.entity;

/**
 * {@code resultType} from API spec emotion-search.md, plus {@link #FAILED}, which is stored
 * but never sent: a failed question answers 503 instead.
 */
public enum SearchResultType {

    /** The diaries are the answer. */
    FOUND,
    /** No diary matched (E-04); there is no answer text. */
    EMPTY,
    /** A question about counts ("이번 달엔 어떤 기분이 많았어?"); the stats are the answer. */
    STATS_ONLY,
    /** GMS gave no usable answer (E-05). Kept so the per-minute limit counts retries too. */
    FAILED
}
