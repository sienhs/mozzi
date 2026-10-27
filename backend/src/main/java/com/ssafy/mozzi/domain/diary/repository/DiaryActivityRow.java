package com.ssafy.mozzi.domain.diary.repository;

import com.ssafy.mozzi.domain.diary.entity.ActivityCode;

/**
 * One {@code diary_activity} pair, as read by {@link DiaryRepository#findActivityCodes}.
 */
public record DiaryActivityRow(Long diaryId, ActivityCode code) {
}
