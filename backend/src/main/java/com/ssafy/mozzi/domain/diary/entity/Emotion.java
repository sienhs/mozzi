package com.ssafy.mozzi.domain.diary.entity;

/**
 * The mood picked on R-01 (API spec 2.1, design system Mozzi/Emotion).
 *
 * <p>The face artwork ships with the app, so the server only sends the code. Label and colour
 * are kept here for responses that need them ({@code GET /meta}) and for the emotion search
 * answer text. {@link #NEUTRAL} and {@link #ANGRY} have no colour token in the design system
 * yet.
 */
public enum Emotion {

    HAPPY("행복", "happy", "#F3D889"),
    CALM("평온", "calm", "#B8CBA8"),
    NEUTRAL("보통", null, null),
    SAD("우울", "sad", "#B8C5DD"),
    ANGRY("화남", null, null);

    private final String label;
    private final String colorToken;
    private final String colorHex;

    Emotion(String label, String colorToken, String colorHex) {
        this.label = label;
        this.colorToken = colorToken;
        this.colorHex = colorHex;
    }

    public String label() {
        return label;
    }

    /** Design-system token name, or {@code null} when the design has none yet. */
    public String colorToken() {
        return colorToken;
    }

    /** Hex value of {@link #colorToken()}, or {@code null} when the design has none yet. */
    public String colorHex() {
        return colorHex;
    }

}
