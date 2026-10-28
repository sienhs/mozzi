package com.ssafy.mozzi.domain.search.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import com.ssafy.mozzi.domain.search.repository.DiaryEmbeddingStore;
import com.ssafy.mozzi.domain.search.repository.DiaryEmbeddingStore.Built;
import com.ssafy.mozzi.domain.search.repository.DiaryEmbeddingStore.Source;
import com.ssafy.mozzi.integration.gms.GmsEmbeddingClient;
import com.ssafy.mozzi.integration.gms.GmsProperties;
import com.ssafy.mozzi.integration.gms.GmsUnavailableException;

/**
 * Keeps {@code diary_embedding} in step with the diaries, for ranking emotion search
 * candidates by meaning (ERD {@code diary_embedding}).
 *
 * <p>Only diaries with a memo are embedded. Date, emotion and activities are filtered by SQL
 * already, so a diary without words has nothing for a meaning search to find — and its
 * diary need not leave for GMS at all.
 *
 * <p>No transaction is held across the GMS call. Each write runs in a short transaction of
 * its own that re-checks the diary first ({@link DiaryEmbeddingStore#lockIfCurrent}), and
 * the version check in {@link DiaryEmbeddingStore#upsert} settles two builds racing for one
 * row.
 */
@Service
public class DiaryEmbeddingService {

    private final DiaryEmbeddingStore store;
    private final GmsEmbeddingClient embeddingClient;
    private final GmsProperties gmsProperties;
    private final TransactionTemplate transactionTemplate;
    private final Clock clock;

    public DiaryEmbeddingService(DiaryEmbeddingStore store, GmsEmbeddingClient embeddingClient,
            GmsProperties gmsProperties, PlatformTransactionManager transactionManager, Clock clock) {
        this.store = store;
        this.embeddingClient = embeddingClient;
        this.gmsProperties = gmsProperties;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
        this.clock = clock;
    }

    /**
     * Brings one diary's row up to date: built, rebuilt, marked current, or deleted when the
     * diary is gone or has no memo.
     *
     * @throws GmsUnavailableException the embedding could not be made; the sweep retries
     */
    public void refresh(Long diaryId) {
        Optional<Source> source = store.source(diaryId);
        if (source.isEmpty() || source.get().memo() == null) {
            store.delete(diaryId);
            return;
        }
        refreshAll(List.of(source.get()));
    }

    /**
     * One sweep: drops rows that outlived their memo, then rebuilds up to {@code limit}
     * stale ones in a single GMS call.
     *
     * @return rows deleted and rows brought up to date
     * @throws GmsUnavailableException the embeddings could not be made; nothing was written
     *                                 for the stale rows
     */
    public SweepResult sweep(int limit) {
        int deleted = store.deleteOrphans();
        List<Source> stale = store.stale(gmsProperties.embeddingModelId(), limit);
        refreshAll(stale);
        return new SweepResult(deleted, stale.size());
    }

    public record SweepResult(int deleted, int refreshed) {
    }

    private void refreshAll(List<Source> sources) {
        String model = gmsProperties.embeddingModelId();
        List<Source> toEmbed = new ArrayList<>();
        List<String> texts = new ArrayList<>();
        for (Source source : sources) {
            String text = text(source);
            String hash = sha256(text);
            Optional<Built> built = store.built(source.diaryId());
            boolean sameText = built.isPresent() && built.get().model().equals(model)
                    && built.get().contentHash().equals(hash);
            if (sameText && store.markCurrent(source.diaryId(), model, hash, source.version())) {
                continue;
            }
            toEmbed.add(source);
            texts.add(text);
        }
        if (toEmbed.isEmpty()) {
            return;
        }
        List<float[]> vectors = embeddingClient.embedAll(texts);
        OffsetDateTime now = OffsetDateTime.now(clock);
        for (int i = 0; i < toEmbed.size(); i++) {
            Source source = toEmbed.get(i);
            String hash = sha256(texts.get(i));
            float[] vector = vectors.get(i);
            // The diary may have been edited, emptied or deleted while GMS was answering. A
            // vector for a version that no longer exists is dropped; the change's own event
            // (or the sweep) builds the current one.
            transactionTemplate.executeWithoutResult(status -> {
                if (store.lockIfCurrent(source.diaryId(), source.version())) {
                    store.upsert(source.diaryId(), model, hash, vector, source.version(), now);
                }
            });
        }
    }

    /**
     * One line with everything a question might be about ({@code 2026-10-12 평온 / 휴식, 가족 /
     * 엄마랑 산책}). Date and emotion are in it so "지난주 행복했던" sits closer to the right
     * diaries than the memo alone would put it.
     */
    static String text(Source source) {
        String activities = source.activityLabels().isEmpty() ? "-" : String.join(", ", source.activityLabels());
        return source.recordDate() + " " + source.emotion().label() + " / " + activities + " / " + source.memo();
    }

    static String sha256(String text) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            // Every JVM is required to ship SHA-256.
            throw new IllegalStateException(e);
        }
    }

}
