package com.ssafy.mozzi.domain.search.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.ssafy.mozzi.integration.gms.GmsUnavailableException;

/**
 * Catches up on embeddings the change events did not leave current: refreshes that failed,
 * diaries written before this existed, rows of a previous model, and the picture worker's
 * writes, which publish no event.
 *
 * <p>Each pod runs it. Two pods sweeping at once embed the same diaries twice, which costs a
 * few tokens and writes the same rows; the version check keeps the result correct.
 */
@Component
public class DiaryEmbeddingSweeper {

    private static final Logger log = LoggerFactory.getLogger(DiaryEmbeddingSweeper.class);

    /** One GMS call per sweep; at about 50 tokens a diary, far below the API's limits. */
    static final int BATCH = 100;

    private final DiaryEmbeddingService diaryEmbeddingService;

    public DiaryEmbeddingSweeper(DiaryEmbeddingService diaryEmbeddingService) {
        this.diaryEmbeddingService = diaryEmbeddingService;
    }

    /**
     * A backlog drains {@value #BATCH} diaries per run rather than in one burst, so a model
     * change or the first deploy cannot flood GMS. Disabled in tests ({@code "-"}).
     */
    @Scheduled(cron = "${mozzi.search.embedding-sweep-cron}", zone = "Asia/Seoul")
    public void sweep() {
        try {
            DiaryEmbeddingService.SweepResult result = diaryEmbeddingService.sweep(BATCH);
            if (result.deleted() > 0 || result.refreshed() > 0) {
                log.info("diary embeddings swept: deleted={} refreshed={}", result.deleted(), result.refreshed());
            }
        } catch (GmsUnavailableException e) {
            log.warn("diary embedding sweep failed, retrying next run: cause={}", e.getMessage());
        }
    }

}
