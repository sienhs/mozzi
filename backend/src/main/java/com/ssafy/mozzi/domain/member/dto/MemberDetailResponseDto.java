package com.ssafy.mozzi.domain.member.dto;

import java.util.List;

import com.ssafy.mozzi.domain.gacha.dto.MyMozziResponseDto;
import com.ssafy.mozzi.domain.member.entity.AuthProvider;
import com.ssafy.mozzi.domain.member.entity.Member;

/**
 * {@code GET /members/me}. The settings screen shows "email · provider" under the nickname,
 * and the my page the mozzi picked for each emotion.
 *
 * @param mozzis every emotion in order, each with its pick
 */
public record MemberDetailResponseDto(Long memberId, String email, String nickname, AuthProvider provider,
        List<MyMozziResponseDto> mozzis) {

    public static MemberDetailResponseDto from(Member member, List<MyMozziResponseDto> mozzis) {
        return new MemberDetailResponseDto(member.getId(), member.getEmail(), member.getNickname(),
                member.getProvider(), mozzis);
    }

}
