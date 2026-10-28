package com.ssafy.mozzi.domain.emoticon.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.mozzi.domain.emoticon.dto.EmoticonListResponseDto;
import com.ssafy.mozzi.domain.emoticon.service.EmoticonService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@Tag(name = "이모티콘")
@RestController
@RequestMapping("/emoticons")
public class EmoticonController {

    private final EmoticonService emoticonService;

    public EmoticonController(EmoticonService emoticonService) {
        this.emoticonService = emoticonService;
    }

    @Operation(summary = "이모티콘 목록", description = "감정마다 하나씩, 다섯 개.")
    @GetMapping
    public EmoticonListResponseDto list() {
        return emoticonService.list();
    }

}
