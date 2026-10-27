package com.ssafy.mozzi.domain.diary.exception;

import com.ssafy.mozzi.global.exception.BusinessException;

/**
 * The day already has a diary. Carries its id because the app opens it instead of showing
 * an error (spec 4.4).
 */
public class DiaryAlreadyExistsException extends BusinessException {

    private final Long diaryId;

    public DiaryAlreadyExistsException(Long diaryId) {
        super(DiaryErrorCode.DIARY_ALREADY_EXISTS, "diary already exists: diaryId=" + diaryId);
        this.diaryId = diaryId;
    }

    public Long diaryId() {
        return diaryId;
    }

}
