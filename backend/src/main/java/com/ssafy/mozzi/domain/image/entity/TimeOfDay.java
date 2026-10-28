package com.ssafy.mozzi.domain.image.entity;

/**
 * Time of day the picture shows, picked when requesting it.
 *
 * <p>Fixed values, so the English for the image prompt is kept here instead of going through
 * the translator.
 */
public enum TimeOfDay {

    MORNING("in the morning"),
    LUNCH("at lunchtime"),
    EVENING("in the evening");

    private final String english;

    TimeOfDay(String english) {
        this.english = english;
    }

    public String english() {
        return english;
    }

}
