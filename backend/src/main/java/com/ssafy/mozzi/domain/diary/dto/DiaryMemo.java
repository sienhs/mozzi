package com.ssafy.mozzi.domain.diary.dto;

/**
 * Memo rules shared by create and update (spec 4.4).
 */
final class DiaryMemo {

    static final int MAX_LENGTH = 100;
    static final String TOO_LONG = "100자 이하로 입력해 주세요.";

    private DiaryMemo() {
    }

    /**
     * Strips surrounding whitespace before the length check, as the spec asks, and treats a
     * memo that is empty afterwards as no memo. Card titles fall back to the AI title only
     * when the memo is absent, so a memo of spaces must not count as one.
     */
    static String normalize(String memo) {
        if (memo == null) {
            return null;
        }
        String stripped = memo.strip();
        return stripped.isEmpty() ? null : stripped;
    }

}
