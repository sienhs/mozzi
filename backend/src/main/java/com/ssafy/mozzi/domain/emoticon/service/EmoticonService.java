package com.ssafy.mozzi.domain.emoticon.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.mozzi.domain.emoticon.dto.EmoticonListResponseDto;
import com.ssafy.mozzi.domain.emoticon.dto.EmoticonResponseDto;
import com.ssafy.mozzi.domain.emoticon.repository.EmoticonRepository;

@Service
public class EmoticonService {

    private final EmoticonRepository emoticonRepository;

    public EmoticonService(EmoticonRepository emoticonRepository) {
        this.emoticonRepository = emoticonRepository;
    }

    @Transactional(readOnly = true)
    public EmoticonListResponseDto list() {
        return new EmoticonListResponseDto(emoticonRepository.findAllByOrderByIdAsc().stream()
                .map(EmoticonResponseDto::of)
                .toList());
    }

}
