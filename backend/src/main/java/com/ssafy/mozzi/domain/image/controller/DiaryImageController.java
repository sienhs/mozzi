package com.ssafy.mozzi.domain.image.controller;

import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.ssafy.mozzi.domain.diary.controller.DiaryController;
import com.ssafy.mozzi.domain.image.dto.DiaryImageCreateRequestDto;
import com.ssafy.mozzi.domain.image.dto.DiaryImageCreateResponseDto;
import com.ssafy.mozzi.domain.image.service.DiaryImageService;
import com.ssafy.mozzi.global.security.CurrentMember;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * The app opens {@code GET .../events} first and then sends {@code POST}, so the result has
 * somewhere to go the moment it arrives.
 */
@Tag(name = "그림")
@RestController
@RequestMapping("/diaries/{diaryId}/image")
public class DiaryImageController {

    private final DiaryImageService diaryImageService;

    public DiaryImageController(DiaryImageService diaryImageService) {
        this.diaryImageService = diaryImageService;
    }

    @Operation(summary = "그림 결과 구독 (SSE)",
            description = "그림 만들기 요청 전에 연결한다. connected 이벤트가 먼저 오고, "
                    + "그림이 끝나면 image 이벤트 하나를 보낸 뒤 연결을 닫는다.")
    @GetMapping(value = "/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter subscribe(
            @CurrentMember Long memberId, @PathVariable Long diaryId, HttpServletResponse response) {
        // Keeps nginx from buffering the stream until it closes.
        response.setHeader("X-Accel-Buffering", "no");
        return diaryImageService.subscribe(memberId, diaryId);
    }

    @Operation(summary = "그림 만들기",
            description = "실패한 그림은 다시 요청할 수 있다 (실패 3번까지). 생성 중이거나 완성됐으면 409.")
    @ApiResponse(responseCode = "202", description = "접수됨")
    @PostMapping
    public ResponseEntity<DiaryImageCreateResponseDto> request(
            @CurrentMember Long memberId,
            @PathVariable Long diaryId,
            @Parameter(description = "요청마다 새로 만든 값, 재전송 시에는 같은 값 (최대 64자)")
            @RequestHeader(DiaryController.IDEMPOTENCY_KEY) @NotBlank @Size(max = 64) String idempotencyKey,
            @Valid @RequestBody DiaryImageCreateRequestDto request) {
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(diaryImageService.request(memberId, diaryId, request));
    }

}
