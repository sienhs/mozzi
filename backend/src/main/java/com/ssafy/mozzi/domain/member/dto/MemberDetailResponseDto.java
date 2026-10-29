package com.ssafy.mozzi.domain.member.dto;

import com.ssafy.mozzi.domain.member.entity.AuthProvider;
import com.ssafy.mozzi.domain.member.entity.Member;

/** {@code GET /members/me}. The settings screen shows "email · provider" under the nickname. */
public record MemberDetailResponseDto(Long memberId, String email, String nickname, AuthProvider provider) {

    public static MemberDetailResponseDto from(Member member) {
        return new MemberDetailResponseDto(member.getId(), member.getEmail(), member.getNickname(),
                member.getProvider());
    }

}
