package com.ssafy.mozzi.domain.icon.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import com.ssafy.mozzi.domain.icon.entity.IconCategory;
import com.ssafy.mozzi.domain.icon.entity.MyIcon;

/**
 * Body of {@code POST /my-icons}.
 *
 * @param name stripped before the checks, so surrounding spaces neither count toward the
 *             limit nor pass as a name
 */
public record MyIconCreateRequestDto(
        @NotBlank(message = "이름을 입력해 주세요.")
        @Size(max = MyIcon.NAME_MAX_LENGTH, message = "10자 이하로 입력해 주세요.") String name,
        @NotNull(message = "카테고리를 골라 주세요.") IconCategory category) {

    public MyIconCreateRequestDto {
        name = name == null ? null : name.strip();
    }

}
