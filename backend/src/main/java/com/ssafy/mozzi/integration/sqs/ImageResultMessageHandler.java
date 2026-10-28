package com.ssafy.mozzi.integration.sqs;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.ssafy.mozzi.domain.image.service.DiaryImageResultService;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Applies one {@code ai-response} message:
 * {@code {"diaryId", "userId", "status": "SUCCEEDED" | "FAILED", "imageUrl", "errorCode", "errorMessage"}}.
 *
 * <p>{@code errorCode} is logged for a failure. {@code errorMessage} is not: it is the AI
 * server's own text and may repeat the prompt, which holds what the member wrote. The member
 * is told of a failure in the server's own words ({@code ImagePushListener}).
 *
 * <p>Read as a tree rather than bound to a type, so a field the AI server adds later does not
 * make every message unreadable.
 */
class ImageResultMessageHandler {

    private static final Logger log = LoggerFactory.getLogger(ImageResultMessageHandler.class);

    private final DiaryImageResultService resultService;
    private final ObjectMapper objectMapper;

    ImageResultMessageHandler(DiaryImageResultService resultService, ObjectMapper objectMapper) {
        this.resultService = resultService;
        this.objectMapper = objectMapper;
    }

    /**
     * @return {@code true} when the message is done with and can be deleted: applied, ignored
     *         as stale, or unreadable (it would never become readable by waiting).
     *         An exception means "try again later" and the message is kept.
     */
    boolean handle(String body) {
        JsonNode message;
        try {
            message = objectMapper.readTree(body);
        } catch (JacksonException e) {
            log.warn("unreadable image result dropped");
            return true;
        }
        JsonNode diaryId = message.get("diaryId");
        JsonNode userId = message.get("userId");
        String status = message.path("status").asString("");
        String imageUrl = message.path("imageUrl").asString(null);
        if (diaryId == null || !diaryId.canConvertToLong()) {
            log.warn("image result without diaryId dropped");
            return true;
        }
        if (userId == null || !userId.canConvertToLong()) {
            log.warn("image result without userId dropped: diaryId={}", diaryId.asLong());
            return true;
        }
        log.info("image pipeline: step=result-received diaryId={} status={}", diaryId.asLong(), status);
        switch (status) {
            case "SUCCEEDED" -> {
                if (imageUrl == null || imageUrl.isBlank()) {
                    log.warn("successful image result without imageUrl dropped: diaryId={}", diaryId.asLong());
                    return true;
                }
                resultService.succeed(diaryId.asLong(), userId.asLong(), imageUrl);
            }
            case "FAILED" -> {
                log.info("image pipeline: step=ai-failed diaryId={} errorCode={}",
                        diaryId.asLong(), message.path("errorCode").asString(""));
                resultService.fail(diaryId.asLong(), userId.asLong());
            }
            default -> log.warn("image result with unknown status dropped: diaryId={}", diaryId.asLong());
        }
        return true;
    }

}
