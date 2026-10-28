package com.ssafy.mozzi.domain.diary.controller;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.mozzi.domain.diary.dto.DiaryCreateRequestDto;
import com.ssafy.mozzi.domain.diary.dto.DiaryCreateResponseDto;
import com.ssafy.mozzi.domain.diary.dto.DiaryDailyRequestDto;
import com.ssafy.mozzi.domain.diary.dto.DiaryDetailResponseDto;
import com.ssafy.mozzi.domain.diary.dto.DiaryMonthlyRequestDto;
import com.ssafy.mozzi.domain.diary.dto.DiaryMonthlyResponseDto;
import com.ssafy.mozzi.domain.diary.dto.DiarySearchRequestDto;
import com.ssafy.mozzi.domain.diary.dto.DiarySummaryResponseDto;
import com.ssafy.mozzi.domain.diary.exception.DiaryAlreadyExistsException;
import com.ssafy.mozzi.domain.diary.exception.DiaryConflictResponse;
import com.ssafy.mozzi.domain.diary.service.DiaryService;
import com.ssafy.mozzi.global.exception.ErrorResponseEntity;
import com.ssafy.mozzi.global.logging.RequestTrace;
import com.ssafy.mozzi.global.response.CursorPage;
import com.ssafy.mozzi.global.security.CurrentMember;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * Diaries are written once and not edited or deleted: a day's record stays as it was.
 */
@Tag(name = "일기")
@RestController
@RequestMapping("/diaries")
public class DiaryController {

    public static final String IDEMPOTENCY_KEY = "Idempotency-Key";

    private final DiaryService diaryService;

    public DiaryController(DiaryService diaryService) {
        this.diaryService = diaryService;
    }

    /**
     * {@code Idempotency-Key} is required by the spec and validated here, but replaying the
     * first response for a repeated key is not implemented yet. Until then a resend after a
     * successful save gets {@code 409 DIARY_ALREADY_EXISTS} with the diary's id, which the
     * app handles by opening the diary, and the unique index rules out a duplicate either way.
     */
    @Operation(summary = "일기 쓰기", description = "오늘 날짜로 저장한다. 오늘 일기가 이미 있으면 409 와 그 일기의 diaryId 를 준다.")
    @ApiResponse(responseCode = "201", description = "저장됨")
    @PostMapping
    public ResponseEntity<DiaryCreateResponseDto> create(
            @CurrentMember Long memberId,
            @Parameter(description = "요청마다 새로 만든 값, 재전송 시에는 같은 값 (최대 64자)")
            @RequestHeader(IDEMPOTENCY_KEY) @NotBlank @Size(max = 64) String idempotencyKey,
            @Valid @RequestBody DiaryCreateRequestDto request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(diaryService.create(memberId, request));
    }

    @Operation(summary = "하루 일기", description = "그 날짜에 일기가 없으면 404.")
    @GetMapping("/daily")
    public DiaryDetailResponseDto getDaily(
            @CurrentMember Long memberId, @Valid @ModelAttribute DiaryDailyRequestDto request) {
        return diaryService.getDaily(memberId, request.date());
    }

    @Operation(summary = "한 달 감정", description = "캘린더용. 일기를 쓴 날만 날짜순으로.")
    @GetMapping("/monthly")
    public DiaryMonthlyResponseDto getMonthly(
            @CurrentMember Long memberId, @Valid @ModelAttribute DiaryMonthlyRequestDto request) {
        return diaryService.getMonthly(memberId, request.yearMonth());
    }

    @Operation(summary = "일기 목록 조회", description = "커서 기반 페이지네이션. 다음 페이지는 응답의 nextCursor 를 cursor 로 보낸다.")
    @GetMapping
    public CursorPage<DiarySummaryResponseDto> search(
            @CurrentMember Long memberId, @Valid @ModelAttribute DiarySearchRequestDto request) {
        return diaryService.search(memberId, request);
    }

    /**
     * Handled here rather than in {@code GlobalExceptionHandler}, which would answer with the
     * plain error body and drop the {@code diaryId} the app navigates to.
     */
    @ExceptionHandler(DiaryAlreadyExistsException.class)
    public ResponseEntity<DiaryConflictResponse> handleAlreadyExists(DiaryAlreadyExistsException e) {
        return ErrorResponseEntity.of(e.errorCode().status(), DiaryConflictResponse.of(e, RequestTrace.traceId()));
    }

}
