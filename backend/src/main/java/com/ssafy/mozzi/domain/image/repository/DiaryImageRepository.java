package com.ssafy.mozzi.domain.image.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.ssafy.mozzi.domain.image.entity.DiaryImage;

public interface DiaryImageRepository extends JpaRepository<DiaryImage, Long> {

    Optional<DiaryImage> findByDiaryId(Long diaryId);

    /** Pictures of a page of diaries in one query, for list responses (convention 4.4). */
    List<DiaryImage> findByDiaryIdIn(Collection<Long> diaryIds);

}
