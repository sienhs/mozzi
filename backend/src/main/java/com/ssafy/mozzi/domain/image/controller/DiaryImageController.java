package com.ssafy.mozzi.domain.image.controller;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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
 * The result reaches the app as a push (FCM), and the diary's {@code image} shows it too.
 */
@Tag(name = "그림")
@RestController
@RequestMapping("/diaries/{diaryId}/image")
public class DiaryImageController {

    private final DiaryImageService diaryImageService;

    public DiaryImageController(DiaryImageService diaryImageService) {
        this.diaryImageService = diaryImageService;
    }

    @Operation(summary = "그림 만들기",
            description = "실패한 그림은 다시 요청할 수 있다 (실패 3번까지). 생성 중이거나 완성됐으면 409. "
                    + "결과는 푸시로 알린다. 같은 Idempotency-Key 재전송은 첫 응답을 그대로 준다. "
                    + "실패 후 다시 그리기는 새 요청이므로 새 키를 쓴다.")
    @ApiResponse(responseCode = "202", description = "접수됨")
    @PostMapping
    public ResponseEntity<DiaryImageCreateResponseDto> request(
            @CurrentMember Long memberId,
            @PathVariable Long diaryId,
            @Parameter(description = "요청마다 새로 만든 값, 재전송 시에는 같은 값 (최대 64자)")
            @RequestHeader(DiaryController.IDEMPOTENCY_KEY) @NotBlank @Size(max = 64) String idempotencyKey,
            @Valid @RequestBody DiaryImageCreateRequestDto request) {
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(diaryImageService.request(memberId, diaryId, idempotencyKey, request));
    }

    /** Temporary (S15P31D102-132): removed once the picture is tested. */
    @Operation(summary = "[테스트·임시] 제한 없이 그림 만들기",
            description = "진짜 API와 같지만 날짜·완성 여부·실패 횟수를 보지 않는다. 완성된 그림은 덮어쓴다. "
                    + "생성 중이면 409. AI 서버는 test/ 아래에 저장한다.")
    @ApiResponse(responseCode = "202", description = "접수됨")
    @PostMapping("/test")
    public ResponseEntity<DiaryImageCreateResponseDto> requestForTest(
            @CurrentMember Long memberId,
            @PathVariable Long diaryId,
            @Parameter(description = "요청마다 새로 만든 값, 재전송 시에는 같은 값 (최대 64자)")
            @RequestHeader(DiaryController.IDEMPOTENCY_KEY) @NotBlank @Size(max = 64) String idempotencyKey,
            @Valid @RequestBody DiaryImageCreateRequestDto request) {
        return ResponseEntity.status(HttpStatus.ACCEPTED)
                .body(diaryImageService.requestForTest(memberId, diaryId, request));
    }

}
