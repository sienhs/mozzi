package com.ssafy.mozzi.domain.search.service;

import java.time.Clock;
import java.time.OffsetDateTime;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.mozzi.domain.search.repository.EmotionSearchRepository;
import com.ssafy.mozzi.domain.search.repository.EmotionSearchResultRepository;

/**
 * Deletes questions older than {@value #RETENTION_DAYS} days, once a day (API decision #5).
 *
 * <p>Unlike {@code ExpiredAuthDataCleaner} this is not housekeeping: the retention period is
 * a promise to the member, so a question must not outlive it. A run that fails is caught up
 * by the next one, which deletes everything past the cutoff, not one day's worth. Each pod
 * runs it; the deletes are idempotent.
 */
@Component
public class ExpiredEmotionSearchCleaner {

    private static final Logger log = LoggerFactory.getLogger(ExpiredEmotionSearchCleaner.class);

    static final int RETENTION_DAYS = 90;

    private final EmotionSearchRepository emotionSearchRepository;
    private final EmotionSearchResultRepository emotionSearchResultRepository;
    private final Clock clock;

    public ExpiredEmotionSearchCleaner(EmotionSearchRepository emotionSearchRepository,
            EmotionSearchResultRepository emotionSearchResultRepository, Clock clock) {
        this.emotionSearchRepository = emotionSearchRepository;
        this.emotionSearchResultRepository = emotionSearchResultRepository;
        this.clock = clock;
    }

    /**
     * Both deletes share the cutoff and the transaction, so a question cannot lose its
     * result rows and survive, or the other way round.
     */
    @Scheduled(cron = "0 40 4 * * *", zone = "Asia/Seoul")
    @Transactional
    public void deleteExpired() {
        OffsetDateTime cutoff = OffsetDateTime.now(clock).minusDays(RETENTION_DAYS);
        int results = emotionSearchResultRepository.deleteCreatedBefore(cutoff);
        int searches = emotionSearchRepository.deleteCreatedBefore(cutoff);
        log.info("expired emotion searches deleted: searches={} results={}", searches, results);
    }

}
