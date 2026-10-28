package com.ssafy.mozzi.domain.image.entity;

/**
 * Lifecycle of a diary's picture. {@link #FAILED} can go back to {@link #PENDING} when the
 * member asks again.
 *
 * <p>There is no "generating" state: the AI server only reports the result.
 */
public enum ImageStatus {
    PENDING,
    SUCCEEDED,
    FAILED
}
