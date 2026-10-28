package com.ssafy.mozzi.integration.sqs;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import org.junit.jupiter.api.Test;

import com.ssafy.mozzi.domain.image.service.DiaryImageResultService;

import tools.jackson.databind.json.JsonMapper;

class ImageResultMessageHandlerTest {

    private final DiaryImageResultService resultService = mock(DiaryImageResultService.class);
    private final ImageResultMessageHandler handler = new ImageResultMessageHandler(resultService, new JsonMapper());

    @Test
    void appliesASuccess() {
        boolean done = handler.handle("""
                {"diaryId": 102, "userId": 12, "status": "SUCCEEDED",
                 "imageUrl": "https://cdn.test/diary/12/102/a.png", "errorCode": null, "errorMessage": null}
                """);

        assertThat(done).isTrue();
        verify(resultService).succeed(102L, 12L, "https://cdn.test/diary/12/102/a.png");
    }

    @Test
    void appliesAFailure() {
        handler.handle("""
                {"diaryId": 102, "userId": 12, "status": "FAILED", "imageUrl": null,
                 "errorCode": "GENERATION_FAILED", "errorMessage": "model timed out"}
                """);

        verify(resultService).fail(102L, 12L);
    }

    /** Fields the AI server adds later must not make every message unreadable. */
    @Test
    void toleratesExtraFields() {
        handler.handle("""
                {"diaryId": 102, "userId": 12, "status": "FAILED", "retryable": true}
                """);

        verify(resultService).fail(102L, 12L);
    }

    /** These would never become valid by waiting, so they are dropped rather than retried forever. */
    @Test
    void dropsMessagesItCanNeverApply() {
        assertThat(handler.handle("not json")).isTrue();
        assertThat(handler.handle("{\"userId\": 12, \"status\": \"FAILED\"}")).isTrue();
        assertThat(handler.handle("{\"diaryId\": 1, \"status\": \"FAILED\"}")).isTrue();
        assertThat(handler.handle("{\"diaryId\": 1, \"userId\": 12, \"status\": \"GENERATING\"}")).isTrue();
        assertThat(handler.handle("{\"diaryId\": 1, \"userId\": 12, \"status\": \"SUCCEEDED\"}")).isTrue();

        verifyNoInteractions(resultService);
    }

}
