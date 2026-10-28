package com.ssafy.mozzi.domain.diary.service;

/**
 * Published when what a member wrote changed: a diary was saved, edited or deleted.
 *
 * <p>Carries only the id. Listeners run after the commit and read the diary as it is then,
 * so a burst of edits cannot hand them an outdated copy, and a deleted diary simply reads as
 * gone. Emotion search uses it to keep the diary's embedding current.
 */
public record DiaryContentChangedEvent(Long diaryId) {
}
