package com.ssafy.mozzi.domain.icon.service;

import java.time.Clock;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.mozzi.domain.icon.dto.MyIconCreateRequestDto;
import com.ssafy.mozzi.domain.icon.dto.MyIconListResponseDto;
import com.ssafy.mozzi.domain.icon.dto.MyIconResponseDto;
import com.ssafy.mozzi.domain.icon.entity.IconCategory;
import com.ssafy.mozzi.domain.icon.entity.MyIcon;
import com.ssafy.mozzi.domain.icon.exception.MyIconErrorCode;
import com.ssafy.mozzi.domain.icon.repository.MyIconRepository;
import com.ssafy.mozzi.domain.member.repository.MemberRepository;
import com.ssafy.mozzi.global.exception.BusinessException;
import com.ssafy.mozzi.global.exception.CommonErrorCode;

/**
 * Icons a member makes, lists and deletes. Every method is scoped by the authenticated
 * member's id, so another member's icon is indistinguishable from a missing one (spec 1.3).
 */
@Service
public class MyIconService {

    private final MyIconRepository myIconRepository;
    private final MemberRepository memberRepository;
    private final Clock clock;

    public MyIconService(
            MyIconRepository myIconRepository,
            MemberRepository memberRepository,
            Clock clock) {
        this.myIconRepository = myIconRepository;
        this.memberRepository = memberRepository;
        this.clock = clock;
    }

    /**
     * Makes an icon, at most {@link MyIcon#MAX_PER_CATEGORY} per category.
     *
     * <p>The limit is a count, which no index can enforce, so two requests at twenty-nine icons
     * would both see room and make thirty-one. Locking the member row first makes the second
     * request wait for the first to commit and then count its icon too.
     */
    @Transactional
    public MyIconResponseDto create(Long memberId, MyIconCreateRequestDto request) {
        memberRepository.findActiveByIdForUpdate(memberId)
                .orElseThrow(() -> new BusinessException(CommonErrorCode.NOT_FOUND, "member not found: " + memberId));
        if (myIconRepository.countByMemberIdAndCategoryAndDeletedAtIsNull(memberId, request.category())
                >= MyIcon.MAX_PER_CATEGORY) {
            throw new BusinessException(
                    MyIconErrorCode.MY_ICON_LIMIT_EXCEEDED, "my icon limit: category=" + request.category());
        }
        MyIcon saved = myIconRepository.save(MyIcon.create(memberId, request.name(), request.category()));
        return MyIconResponseDto.of(saved);
    }

    @Transactional(readOnly = true)
    public MyIconListResponseDto list(Long memberId, IconCategory category) {
        return new MyIconListResponseDto(myIconRepository.findActiveByCategory(memberId, category).stream()
                .map(MyIconResponseDto::of)
                .toList());
    }

    /** Soft delete. Diaries that used the icon stop showing it (spec). */
    @Transactional
    public void delete(Long memberId, Long myIconId) {
        myIconRepository.findByIdAndMemberIdAndDeletedAtIsNull(myIconId, memberId)
                .orElseThrow(() -> new BusinessException(
                        CommonErrorCode.NOT_FOUND, "my icon not found: myIconId=" + myIconId))
                .delete(clock);
    }

}
