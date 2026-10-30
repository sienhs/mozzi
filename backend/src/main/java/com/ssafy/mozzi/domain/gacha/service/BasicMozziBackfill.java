package com.ssafy.mozzi.domain.gacha.service;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.mozzi.domain.gacha.repository.MemberCardRepository;

/**
 * Hands the basic mozzi to members who lack them, at start-up right after
 * {@link MozziCardSeeder}: members who signed up before a basic mozzi was registered, and
 * everyone when the cards are first seeded. New members get them at sign-up.
 *
 * <p>Picks only emotions the member has not picked yet, so a mozzi already chosen stays.
 * Off with the seeder ({@code mozzi.gacha.seed-cards}).
 */
@Component
@Order(2)
@ConditionalOnProperty(name = "mozzi.gacha.seed-cards", havingValue = "true", matchIfMissing = true)
public class BasicMozziBackfill implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(BasicMozziBackfill.class);

    private final MemberCardRepository memberCardRepository;
    private final MyMozziService myMozziService;

    public BasicMozziBackfill(MemberCardRepository memberCardRepository, MyMozziService myMozziService) {
        this.memberCardRepository = memberCardRepository;
        this.myMozziService = myMozziService;
    }

    @Override
    @Transactional
    public void run(String... args) {
        List<Long> members = memberCardRepository.findMembersLackingBasic();
        members.forEach(myMozziService::grantBasic);
        if (!members.isEmpty()) {
            log.info("basic mozzi: given to {} members", members.size());
        }
    }

}
