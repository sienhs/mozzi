package com.ssafy.mozzi.domain.icon.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.mozzi.domain.icon.dto.IconListResponseDto;
import com.ssafy.mozzi.domain.icon.service.IconService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@Tag(name = "아이콘")
@RestController
@RequestMapping("/icons")
public class IconController {

    private final IconService iconService;

    public IconController(IconService iconService) {
        this.iconService = iconService;
    }

    @Operation(summary = "기본 이미지 목록", description = "아이콘을 만들 때 고르는 이미지.")
    @GetMapping
    public IconListResponseDto list() {
        return iconService.list();
    }

}
