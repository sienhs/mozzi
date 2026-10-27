package com.ssafy.mozzi.domain.image.entity;

/**
 * Lifecycle of one image generation attempt (API spec 2.3).
 */
public enum ImageStatus {
    PENDING,
    GENERATING,
    SUCCEEDED,
    FAILED
}
