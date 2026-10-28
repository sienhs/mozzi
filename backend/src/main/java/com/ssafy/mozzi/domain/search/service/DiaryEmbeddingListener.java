package com.ssafy.mozzi.domain.search.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;

import com.ssafy.mozzi.domain.diary.service.DiaryContentChangedEvent;
import com.ssafy.mozzi.integration.gms.GmsUnavailableException;

/**
 * Refreshes a diary's embedding right after it was saved, edited or deleted, so a new memo
 * can be found by meaning straight away.
 *
 * <p>After the commit, so a rolled-back write never reaches GMS; asynchronous, so saving a
 * diary never waits for GMS or fails because of it. A refresh that fails here is picked up
 * by {@link DiaryEmbeddingSweeper}.
 */
@Component
public class DiaryEmbeddingListener {

    private static final Logger log = LoggerFactory.getLogger(DiaryEmbeddingListener.class);

    private final DiaryEmbeddingService diaryEmbeddingService;

    public DiaryEmbeddingListener(DiaryEmbeddingService diaryEmbeddingService) {
        this.diaryEmbeddingService = diaryEmbeddingService;
    }

    @Async
    @TransactionalEventListener
    public void onContentChanged(DiaryContentChangedEvent event) {
        try {
            diaryEmbeddingService.refresh(event.diaryId());
        } catch (GmsUnavailableException e) {
            log.warn("diary embedding deferred to the sweep: diaryId={} cause={}", event.diaryId(), e.getMessage());
        }
    }

}
