package com.ssafy.mozzi.domain.member.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
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
import org.springframework.transaction.support.TransactionTemplate;

import com.ssafy.mozzi.domain.auth.service.MemberSessionService;
import com.ssafy.mozzi.domain.member.entity.AuthProvider;
import com.ssafy.mozzi.domain.member.entity.Member;
import com.ssafy.mozzi.domain.member.repository.MemberRepository;
import com.ssafy.mozzi.support.DiaryFixtures;
import com.ssafy.mozzi.support.GachaFixtures;
import com.ssafy.mozzi.support.IntegrationTest;

/**
 * {@code PUT /members/me/push-tokens}, and what logout and withdrawal do to the rows.
 */
@IntegrationTest
@AutoConfigureMockMvc
class PushTokenApiTest {

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

    private Long me;
    private String myToken;

    @BeforeEach
    void setUp() {
        new DiaryFixtures(jdbcTemplate).reset();
        me = newMember("me");
        myToken = token(me);
    }

    @Test
    void registeringSavesAnActiveRow() throws Exception {
        register(myToken, "fcm-1", "ANDROID", "phone").andExpect(status().isNoContent());

        assertThat(devices(me)).containsExactly(Map.of("device_id", "phone", "token", "fcm-1", "is_active", true));
        assertThat(platformOf(me, "phone")).isEqualTo("ANDROID");
    }

    /** The app registers on every launch; the same device keeps one row with the newest token. */
    @Test
    void theSameDeviceOverwritesItsRow() throws Exception {
        register(myToken, "fcm-1", "ANDROID", "phone");
        register(myToken, "fcm-2", "ANDROID", "phone");

        assertThat(devices(me)).containsExactly(Map.of("device_id", "phone", "token", "fcm-2", "is_active", true));
    }

    /** One session per member: the device signed in last is the only one that gets pushes. */
    @Test
    void aNewDeviceTurnsTheOldOneOff() throws Exception {
        register(myToken, "fcm-phone", "ANDROID", "phone");
        register(myToken, "fcm-tablet", "IOS", "tablet");

        assertThat(devices(me)).containsExactly(
                Map.of("device_id", "phone", "token", "fcm-phone", "is_active", false),
                Map.of("device_id", "tablet", "token", "fcm-tablet", "is_active", true));
    }

    /** Someone else signing in on my phone must not get my pushes, nor I theirs. */
    @Test
    void anotherMemberOnTheSamePhoneTakesTheTokenOver() throws Exception {
        Long friend = newMember("friend");
        register(myToken, "fcm-shared", "ANDROID", "my-device-id");
        register(token(friend), "fcm-shared", "ANDROID", "friend-device-id");

        assertThat(devices(me)).extracting(row -> row.get("is_active")).containsExactly(false);
        assertThat(devices(friend)).extracting(row -> row.get("is_active")).containsExactly(true);
    }

    @Test
    void logoutTurnsTheDeviceOff() throws Exception {
        register(myToken, "fcm-1", "ANDROID", "phone");

        mockMvc.perform(post("/api/v1/auth/logout").header(HttpHeaders.AUTHORIZATION, "Bearer " + myToken))
                .andExpect(status().isNoContent());

        assertThat(devices(me)).extracting(row -> row.get("is_active")).containsExactly(false);
    }

    @Test
    void withdrawalDeletesTheRows() throws Exception {
        register(myToken, "fcm-1", "ANDROID", "phone");

        mockMvc.perform(delete("/api/v1/members/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + myToken))
                .andExpect(status().isNoContent());

        assertThat(devices(me)).isEmpty();
    }

    @Test
    void aMissingTokenIsRejected() throws Exception {
        register(myToken, " ", "ANDROID", "phone").andExpect(status().isBadRequest());
        register(myToken, "fcm-1", "WINDOWS", "phone").andExpect(status().isBadRequest());

        assertThat(devices(me)).isEmpty();
    }

    private ResultActions register(String accessToken, String fcmToken, String platform, String deviceId)
            throws Exception {
        return mockMvc.perform(put("/api/v1/members/me/push-tokens")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"token": "%s", "platform": "%s", "deviceId": "%s"}
                        """.formatted(fcmToken, platform, deviceId)));
    }

    private List<Map<String, Object>> devices(Long memberId) {
        return jdbcTemplate.queryForList(
                "select device_id, token, is_active from push_device where member_id = ? order by device_id", memberId);
    }

    private String platformOf(Long memberId, String deviceId) {
        return jdbcTemplate.queryForObject(
                "select platform from push_device where member_id = ? and device_id = ?", String.class, memberId, deviceId);
    }

    private Long newMember(String name) {
        Long memberId = memberRepository.saveAndFlush(
                Member.signUp(name + "@gmail.com", AuthProvider.GOOGLE, name, name)).getId();
        // Withdrawal deletes the wallet the sign-up transaction would have opened.
        new GachaFixtures(jdbcTemplate).wallet(memberId);
        return memberId;
    }

    private String token(Long memberId) {
        return transactionTemplate.execute(status -> sessionService.start(memberId)).accessToken();
    }

}
