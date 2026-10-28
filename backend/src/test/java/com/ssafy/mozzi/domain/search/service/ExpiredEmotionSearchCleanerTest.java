package com.ssafy.mozzi.domain.search.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.LocalDate;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import com.ssafy.mozzi.domain.diary.entity.Emotion;
import com.ssafy.mozzi.domain.member.entity.AuthProvider;
import com.ssafy.mozzi.domain.member.entity.Member;
import com.ssafy.mozzi.domain.member.repository.MemberRepository;
import com.ssafy.mozzi.support.DiaryFixtures;
import com.ssafy.mozzi.support.IntegrationTest;

@IntegrationTest
class ExpiredEmotionSearchCleanerTest {

    @Autowired
    private ExpiredEmotionSearchCleaner cleaner;

    @Autowired
    private MemberRepository memberRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private Clock clock;

    private Long me;
    private Long diaryId;

    @BeforeEach
    void setUp() {
        DiaryFixtures fixtures = new DiaryFixtures(jdbcTemplate);
        fixtures.reset();
        me = memberRepository.saveAndFlush(Member.signUp("me@gmail.com", AuthProvider.GOOGLE, "me", "me")).getId();
        diaryId = fixtures.diary(me, LocalDate.now(clock), fixtures.emoticon(Emotion.CALM), Emotion.CALM);
    }

    /** The result rows reference the question, so they must go first or the delete fails. */
    @Test
    void questionsPastNinetyDaysGoWithTheirResults() {
        long expired = insertSearch("91 days");
        long kept = insertSearch("89 days");

        cleaner.deleteExpired();

        assertThat(jdbcTemplate.queryForList("select emotion_search_id from emotion_search", Long.class))
                .containsExactly(kept);
        assertThat(jdbcTemplate.queryForList("select emotion_search_id from emotion_search_result", Long.class))
                .containsExactly(kept)
                .doesNotContain(expired);
        // The diary an answer was based on is the member's own record, not search data.
        assertThat(jdbcTemplate.queryForObject(
                "select count(*) from diary where diary_id = ?", Integer.class, diaryId)).isEqualTo(1);
    }

    private long insertSearch(String age) {
        Long searchId = jdbcTemplate.queryForObject("insert into emotion_search "
                + "(member_id, question, result_type, answer, created_at) "
                + "values (?, '마음이 편했던 날', 'FOUND', '하루 있었어요.', now() - cast(? as interval)) "
                + "returning emotion_search_id", Long.class, me, age);
        jdbcTemplate.update("insert into emotion_search_result (emotion_search_id, diary_id, rank_no, is_featured) "
                + "values (?, ?, 1, true)", searchId, diaryId);
        return searchId;
    }

}
