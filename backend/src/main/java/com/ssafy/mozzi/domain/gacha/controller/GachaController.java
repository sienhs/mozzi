package com.ssafy.mozzi.domain.gacha.controller;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.mozzi.domain.gacha.dto.CardSeenRequestDto;
import com.ssafy.mozzi.domain.gacha.dto.GachaCollectionRequestDto;
import com.ssafy.mozzi.domain.gacha.dto.GachaCollectionResponseDto;
import com.ssafy.mozzi.domain.gacha.dto.GachaDrawRequestDto;
import com.ssafy.mozzi.domain.gacha.dto.GachaDrawResponseDto;
import com.ssafy.mozzi.domain.gacha.dto.GachaExchangeRequestDto;
import com.ssafy.mozzi.domain.gacha.dto.GachaExchangeResponseDto;
import com.ssafy.mozzi.domain.gacha.dto.GachaRatesResponseDto;
import com.ssafy.mozzi.domain.gacha.dto.GachaStatusResponseDto;
import com.ssafy.mozzi.domain.gacha.service.GachaQueryService;
import com.ssafy.mozzi.domain.gacha.service.GachaService;
import com.ssafy.mozzi.global.idempotency.IdempotencyStore;
import com.ssafy.mozzi.global.security.CurrentMember;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;

@Tag(name = "모찌 뽑기")
@RestController
@RequestMapping("/gacha")
public class GachaController {

    private final GachaService gachaService;
    private final GachaQueryService queryService;

    public GachaController(GachaService gachaService, GachaQueryService queryService) {
        this.gachaService = gachaService;
        this.queryService = queryService;
    }

    @Operation(summary = "뽑기 홈", description = "뽑기권, 별조각, 도감 진행도.")
    @GetMapping("/status")
    public GachaStatusResponseDto status(@CurrentMember Long memberId) {
        return queryService.status(memberId);
    }

    @Operation(summary = "등급별 확률")
    @GetMapping("/rates")
    public GachaRatesResponseDto rates() {
        return queryService.rates();
    }

    @Operation(summary = "뽑기", description = "뽑기권 count장(1~10)으로 count장을 뽑는다. 같은 Idempotency-Key 재전송은 첫 결과를 그대로 준다.")
    @PostMapping("/draws")
    public ResponseEntity<GachaDrawResponseDto> draw(
            @CurrentMember Long memberId,
            @Parameter(description = "요청마다 새로 만든 값, 재전송 시에는 같은 값 (최대 64자)")
            @RequestHeader(IdempotencyStore.HEADER) @NotBlank @Size(max = 64) String idempotencyKey,
            @Valid @RequestBody GachaDrawRequestDto request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(gachaService.draw(memberId, idempotencyKey, request));
    }

    @Operation(summary = "도감", description = "활성 카드 전체. 미보유 카드도 이름과 이미지를 준다. 등급 높은 순, 같은 등급은 code 순.")
    @GetMapping("/collection")
    public GachaCollectionResponseDto collection(
            @CurrentMember Long memberId, @Valid @ModelAttribute GachaCollectionRequestDto request) {
        return queryService.collection(memberId, request);
    }

    @Operation(summary = "NEW 표시 지우기", description = "보유하지 않은 카드 ID는 무시한다.")
    @PostMapping("/collection/seen")
    public ResponseEntity<Void> markSeen(@CurrentMember Long memberId, @Valid @RequestBody CardSeenRequestDto request) {
        queryService.markSeen(memberId, request.cardIds());
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "별조각으로 교환", description = "전설·신화 중 보유하지 않은 카드만. 같은 Idempotency-Key 재전송은 첫 결과를 그대로 준다.")
    @PostMapping("/exchanges")
    public ResponseEntity<GachaExchangeResponseDto> exchange(
            @CurrentMember Long memberId,
            @Parameter(description = "요청마다 새로 만든 값, 재전송 시에는 같은 값 (최대 64자)")
            @RequestHeader(IdempotencyStore.HEADER) @NotBlank @Size(max = 64) String idempotencyKey,
            @Valid @RequestBody GachaExchangeRequestDto request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(gachaService.exchange(memberId, idempotencyKey, request));
    }

}
