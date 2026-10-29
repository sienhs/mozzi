package com.ssafy.mozzi.domain.gacha.dto;

/** Order of {@code GET /members/me/mozzis}. */
public enum MyMozziSort {
    /** 최근 획득순 */
    RECENT,
    /** 오래된 획득순 */
    OLDEST,
    /** 이름순 */
    NAME
}
