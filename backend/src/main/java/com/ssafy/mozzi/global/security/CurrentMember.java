package com.ssafy.mozzi.global.security;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Injects the authenticated member's id into a controller parameter of type {@link Long}.
 *
 * <pre>{@code
 * @GetMapping("/diaries/{diaryId}")
 * DiaryDetailResponseDto get(@CurrentMember Long memberId, @PathVariable Long diaryId)
 * }</pre>
 *
 * <p>Controllers depend on this annotation only, never on how authentication works, so
 * replacing the temporary header-based resolver with Spring Security changes
 * {@link CurrentMemberArgumentResolver} and nothing else.
 */
@Target(ElementType.PARAMETER)
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface CurrentMember {
}
