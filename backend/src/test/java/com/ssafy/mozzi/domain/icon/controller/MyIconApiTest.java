package com.ssafy.mozzi.domain.icon.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.support.TransactionTemplate;

import com.ssafy.mozzi.domain.auth.service.MemberSessionService;
import com.ssafy.mozzi.domain.diary.entity.Emotion;
import com.ssafy.mozzi.domain.icon.entity.IconCategory;
import com.ssafy.mozzi.domain.member.entity.AuthProvider;
import com.ssafy.mozzi.domain.member.entity.Member;
import com.ssafy.mozzi.domain.member.repository.MemberRepository;
import com.ssafy.mozzi.support.DiaryFixtures;
import com.ssafy.mozzi.support.IntegrationTest;

/**
 * {@code /my-icons} and {@code /emoticons} end to end.
 */
@IntegrationTest
@AutoConfigureMockMvc
class MyIconApiTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private MemberRepository memberRepository;

    @Autowired
    private MemberSessionService sessionService;

    @Autowired
    private TransactionTemplate transactionTemplate;

    private final Map<Long, String> accessTokens = new HashMap<>();

    private DiaryFixtures fixtures;
    private Long me;
    private Long someoneElse;

    @BeforeEach
    void setUp() {
        fixtures = new DiaryFixtures(jdbcTemplate);
        fixtures.reset();
        me = newMember("me");
        someoneElse = newMember("someoneElse");
        accessTokens.clear();
    }

    @Test
    void creatingReturnsTheIcon() throws Exception {
        create(me, "  도서관  ", "WHERE")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.myIconId").isNumber())
                .andExpect(jsonPath("$.iconId").doesNotExist())
                .andExpect(jsonPath("$.imageUrl").doesNotExist())
                .andExpect(jsonPath("$.name").value("도서관"))
                .andExpect(jsonPath("$.category").value("WHERE"))
                .andExpect(jsonPath("$.createdAt").isNotEmpty());
    }

    /** Same base image and same name are both fine (spec). */
    @Test
    void duplicatesAreTheMembersChoice() throws Exception {
        create(me, "우리집", "WHERE").andExpect(status().isCreated());
        create(me, "우리집", "WHERE").andExpect(status().isCreated());
    }

    @Test
    void nameMustBePresentAndAtMostTenCharacters() throws Exception {
        create(me, "가".repeat(11), "WHAT")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[0].field").value("name"))
                .andExpect(jsonPath("$.fieldErrors[0].reason").value("10자 이하로 입력해 주세요."));
        create(me, "   ", "WHAT")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[0].field").value("name"));
        create(me, " " + "가".repeat(10) + " ", "WHAT")
                .andExpect(status().isCreated());
    }

    @Test
    void categoryMustBeOneOfTheThree() throws Exception {
        create(me, "아침", "WHEN")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"));
    }

    @Test
    void nineIconsPerCategory() throws Exception {
        for (int i = 0; i < 9; i++) {
            create(me, "장소" + i, "WHERE").andExpect(status().isCreated());
        }

        create(me, "열번째", "WHERE")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("MY_ICON_LIMIT_EXCEEDED"));
        // The limit is per category and per member.
        create(me, "친구", "WHO").andExpect(status().isCreated());
        create(someoneElse, "장소", "WHERE").andExpect(status().isCreated());
    }

    @Test
    void aDeletedIconFreesItsPlace() throws Exception {
        Long first = fixtures.myIcon(me, "장소0", IconCategory.WHERE);
        for (int i = 1; i < 9; i++) {
            fixtures.myIcon(me, "장소" + i, IconCategory.WHERE);
        }

        mockMvc.perform(as(me, delete("/api/v1/my-icons/{id}", first))).andExpect(status().isNoContent());

        create(me, "새 장소", "WHERE").andExpect(status().isCreated());
    }

    @Test
    void listShowsOneCategoryOldestFirst() throws Exception {
        Long library = fixtures.myIcon(me, "도서관", IconCategory.WHERE);
        Long home = fixtures.myIcon(me, "우리집", IconCategory.WHERE);
        Long deleted = fixtures.myIcon(me, "회사", IconCategory.WHERE);
        fixtures.myIcon(me, "요리", IconCategory.WHAT);
        fixtures.myIcon(someoneElse, "카페", IconCategory.WHERE);
        mockMvc.perform(as(me, delete("/api/v1/my-icons/{id}", deleted))).andExpect(status().isNoContent());

        mockMvc.perform(as(me, get("/api/v1/my-icons").param("category", "WHERE")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.items[0].myIconId").value(library))
                .andExpect(jsonPath("$.items[1].myIconId").value(home))
                .andExpect(jsonPath("$.items[1].name").value("우리집"));
    }

    @Test
    void listNeedsACategory() throws Exception {
        mockMvc.perform(as(me, get("/api/v1/my-icons")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"));
    }

    @Test
    void onlyTheOwnerCanDeleteAndOnlyOnce() throws Exception {
        Long mine = fixtures.myIcon(me, "도서관", IconCategory.WHERE);

        mockMvc.perform(as(someoneElse, delete("/api/v1/my-icons/{id}", mine)))
                .andExpect(status().isNotFound());
        mockMvc.perform(as(me, delete("/api/v1/my-icons/{id}", mine)))
                .andExpect(status().isNoContent());
        mockMvc.perform(as(me, delete("/api/v1/my-icons/{id}", mine)))
                .andExpect(status().isNotFound());
    }


    @Test
    void emoticonsAreListedOnePerEmotion() throws Exception {
        Long happy = fixtures.emoticon(Emotion.HAPPY);
        fixtures.emoticon(Emotion.SAD);

        mockMvc.perform(as(me, get("/api/v1/emoticons")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.items[0].emoticonId").value(happy))
                .andExpect(jsonPath("$.items[0].emotion").value("HAPPY"))
                .andExpect(jsonPath("$.items[0].imageUrl").isNotEmpty());
    }

    private ResultActions create(Long memberId, String name, String category) throws Exception {
        return mockMvc.perform(as(memberId, post("/api/v1/my-icons"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"name": "%s", "category": "%s"}
                        """.formatted(name, category)));
    }

    private MockHttpServletRequestBuilder as(Long memberId, MockHttpServletRequestBuilder request) {
        String token = accessTokens.computeIfAbsent(memberId,
                id -> transactionTemplate.execute(status -> sessionService.start(id)).accessToken());
        return request.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
    }

    private Long newMember(String subject) {
        return memberRepository.saveAndFlush(
                Member.signUp(subject + "@gmail.com", AuthProvider.GOOGLE, subject, subject)).getId();
    }

}
