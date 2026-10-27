package com.ssafy.mozzi.domain.diary.controller;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.mozzi.domain.diary.dto.DiaryCreateRequestDto;
import com.ssafy.mozzi.domain.diary.dto.DiaryCreateResponseDto;
import com.ssafy.mozzi.domain.diary.dto.DiaryDetailResponseDto;
import com.ssafy.mozzi.domain.diary.dto.DiarySearchRequestDto;
import com.ssafy.mozzi.domain.diary.dto.DiarySummaryResponseDto;
import com.ssafy.mozzi.domain.diary.dto.DiaryUpdateRequestDto;
import com.ssafy.mozzi.domain.diary.exception.DiaryAlreadyExistsException;
import com.ssafy.mozzi.domain.diary.exception.DiaryConflictResponse;
import com.ssafy.mozzi.domain.diary.service.DiaryService;
import com.ssafy.mozzi.global.logging.RequestTrace;
import com.ssafy.mozzi.global.response.CursorPage;
import com.ssafy.mozzi.global.security.CurrentMember;

/**
 * API spec 4.4.
 */
@RestController
@RequestMapping("/diaries")
public class DiaryController {

    static final String IDEMPOTENCY_KEY = "Idempotency-Key";

    private final DiaryService diaryService;

    public DiaryController(DiaryService diaryService) {
        this.diaryService = diaryService;
    }

    /**
     * R-03 "기록 저장하기".
     *
     * <p>{@code Idempotency-Key} is required by the spec and validated here, but replaying
     * the first response for a repeated key is not implemented yet — that comes with the
     * shared idempotency layer (build step 6). Until then a resend after a successful save
     * gets {@code 409 DIARY_ALREADY_EXISTS} with the diary's id, which the app already
     * handles by opening the diary, and the unique index rules out a duplicate either way.
     */
    @PostMapping
    public ResponseEntity<DiaryCreateResponseDto> create(
            @CurrentMember Long memberId,
            @RequestHeader(IDEMPOTENCY_KEY) @NotBlank @Size(max = 64) String idempotencyKey,
            @Valid @RequestBody DiaryCreateRequestDto request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(diaryService.create(memberId, request));
    }

    /** D-01, G-02. */
    @GetMapping("/{diaryId}")
    public DiaryDetailResponseDto get(@CurrentMember Long memberId, @PathVariable Long diaryId) {
        return diaryService.get(memberId, diaryId);
    }

    @GetMapping
    public CursorPage<DiarySummaryResponseDto> search(
            @CurrentMember Long memberId, @Valid @ModelAttribute DiarySearchRequestDto request) {
        return diaryService.search(memberId, request);
    }

    @PatchMapping("/{diaryId}")
    public DiaryDetailResponseDto update(
            @CurrentMember Long memberId,
            @PathVariable Long diaryId,
            @Valid @RequestBody DiaryUpdateRequestDto request) {
        return diaryService.update(memberId, diaryId, request);
    }

    @DeleteMapping("/{diaryId}")
    public ResponseEntity<Void> delete(@CurrentMember Long memberId, @PathVariable Long diaryId) {
        diaryService.delete(memberId, diaryId);
        return ResponseEntity.noContent().build();
    }

    /**
     * Handled here rather than in {@code GlobalExceptionHandler}, which would answer with the
     * plain error body and drop the {@code diaryId} the app navigates to.
     */
    @ExceptionHandler(DiaryAlreadyExistsException.class)
    public ResponseEntity<DiaryConflictResponse> handleAlreadyExists(DiaryAlreadyExistsException e) {
        return ResponseEntity.status(e.errorCode().status())
                .body(DiaryConflictResponse.of(e, RequestTrace.traceId()));
    }

}
