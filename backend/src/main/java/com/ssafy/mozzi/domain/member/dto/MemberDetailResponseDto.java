package com.ssafy.mozzi.domain.member.dto;

import com.ssafy.mozzi.domain.member.entity.Member;

/** {@code GET /members/me}. */
public record MemberDetailResponseDto(Long memberId, String email, String nickname) {

    public static MemberDetailResponseDto from(Member member) {
        return new MemberDetailResponseDto(member.getId(), member.getEmail(), member.getNickname());
    }

}
