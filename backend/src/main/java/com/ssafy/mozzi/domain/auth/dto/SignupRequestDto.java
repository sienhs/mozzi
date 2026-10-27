package com.ssafy.mozzi.domain.auth.dto;

import java.util.List;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import com.ssafy.mozzi.domain.member.entity.Nickname;
import com.ssafy.mozzi.domain.member.entity.TermsType;
import com.ssafy.mozzi.domain.member.service.TermsAgreementCommand;

/**
 * {@code POST /auth/signup}.
 *
 * <p>A nickname that breaks the rules is rejected here, before the ticket is even looked
 * at, so the user can correct it and submit the same ticket again.
 *
 * @param agreedTerms every required document with the version the app showed
 */
public record SignupRequestDto(
        @NotBlank @Size(max = 64) String signupToken,
        @NotNull @Pattern(regexp = Nickname.PATTERN, message = Nickname.RULE_MESSAGE) String nickname,
        @NotEmpty List<@Valid @NotNull AgreedTerms> agreedTerms) {

    public List<TermsAgreementCommand> agreements() {
        return agreedTerms.stream().map(terms -> new TermsAgreementCommand(terms.type(), terms.version())).toList();
    }

    public record AgreedTerms(@NotNull TermsType type, @NotBlank @Size(max = 20) String version) {
    }

}
