package com.ssafy.mozzi.domain.home.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.mozzi.domain.home.dto.HomeResponseDto;
import com.ssafy.mozzi.domain.home.service.HomeService;
import com.ssafy.mozzi.global.security.CurrentMember;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@Tag(name = "홈")
@RestController
@RequestMapping("/home")
public class HomeController {

    private final HomeService homeService;

    public HomeController(HomeService homeService) {
        this.homeService = homeService;
    }

    @Operation(summary = "홈", description = "오늘 상태(todayStatus)로 H-01·H-02·H-03·E-01 중 하나를 고른다. 지난 기록은 오늘 이전 가장 최근 1건.")
    @GetMapping
    public HomeResponseDto get(@CurrentMember Long memberId) {
        return homeService.get(memberId);
    }

}
