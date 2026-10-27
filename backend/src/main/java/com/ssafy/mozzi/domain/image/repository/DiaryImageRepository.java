package com.ssafy.mozzi.domain.image.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.ssafy.mozzi.domain.image.entity.DiaryImage;

public interface DiaryImageRepository extends JpaRepository<DiaryImage, Long> {
}
