package com.ssafy.mozzi.domain.auth.service;

import java.time.Clock;
import java.time.OffsetDateTime;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.mozzi.domain.auth.repository.MemberSessionRepository;
import com.ssafy.mozzi.domain.auth.repository.SignupTicketRepository;

/**
 * Deletes expired sessions and sign-up tickets once a day.
 *
 * <p>Housekeeping only: an expired session or ticket is already refused when presented, so
 * nothing depends on this having run. Each pod runs it; the deletes are idempotent.
 */
@Component
public class ExpiredAuthDataCleaner {

    private static final Logger log = LoggerFactory.getLogger(ExpiredAuthDataCleaner.class);

    private final MemberSessionRepository sessionRepository;
    private final SignupTicketRepository signupTicketRepository;
    private final Clock clock;

    public ExpiredAuthDataCleaner(MemberSessionRepository sessionRepository,
            SignupTicketRepository signupTicketRepository, Clock clock) {
        this.sessionRepository = sessionRepository;
        this.signupTicketRepository = signupTicketRepository;
        this.clock = clock;
    }

    @Scheduled(cron = "0 30 4 * * *", zone = "Asia/Seoul")
    @Transactional
    public void deleteExpired() {
        OffsetDateTime now = OffsetDateTime.now(clock);
        int sessions = sessionRepository.deleteExpired(now);
        int tickets = signupTicketRepository.deleteExpired(now);
        log.info("expired auth data deleted: sessions={} signupTickets={}", sessions, tickets);
    }

}
