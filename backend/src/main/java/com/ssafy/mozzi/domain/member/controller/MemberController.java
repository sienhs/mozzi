package com.ssafy.mozzi.domain.member.controller;

import jakarta.validation.Valid;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.mozzi.domain.member.dto.MemberDetailResponseDto;
import com.ssafy.mozzi.domain.member.dto.PushTokenRegisterRequestDto;
import com.ssafy.mozzi.domain.member.service.MemberService;
import com.ssafy.mozzi.domain.member.service.PushDeviceService;
import com.ssafy.mozzi.global.security.CurrentMember;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;

/** The signed-in member's own account. There is no endpoint to change the nickname. */
@Tag(name = "회원")
@RestController
@RequestMapping("/members")
public class MemberController {

    private final MemberService memberService;
    private final PushDeviceService pushDeviceService;

    public MemberController(MemberService memberService, PushDeviceService pushDeviceService) {
        this.memberService = memberService;
        this.pushDeviceService = pushDeviceService;
    }

    @Operation(summary = "내 정보 조회")
    @GetMapping("/me")
    public MemberDetailResponseDto getMe(@CurrentMember Long memberId) {
        return memberService.getMe(memberId);
    }

    @Operation(summary = "회원 탈퇴", description = "세션을 종료하고 회원을 소프트 삭제한다.")
    @ApiResponse(responseCode = "204", description = "탈퇴됨")
    @DeleteMapping("/me")
    public ResponseEntity<Void> withdraw(@CurrentMember Long memberId) {
        memberService.withdraw(memberId);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "푸시 토큰 등록",
            description = "앱 시작·로그인 때마다 호출한다. 같은 deviceId면 덮어쓰고, 이 기기만 푸시를 받는다.")
    @ApiResponse(responseCode = "204", description = "등록됨")
    @PutMapping("/me/push-tokens")
    public ResponseEntity<Void> registerPushToken(
            @CurrentMember Long memberId, @Valid @RequestBody PushTokenRegisterRequestDto request) {
        pushDeviceService.register(memberId, request);
        return ResponseEntity.noContent().build();
    }

}
