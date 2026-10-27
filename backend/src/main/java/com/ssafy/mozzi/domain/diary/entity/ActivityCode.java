package com.ssafy.mozzi.domain.diary.entity;

/**
 * Codes of the activity chips on R-02 (API spec 2.2).
 *
 * <p>Labels and display order live in the {@code activity} table, not here, so they can be
 * managed without a release once the activity tag menu opens.
 */
public enum ActivityCode {
    STUDY,
    WORK,
    EXERCISE,
    REST,
    FRIEND,
    HOBBY,
    FAMILY,
    ETC
}
