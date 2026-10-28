package com.ssafy.mozzi.domain.icon.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.mozzi.domain.icon.dto.IconListResponseDto;
import com.ssafy.mozzi.domain.icon.dto.IconResponseDto;
import com.ssafy.mozzi.domain.icon.repository.IconRepository;

@Service
public class IconService {

    private final IconRepository iconRepository;

    public IconService(IconRepository iconRepository) {
        this.iconRepository = iconRepository;
    }

    @Transactional(readOnly = true)
    public IconListResponseDto list() {
        return new IconListResponseDto(iconRepository.findAllByOrderByIdAsc().stream()
                .map(IconResponseDto::of)
                .toList());
    }

}
