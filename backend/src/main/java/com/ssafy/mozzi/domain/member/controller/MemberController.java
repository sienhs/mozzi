package com.ssafy.mozzi.domain.member.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.mozzi.domain.member.dto.MemberDetailResponseDto;
import com.ssafy.mozzi.domain.member.service.MemberService;
import com.ssafy.mozzi.global.security.CurrentMember;

/** The signed-in member's own account. There is no endpoint to change the nickname. */
@RestController
@RequestMapping("/members")
public class MemberController {

    private final MemberService memberService;

    public MemberController(MemberService memberService) {
        this.memberService = memberService;
    }

    @GetMapping("/me")
    public MemberDetailResponseDto getMe(@CurrentMember Long memberId) {
        return memberService.getMe(memberId);
    }

    @DeleteMapping("/me")
    public ResponseEntity<Void> withdraw(@CurrentMember Long memberId) {
        memberService.withdraw(memberId);
        return ResponseEntity.noContent().build();
    }

}
