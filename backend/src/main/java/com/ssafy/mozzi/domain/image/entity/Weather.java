package com.ssafy.mozzi.domain.image.entity;

/**
 * Weather the picture shows, picked when requesting it. {@link #NONE} when the member did not
 * pick one.
 *
 * <p>Fixed values, so the English for the image prompt is kept here instead of going through
 * the translator.
 */
public enum Weather {

    NONE(""),
    SUNNY("on a sunny day"),
    CLOUDY("on a cloudy day"),
    RAINY("on a rainy day"),
    SNOWY("on a snowy day");

    private final String english;

    Weather(String english) {
        this.english = english;
    }

    /** Empty for {@link #NONE}. */
    public String english() {
        return english;
    }

}
