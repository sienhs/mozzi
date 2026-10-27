package com.ssafy.mozzi.domain.member.entity;

import java.util.Locale;

/**
 * Nickname rules.
 *
 * <p>2 to 12 characters of complete Hangul syllables, ASCII letters and digits. Whitespace,
 * symbols, lone jamo and emoji are rejected rather than stripped: quietly removing a space
 * would register a nickname the user never typed.
 *
 * <p>The nickname is stored as typed, but two nicknames that differ only in letter case are
 * the same nickname ({@code Alice} and {@code alice} collide). The database enforces this
 * with a unique index on {@code lower(nickname)}; {@link #comparisonKey} is the matching
 * value for application-side lookups.
 */
public final class Nickname {

    public static final int MAX_LENGTH = 12;

    /** {@code 가-힣} covers exactly the complete syllables U+AC00..U+D7A3, no lone jamo. */
    public static final String PATTERN = "^[가-힣A-Za-z0-9]{2,12}$";

    public static final String RULE_MESSAGE = "닉네임은 2~12자의 한글, 영문, 숫자로 입력해 주세요.";

    private Nickname() {
    }

    /**
     * The value nicknames are compared by. {@link Locale#ROOT} keeps the result independent
     * of the server's locale; the allowed characters leave only ASCII letters to change.
     */
    public static String comparisonKey(String nickname) {
        return nickname.toLowerCase(Locale.ROOT);
    }

}
