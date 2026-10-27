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
 * <p>Controllers depend on this annotation only, never on how authentication works. The id
 * comes from the access token {@link AuthenticationFilter} verified; a controller that also
 * needs the session id (logout) takes {@link AuthenticatedMember} instead.
 */
@Target(ElementType.PARAMETER)
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface CurrentMember {
}
