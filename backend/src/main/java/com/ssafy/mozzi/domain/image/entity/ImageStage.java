package com.ssafy.mozzi.domain.image.entity;

/**
 * Progress step inside {@link ImageStatus#GENERATING}, shown on the G-01 progress bar
 * (API spec 2.3).
 */
public enum ImageStage {
    ANALYZING,
    COMPOSING,
    DRAWING,
    FINISHING
}
