package com.ssafy.mozzi.domain.member.service;

import java.time.Clock;
import java.time.OffsetDateTime;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.mozzi.domain.member.dto.PushTokenRegisterRequestDto;
import com.ssafy.mozzi.domain.member.repository.MemberRepository;
import com.ssafy.mozzi.domain.member.repository.PushDeviceRepository;
import com.ssafy.mozzi.global.exception.BusinessException;
import com.ssafy.mozzi.global.exception.CommonErrorCode;

/**
 * The devices a member gets pushes on. Only the device the member is signed in on stays
 * active: a member has one session at a time, so any other device has been signed out.
 *
 * <p>Tokens are never logged; they identify a device.
 */
@Service
public class PushDeviceService {

    private final PushDeviceRepository pushDeviceRepository;
    private final MemberRepository memberRepository;
    private final Clock clock;

    public PushDeviceService(PushDeviceRepository pushDeviceRepository, MemberRepository memberRepository, Clock clock) {
        this.pushDeviceRepository = pushDeviceRepository;
        this.memberRepository = memberRepository;
        this.clock = clock;
    }

    /**
     * Called on every launch and login. Takes the member row lock first, as logout and
     * withdrawal do, so a registration racing a withdrawal cannot leave an active token
     * behind for a member who is gone.
     */
    @Transactional
    public void register(Long memberId, PushTokenRegisterRequestDto request) {
        memberRepository.findActiveByIdForUpdate(memberId)
                .orElseThrow(() -> new BusinessException(CommonErrorCode.NOT_FOUND, "member " + memberId));
        OffsetDateTime now = OffsetDateTime.now(clock);
        pushDeviceRepository.deactivateTokenOfOthers(request.token(), memberId, now);
        pushDeviceRepository.deactivateOtherDevices(memberId, request.deviceId(), now);
        pushDeviceRepository.upsert(memberId, request.deviceId(), request.platform().name(), request.token(), now);
    }

    /** Logout. The rows stay, so the next login on the device only turns its row back on. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void deactivateAll(Long memberId) {
        pushDeviceRepository.deactivateAllOfMember(memberId, OffsetDateTime.now(clock));
    }

    /** Withdrawal. Nothing of a withdrawn member is reattached, so the rows go. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void deleteAll(Long memberId) {
        pushDeviceRepository.deleteAllOfMember(memberId);
    }

}
