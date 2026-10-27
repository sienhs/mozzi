package com.ssafy.mozzi.domain.member.service;

import com.ssafy.mozzi.domain.member.entity.TermsType;

/** One document version the user agreed to on the sign-up screen. */
public record TermsAgreementCommand(TermsType type, String version) {
}
