package com.ssafy.mozzi.domain.auth.service;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import com.ssafy.mozzi.domain.auth.dto.GoogleLoginResponseDto;
import com.ssafy.mozzi.domain.auth.entity.SignupTicket;
import com.ssafy.mozzi.domain.auth.exception.AuthErrorCode;
import com.ssafy.mozzi.domain.auth.repository.SignupTicketRepository;
import com.ssafy.mozzi.domain.member.entity.AuthProvider;
import com.ssafy.mozzi.domain.member.entity.Member;
import com.ssafy.mozzi.domain.member.repository.MemberRepository;
import com.ssafy.mozzi.domain.member.service.MemberService;
import com.ssafy.mozzi.domain.member.service.PushDeviceService;
import com.ssafy.mozzi.domain.member.service.TermsAgreementCommand;
import com.ssafy.mozzi.global.exception.BusinessException;
import com.ssafy.mozzi.global.security.AuthProperties;
import com.ssafy.mozzi.global.security.AuthenticatedMember;
import com.ssafy.mozzi.global.security.SecureTokens;
import com.ssafy.mozzi.global.security.SecurityErrorCode;
import com.ssafy.mozzi.integration.google.GoogleIdTokenInvalidException;
import com.ssafy.mozzi.integration.google.GoogleIdTokenVerifier;
import com.ssafy.mozzi.integration.google.GoogleIdentity;
import com.ssafy.mozzi.integration.google.GoogleUnavailableException;

/**
 * Google login, sign-up, refresh and logout.
 *
 * <p>Every flow that changes a session locks the member row first (see
 * {@link MemberSessionService}). Tokens are returned only after the transaction has
 * committed, so the app never receives a token the database does not know about.
 */
@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private final GoogleIdTokenVerifier googleIdTokenVerifier;
    private final MemberRepository memberRepository;
    private final MemberService memberService;
    private final MemberSessionService sessionService;
    private final PushDeviceService pushDeviceService;
    private final SignupTicketRepository signupTicketRepository;
    private final AuthProperties properties;
    private final TransactionTemplate transactionTemplate;
    private final Clock clock;

    public AuthService(GoogleIdTokenVerifier googleIdTokenVerifier, MemberRepository memberRepository,
            MemberService memberService, MemberSessionService sessionService, PushDeviceService pushDeviceService,
            SignupTicketRepository signupTicketRepository, AuthProperties properties,
            TransactionTemplate transactionTemplate, Clock clock) {
        this.googleIdTokenVerifier = googleIdTokenVerifier;
        this.memberRepository = memberRepository;
        this.memberService = memberService;
        this.sessionService = sessionService;
        this.pushDeviceService = pushDeviceService;
        this.signupTicketRepository = signupTicketRepository;
        this.properties = properties;
        this.transactionTemplate = transactionTemplate;
        this.clock = clock;
    }

    /**
     * Logs an existing member in (replacing their session), or hands a new user a sign-up
     * ticket without creating a member.
     *
     * <p>The Google check runs before the transaction opens, so a slow key fetch does not
     * hold a database connection.
     */
    public GoogleLoginResponseDto loginWithGoogle(String idToken) {
        GoogleIdentity identity = verifyGoogle(idToken);
        return transactionTemplate.execute(status -> {
            Optional<Member> member = memberRepository.findActiveByProviderSubjectForUpdate(
                    AuthProvider.GOOGLE, identity.subject());
            if (member.isPresent()) {
                return GoogleLoginResponseDto.LoginSuccess.from(sessionService.start(member.get().getId()));
            }
            return issueSignupTicket(identity);
        });
    }

    /**
     * Creates the member, its settings, its agreements and its session in one transaction,
     * consuming the ticket in the same one. If anything fails the ticket survives, so the
     * user can retry with another nickname until it expires.
     */
    @Transactional
    public IssuedTokens signUp(String signupToken, String nickname, List<TermsAgreementCommand> agreements) {
        SignupTicket ticket = signupTicketRepository.findByTokenHashForUpdate(SecureTokens.sha256Hex(signupToken))
                .orElseThrow(() -> new BusinessException(AuthErrorCode.SIGNUP_TOKEN_INVALID, "unknown or used ticket"));
        if (ticket.isExpiredAt(OffsetDateTime.now(clock))) {
            throw new BusinessException(AuthErrorCode.SIGNUP_TOKEN_EXPIRED, "ticket expired");
        }
        // A ticket left over from before the account was created. Signing up must not log
        // in, so the existing session stays as it is and the app goes to Google login.
        if (memberRepository.existsByProviderAndProviderSubjectAndDeletedAtIsNull(
                ticket.getProvider(), ticket.getProviderSubject())) {
            throw new BusinessException(AuthErrorCode.ACCOUNT_ALREADY_REGISTERED, "account exists for ticket");
        }

        Member member = memberService.register(
                ticket.getEmail(), ticket.getProvider(), ticket.getProviderSubject(), nickname, agreements);
        IssuedTokens tokens = sessionService.start(member.getId());
        signupTicketRepository.delete(ticket);
        return tokens;
    }

    /**
     * Swaps a refresh token for a new pair within the same session. The access token is not
     * needed, expired or not; the refresh token is the credential.
     */
    @Transactional
    public IssuedTokens refresh(String refreshToken) {
        Long memberId = sessionService.ownerOf(refreshToken);
        memberRepository.findActiveByIdForUpdate(memberId)
                .orElseThrow(() -> new BusinessException(AuthErrorCode.REFRESH_TOKEN_INVALID, "member not active"));
        return sessionService.rotate(memberId, refreshToken);
    }

    /**
     * Ends the session the request was made with, if it is still the current one, and stops
     * pushes to the member's devices. A member has one session, so after logout no device is
     * signed in.
     */
    @Transactional
    public void logout(AuthenticatedMember member) {
        if (memberRepository.findActiveByIdForUpdate(member.memberId()).isPresent()) {
            sessionService.end(member.memberId(), member.sessionId());
            pushDeviceService.deactivateAll(member.memberId());
        }
    }

    private GoogleIdentity verifyGoogle(String idToken) {
        try {
            return googleIdTokenVerifier.verify(idToken);
        } catch (GoogleIdTokenInvalidException e) {
            throw new BusinessException(AuthErrorCode.GOOGLE_TOKEN_INVALID, "google id token rejected: " + e.getMessage());
        } catch (GoogleUnavailableException e) {
            log.error("cannot verify google id tokens", e);
            throw new BusinessException(SecurityErrorCode.AUTH_SERVICE_UNAVAILABLE, "google keys unavailable", e);
        }
    }

    private GoogleLoginResponseDto issueSignupTicket(GoogleIdentity identity) {
        if (identity.email() == null) {
            throw new BusinessException(AuthErrorCode.GOOGLE_EMAIL_UNAVAILABLE, "no verified email");
        }
        String signupToken = SecureTokens.randomToken();
        OffsetDateTime expiresAt = OffsetDateTime.now(clock).plus(properties.signupTicketTtl());
        signupTicketRepository.save(new SignupTicket(SecureTokens.sha256Hex(signupToken), AuthProvider.GOOGLE,
                identity.subject(), identity.email(), expiresAt));
        return GoogleLoginResponseDto.SignupRequired.of(signupToken, expiresAt);
    }

}
