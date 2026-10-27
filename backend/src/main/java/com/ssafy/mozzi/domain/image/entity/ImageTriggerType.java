package com.ssafy.mozzi.domain.image.entity;

/**
 * Why an attempt was started (API spec ERD 5.7).
 *
 * <p>{@link #USER_REQUEST} ("redraw a finished picture", v2 G-03) is outside the MVP but kept
 * so the column's values are fixed from the start.
 */
public enum ImageTriggerType {
    INITIAL,
    RETRY,
    USER_REQUEST
}
