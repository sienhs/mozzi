package com.ssafy.mozzi.domain.search.controller;

import jakarta.validation.Valid;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.mozzi.domain.search.dto.EmotionSearchRequestDto;
import com.ssafy.mozzi.domain.search.dto.EmotionSearchResponseDto;
import com.ssafy.mozzi.domain.search.dto.EmotionSearchSuggestionsResponseDto;
import com.ssafy.mozzi.domain.search.service.EmotionSearchService;
import com.ssafy.mozzi.global.security.CurrentMember;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * API spec emotion-search.md.
 */
@Tag(name = "감정 검색")
@RestController
@RequestMapping("/emotion-search")
public class EmotionSearchController {

    private final EmotionSearchService emotionSearchService;

    public EmotionSearchController(EmotionSearchService emotionSearchService) {
        this.emotionSearchService = emotionSearchService;
    }

    /** S-01. */
    @Operation(summary = "추천 질문")
    @GetMapping("/suggestions")
    public EmotionSearchSuggestionsResponseDto suggestions(@CurrentMember Long memberId) {
        return emotionSearchService.suggestions();
    }

    /** S-02, E-04, E-05. */
    @Operation(summary = "질문하기",
            description = "답을 찾지 못하면 503 SEARCH_UNAVAILABLE. 같은 질문을 다시 보내면 된다. 분당 10회를 넘으면 429.")
    @PostMapping
    public EmotionSearchResponseDto search(
            @CurrentMember Long memberId, @Valid @RequestBody EmotionSearchRequestDto request) {
        return emotionSearchService.search(memberId, request.question());
    }

}
