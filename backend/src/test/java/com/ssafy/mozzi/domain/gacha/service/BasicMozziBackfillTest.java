package com.ssafy.mozzi.domain.gacha.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;

import com.ssafy.mozzi.domain.diary.entity.Emotion;
import com.ssafy.mozzi.domain.gacha.entity.CardTier;
import com.ssafy.mozzi.domain.gacha.repository.MemberCardRepository;
import com.ssafy.mozzi.domain.member.entity.AuthProvider;
import com.ssafy.mozzi.domain.member.entity.Member;
import com.ssafy.mozzi.domain.member.repository.MemberRepository;
import com.ssafy.mozzi.support.DiaryFixtures;
import com.ssafy.mozzi.support.GachaFixtures;
import com.ssafy.mozzi.support.IntegrationTest;

/** Members who signed up before the basic mozzi existed get them at the next start-up. */
@IntegrationTest
class BasicMozziBackfillTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private TransactionTemplate transactionTemplate;

    @Autowired
    private MemberRepository memberRepository;

    @Autowired
    private MemberCardRepository memberCardRepository;

    @Autowired
    private MyMozziService myMozziService;

    private GachaFixtures gacha;
    private BasicMozziBackfill backfill;

    @BeforeEach
    void setUp() {
        new DiaryFixtures(jdbcTemplate).reset();
        gacha = new GachaFixtures(jdbcTemplate);
        gacha.reset();
        backfill = new BasicMozziBackfill(memberCardRepository, myMozziService);
    }

    @AfterEach
    void tearDown() {
        gacha.reset();
    }

    @Test
    void givesTheBasicMozziAndKeepsAnEarlierPick() {
        Long happy = gacha.card("BASIC-01", CardTier.NONE, Emotion.HAPPY, true);
        Long calm = gacha.card("BASIC-02", CardTier.NONE, Emotion.CALM, true);
        Long rabbit = gacha.card("S1-01-02", CardTier.LEGENDARY, Emotion.CALM, true);
        Long picker = member("picker");
        Long fresh = member("fresh");
        Long gone = member("gone");
        jdbcTemplate.update("update member set deleted_at = now() where member_id = ?", gone);
        gacha.owned(picker, rabbit);
        jdbcTemplate.update("""
                insert into my_mozzi_emoticon (member_id, emotion, card_id, updated_at)
                values (?, 'CALM', ?, now())
                """, picker, rabbit);

        run();
        run();

        assertThat(owned(picker)).containsExactly(happy, calm, rabbit);
        assertThat(picks(picker)).containsExactly("CALM:" + rabbit, "HAPPY:" + happy);
        assertThat(owned(fresh)).containsExactly(happy, calm);
        assertThat(picks(fresh)).containsExactly("CALM:" + calm, "HAPPY:" + happy);
        assertThat(owned(gone)).isEmpty();
        // Given, not drawn: no NEW mark.
        assertThat(jdbcTemplate.queryForObject(
                "select count(*) from member_card where seen_at is null", Integer.class)).isZero();
    }

    private void run() {
        transactionTemplate.executeWithoutResult(status -> backfill.run());
    }

    private Long member(String name) {
        return memberRepository.saveAndFlush(
                Member.signUp(name + "@gmail.com", AuthProvider.GOOGLE, name, name)).getId();
    }

    private List<Long> owned(Long memberId) {
        return jdbcTemplate.queryForList(
                "select card_id from member_card where member_id = ? order by card_id", Long.class, memberId);
    }

    private List<String> picks(Long memberId) {
        return jdbcTemplate.queryForList(
                "select emotion || ':' || card_id from my_mozzi_emoticon where member_id = ? order by emotion",
                String.class, memberId);
    }

}
