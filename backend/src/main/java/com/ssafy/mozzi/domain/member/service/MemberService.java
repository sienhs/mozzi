package com.ssafy.mozzi.domain.member.service;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

import org.hibernate.exception.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.mozzi.domain.auth.exception.AuthErrorCode;
import com.ssafy.mozzi.domain.auth.service.MemberSessionService;
import com.ssafy.mozzi.domain.member.dto.MemberDetailResponseDto;
import com.ssafy.mozzi.domain.member.entity.AuthProvider;
import com.ssafy.mozzi.domain.member.entity.Member;
import com.ssafy.mozzi.domain.member.entity.Nickname;
import com.ssafy.mozzi.domain.member.entity.TermsAgreement;
import com.ssafy.mozzi.domain.member.entity.TermsType;
import com.ssafy.mozzi.domain.member.exception.MemberErrorCode;
import com.ssafy.mozzi.domain.member.repository.MemberRepository;
import com.ssafy.mozzi.domain.member.repository.TermsAgreementRepository;
import com.ssafy.mozzi.global.exception.BusinessException;
import com.ssafy.mozzi.global.exception.CommonErrorCode;

@Service
public class MemberService {

    private static final String NICKNAME_INDEX = "uq_member_active_nickname";
    private static final String GOOGLE_IDENTITY_INDEX = "uq_member_active_provider_subject";

    private final MemberRepository memberRepository;
    private final TermsAgreementRepository termsAgreementRepository;
    private final MemberSessionService sessionService;
    private final PushDeviceService pushDeviceService;
    private final TermsProperties termsProperties;
    private final Clock clock;

    public MemberService(MemberRepository memberRepository, TermsAgreementRepository termsAgreementRepository,
            MemberSessionService sessionService, PushDeviceService pushDeviceService, TermsProperties termsProperties,
            Clock clock) {
        this.memberRepository = memberRepository;
        this.termsAgreementRepository = termsAgreementRepository;
        this.sessionService = sessionService;
        this.pushDeviceService = pushDeviceService;
        this.termsProperties = termsProperties;
        this.clock = clock;
    }

    /**
     * Creates the member with the agreements it submitted.
     *
     * <p>Runs inside the sign-up transaction, so a failure here also keeps the sign-up
     * ticket. The nickname check up front is for a friendly answer; two sign-ups racing for
     * the same nickname or the same Google account are settled by the unique indexes, whose
     * violations are translated here.
     *
     * @param nickname already validated against {@link Nickname#PATTERN}
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public Member register(String email, AuthProvider provider, String providerSubject, String nickname,
            List<TermsAgreementCommand> agreements) {
        Map<TermsType, String> agreedVersions = requireCurrentTerms(agreements);
        if (memberRepository.existsActiveNickname(Nickname.comparisonKey(nickname))) {
            throw new BusinessException(MemberErrorCode.NICKNAME_DUPLICATED, "nickname taken");
        }

        Member member;
        try {
            member = memberRepository.saveAndFlush(Member.signUp(email, provider, providerSubject, nickname));
        } catch (DataIntegrityViolationException e) {
            throw translate(e);
        }

        OffsetDateTime now = OffsetDateTime.now(clock);
        agreedVersions.forEach((type, version) ->
                termsAgreementRepository.save(new TermsAgreement(member.getId(), type, version, now)));
        return member;
    }

    @Transactional(readOnly = true)
    public MemberDetailResponseDto getMe(Long memberId) {
        Member member = memberRepository.findByIdAndDeletedAtIsNull(memberId)
                .orElseThrow(() -> new BusinessException(CommonErrorCode.NOT_FOUND, "member " + memberId));
        return MemberDetailResponseDto.from(member);
    }

    /**
     * Ends the session and soft-deletes the member, under the member row lock.
     *
     * <p>The same Google account can sign up again right away and gets a new member id, so
     * nothing of this member is reattached.
     */
    @Transactional
    public void withdraw(Long memberId) {
        Member member = memberRepository.findActiveByIdForUpdate(memberId)
                .orElseThrow(() -> new BusinessException(CommonErrorCode.NOT_FOUND, "member " + memberId));
        sessionService.endAll(memberId);
        pushDeviceService.deleteAll(memberId);
        member.withdraw(clock);
    }

    /**
     * Every required document must be agreed to, at its current version, exactly once. The
     * server never fills in an agreement the user did not submit.
     */
    private Map<TermsType, String> requireCurrentTerms(List<TermsAgreementCommand> agreements) {
        Map<TermsType, String> submitted = new EnumMap<>(TermsType.class);
        for (TermsAgreementCommand agreement : agreements) {
            if (submitted.put(agreement.type(), agreement.version()) != null) {
                throw new BusinessException(MemberErrorCode.TERMS_AGREEMENT_REQUIRED, "duplicate " + agreement.type());
            }
        }
        if (!submitted.equals(termsProperties.currentVersions())) {
            throw new BusinessException(MemberErrorCode.TERMS_AGREEMENT_REQUIRED,
                    "submitted " + submitted + ", required " + termsProperties.currentVersions());
        }
        return submitted;
    }

    private static RuntimeException translate(DataIntegrityViolationException e) {
        String constraint = violatedConstraint(e);
        if (NICKNAME_INDEX.equals(constraint)) {
            return new BusinessException(MemberErrorCode.NICKNAME_DUPLICATED, "nickname taken concurrently");
        }
        if (GOOGLE_IDENTITY_INDEX.equals(constraint)) {
            return new BusinessException(AuthErrorCode.ACCOUNT_ALREADY_REGISTERED, "registered concurrently");
        }
        return e;
    }

    private static String violatedConstraint(Throwable e) {
        for (Throwable cause = e; cause != null; cause = cause.getCause()) {
            if (cause instanceof ConstraintViolationException violation) {
                return violation.getConstraintName();
            }
        }
        return null;
    }

}
