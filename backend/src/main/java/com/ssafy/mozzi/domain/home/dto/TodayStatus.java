package com.ssafy.mozzi.domain.home.dto;

/**
 * Which home screen today calls for.
 *
 * <p>{@link #IMAGE_NOT_REQUESTED} means no picture row yet. The app asks for the picture right
 * after saving, so this lasts a moment, or stays when that request never arrived. It has no
 * screen of its own: the app shows E-01 with a button that sends the same request.
 */
public enum TodayStatus {
    /** H-01 */
    NOT_RECORDED,
    /** E-01 */
    IMAGE_NOT_REQUESTED,
    /** H-03 */
    IMAGE_PENDING,
    /** H-02 */
    COMPLETED,
    /** E-01 */
    IMAGE_FAILED
}
