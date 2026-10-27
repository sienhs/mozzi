package com.ssafy.mozzi.global.util;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class MaskerTest {

    /** The exact shape the sign-up screen shows (API spec 4.1). */
    @Test
    void emailKeepsTwoCharactersAndTheDomain() {
        assertThat(Masker.email("haru@gmail.com")).isEqualTo("ha***@gmail.com");
    }

    @Test
    void shortLocalPartIsHiddenCompletely() {
        assertThat(Masker.email("ab@gmail.com")).isEqualTo("***@gmail.com");
        assertThat(Masker.email("a@gmail.com")).isEqualTo("***@gmail.com");
    }

    @Test
    void valueWithoutAnAtSignIsHiddenCompletely() {
        assertThat(Masker.email("not-an-email")).isEqualTo("***");
    }

    @Test
    void blankEmailStaysNull() {
        assertThat(Masker.email(null)).isNull();
        assertThat(Masker.email("  ")).isNull();
    }

    @Test
    void secretKeepsEnoughToTellTwoTokensApart() {
        assertThat(Masker.secret("eyJhbGciOiJSUzI1NiIs")).isEqualTo("eyJh***");
    }

    @Test
    void shortSecretIsHiddenCompletely() {
        assertThat(Masker.secret("abcd")).isEqualTo("***");
    }

    @Test
    void secretNeverKeepsMoreThanItsPrefix() {
        String token = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature";

        assertThat(Masker.secret(token)).doesNotContain("payload", "signature");
    }

}
