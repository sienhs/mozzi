package com.ssafy.mozzi.domain.diary.exception;

import java.util.List;

import com.ssafy.mozzi.global.exception.ErrorResponse;

/**
 * The spec 1.2 error body plus {@code diaryId}, for {@code 409 DIARY_ALREADY_EXISTS} only.
 *
 * <p>Spec 4.4 asks for the existing diary's id in this one error. Adding the field to
 * {@link ErrorResponse} would put a {@code diaryId: null} key on every error of every
 * endpoint, so this response extends the shared shape instead of changing it. The first four
 * fields must stay identical to {@link ErrorResponse}.
 */
public record DiaryConflictResponse(
        String code, String message, List<ErrorResponse.FieldError> fieldErrors, String traceId, Long diaryId) {

    public static DiaryConflictResponse of(DiaryAlreadyExistsException e, String traceId) {
        return new DiaryConflictResponse(e.errorCode().code(), e.userMessage(), null, traceId, e.diaryId());
    }

}
