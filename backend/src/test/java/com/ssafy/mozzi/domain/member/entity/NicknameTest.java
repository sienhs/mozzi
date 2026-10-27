package com.ssafy.mozzi.domain.member.entity;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.regex.Pattern;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class NicknameTest {

    private static final Pattern RULE = Pattern.compile(Nickname.PATTERN);

    @ParameterizedTest
    @ValueSource(strings = {"하루", "Alice", "mozzi2026", "가나다라마바사아자차카타", "a1"})
    void accepts(String nickname) {
        assertThat(RULE.matcher(nickname).matches()).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "a",                       // too short
        "가나다라마바사아자차카타파",   // 13 characters
        "하 루",                    // space
        " 하루",                    // leading space is rejected, not trimmed
        "ㅎㅏ루",                    // lone jamo
        "하루!",                    // symbol
        "하루😀",                   // emoji
        "Ａlice",                   // full-width letter
    })
    void rejects(String nickname) {
        assertThat(RULE.matcher(nickname).matches()).isFalse();
    }

    @ParameterizedTest
    @ValueSource(strings = {"Alice", "ALICE", "alice"})
    void comparesIgnoringAsciiCase(String nickname) {
        assertThat(Nickname.comparisonKey(nickname)).isEqualTo("alice");
    }

}
