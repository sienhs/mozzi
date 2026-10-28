package com.ssafy.mozzi.domain.home.service;

import java.time.Clock;
import java.time.LocalDate;
import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.mozzi.domain.diary.dto.DiaryDetailResponseDto;
import com.ssafy.mozzi.domain.diary.service.DiaryService;
import com.ssafy.mozzi.domain.home.dto.HomeResponseDto;
import com.ssafy.mozzi.domain.home.dto.TodayStatus;
import com.ssafy.mozzi.domain.icon.entity.IconCategory;
import com.ssafy.mozzi.domain.image.entity.DiaryImage;
import com.ssafy.mozzi.domain.image.repository.DiaryImageRepository;

/**
 * The home screen in one call: which state today is in and the diaries it shows.
 */
@Service
public class HomeService {

    private final DiaryService diaryService;
    private final DiaryImageRepository diaryImageRepository;
    private final Clock clock;

    public HomeService(DiaryService diaryService, DiaryImageRepository diaryImageRepository, Clock clock) {
        this.diaryService = diaryService;
        this.diaryImageRepository = diaryImageRepository;
        this.clock = clock;
    }

    /**
     * Reads the picture twice: once inside {@code todayDiary}, once here for the failure
     * count. Repeatable read gives every query the same snapshot, so a picture requested in
     * between cannot show up in one read and not the other.
     */
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public HomeResponseDto get(Long memberId) {
        LocalDate today = LocalDate.now(clock);
        DiaryDetailResponseDto todayDiary = diaryService.findDaily(memberId, today).orElse(null);
        DiaryDetailResponseDto recentDiary = diaryService.findLatestBefore(memberId, today).orElse(null);
        if (todayDiary == null) {
            return new HomeResponseDto(today, TodayStatus.NOT_RECORDED, null, false, recentDiary);
        }
        // The response only carries the status; whether a failure may be retried needs the row.
        Optional<DiaryImage> image = diaryImageRepository.findByDiaryId(todayDiary.diaryId());
        return new HomeResponseDto(
                today,
                statusOf(image),
                todayDiary,
                canRequestImage(todayDiary, image),
                recentDiary);
    }

    /**
     * Mirrors what {@code POST /diaries/{id}/image} accepts, as of this read. A picture needs
     * a "what" icon, and a deleted icon drops out of the diary, so a diary can lose the last one.
     */
    private static boolean canRequestImage(DiaryDetailResponseDto todayDiary, Optional<DiaryImage> image) {
        if (todayDiary.myIcons().get(IconCategory.WHAT).isEmpty()) {
            return false;
        }
        return image.map(DiaryImage::canRetry).orElse(true);
    }

    private static TodayStatus statusOf(Optional<DiaryImage> image) {
        if (image.isEmpty()) {
            return TodayStatus.IMAGE_NOT_REQUESTED;
        }
        return switch (image.get().getStatus()) {
            case PENDING -> TodayStatus.IMAGE_PENDING;
            case SUCCEEDED -> TodayStatus.COMPLETED;
            case FAILED -> TodayStatus.IMAGE_FAILED;
        };
    }

}
