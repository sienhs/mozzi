package com.ssafy.mozzi.domain.image.entity;

/**
 * Why an attempt ended in {@link ImageStatus#FAILED} (API spec 4.5).
 */
public enum ImageFailureCode {
    GENERATION_TIMEOUT,
    MODEL_ERROR,
    CONTENT_BLOCKED,
    STORAGE_ERROR
}
