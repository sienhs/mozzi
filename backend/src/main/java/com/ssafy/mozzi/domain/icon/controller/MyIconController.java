package com.ssafy.mozzi.domain.icon.controller;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.mozzi.domain.icon.dto.MyIconCreateRequestDto;
import com.ssafy.mozzi.domain.icon.dto.MyIconListResponseDto;
import com.ssafy.mozzi.domain.icon.dto.MyIconResponseDto;
import com.ssafy.mozzi.domain.icon.dto.MyIconSearchRequestDto;
import com.ssafy.mozzi.domain.icon.service.MyIconService;
import com.ssafy.mozzi.global.security.CurrentMember;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;

@Tag(name = "아이콘")
@RestController
@RequestMapping("/my-icons")
public class MyIconController {

    private final MyIconService myIconService;

    public MyIconController(MyIconService myIconService) {
        this.myIconService = myIconService;
    }

    @Operation(summary = "아이콘 만들기", description = "카테고리마다 30개까지. 넘으면 409.")
    @ApiResponse(responseCode = "201", description = "만들어짐")
    @PostMapping
    public ResponseEntity<MyIconResponseDto> create(
            @CurrentMember Long memberId, @Valid @RequestBody MyIconCreateRequestDto request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(myIconService.create(memberId, request));
    }

    @Operation(summary = "내 아이콘 목록", description = "한 카테고리의 아이콘을 만든 순서로.")
    @GetMapping
    public MyIconListResponseDto list(
            @CurrentMember Long memberId, @Valid @ModelAttribute MyIconSearchRequestDto request) {
        return myIconService.list(memberId, request.category());
    }

    @Operation(summary = "아이콘 삭제", description = "이 아이콘을 붙였던 일기에서도 보이지 않게 된다.")
    @ApiResponse(responseCode = "204", description = "삭제됨")
    @DeleteMapping("/{myIconId}")
    public ResponseEntity<Void> delete(@CurrentMember Long memberId, @PathVariable Long myIconId) {
        myIconService.delete(memberId, myIconId);
        return ResponseEntity.noContent().build();
    }

}
