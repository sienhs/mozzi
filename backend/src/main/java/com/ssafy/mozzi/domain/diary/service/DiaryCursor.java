package com.ssafy.mozzi.domain.diary.service;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.Base64;

import com.ssafy.mozzi.global.exception.BusinessException;
import com.ssafy.mozzi.global.exception.CommonErrorCode;

/**
 * Position in the {@code GET /diaries} order: the last row's {@code (record_date, diary_id)}.
 *
 * <p>Base64url so the client treats it as opaque (convention 4.3). The id is part of it even
 * though one live diary per day makes the date unique today — see
 * {@code DiaryRepository#search}.
 */
record DiaryCursor(LocalDate recordDate, Long diaryId) {

    private static final String SEPARATOR = "_";

    String encode() {
        String raw = recordDate + SEPARATOR + diaryId;
        return Base64.getUrlEncoder().withoutPadding().encodeToString(raw.getBytes(StandardCharsets.UTF_8));
    }

    /**
     * @throws BusinessException {@code 400 INVALID_INPUT} for anything that is not a cursor
     *                           this class produced. Falling back to the first page instead
     *                           would make an infinite scroll repeat the same page forever.
     */
    static DiaryCursor decode(String cursor) {
        try {
            String raw = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8);
            int separator = raw.indexOf(SEPARATOR);
            return new DiaryCursor(
                    LocalDate.parse(raw.substring(0, separator)), Long.parseLong(raw.substring(separator + 1)));
        } catch (RuntimeException e) {
            throw new BusinessException(CommonErrorCode.INVALID_INPUT, "unreadable diary cursor", e);
        }
    }

}
