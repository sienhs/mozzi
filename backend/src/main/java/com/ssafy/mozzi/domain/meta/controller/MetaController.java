package com.ssafy.mozzi.domain.meta.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.mozzi.domain.meta.dto.MetaResponseDto;
import com.ssafy.mozzi.domain.meta.service.MetaService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * Public: the app needs the terms versions before sign-up (see {@code PublicEndpoints}).
 */
@Tag(name = "앱 메타")
@RestController
@RequestMapping("/meta")
public class MetaController {

    private final MetaService metaService;

    public MetaController(MetaService metaService) {
        this.metaService = metaService;
    }

    @Operation(summary = "앱 메타", description = "인증 없음. 앱 시작 시 1회. 약관 버전과 강제·권장 업데이트 기준 버전.")
    @GetMapping
    public MetaResponseDto get() {
        return metaService.get();
    }

}
