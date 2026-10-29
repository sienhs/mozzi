package com.ssafy.mozzi.domain.wallet.controller;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.mozzi.domain.wallet.dto.DailyLoginResponseDto;
import com.ssafy.mozzi.domain.wallet.service.RewardService;
import com.ssafy.mozzi.global.security.CurrentMember;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@Tag(name = "보상")
@RestController
@RequestMapping("/rewards")
public class RewardController {

    private final RewardService rewardService;

    public RewardController(RewardService rewardService) {
        this.rewardService = rewardService;
    }

    @Operation(summary = "매일 접속 보상",
            description = "앱이 켜질 때 호출한다. 그날 첫 호출이면 뽑기권 10장을 주고, 이후에는 granted: false.")
    @PostMapping("/daily-login")
    public DailyLoginResponseDto dailyLogin(@CurrentMember Long memberId) {
        return rewardService.dailyLogin(memberId);
    }

}
