package com.ssafy.mozzi.domain.diary.service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

import org.springframework.stereotype.Component;

import com.ssafy.mozzi.domain.diary.exception.DiaryErrorCode;
import com.ssafy.mozzi.global.exception.BusinessException;

/**
 * Which days a diary may be written for (spec 4.4, policy 1).
 *
 * <p>Only today, in the service timezone. Until {@link #GRACE_UNTIL} the previous day is
 * accepted too, so someone who starts writing at 23:50 and saves at 00:05 does not lose
 * their entry to the date change.
 */
@Component
public class RecordDatePolicy {

    /** End of the grace window after midnight, exclusive. */
    static final LocalTime GRACE_UNTIL = LocalTime.of(3, 0);

    private final Clock clock;

    public RecordDatePolicy(Clock clock) {
        this.clock = clock;
    }

    public void validate(LocalDate recordDate) {
        if (!isAllowed(recordDate)) {
            throw new BusinessException(DiaryErrorCode.INVALID_RECORD_DATE, "record date not allowed: " + recordDate);
        }
    }

    boolean isAllowed(LocalDate recordDate) {
        LocalDateTime now = LocalDateTime.now(clock);
        LocalDate today = now.toLocalDate();
        if (recordDate.equals(today)) {
            return true;
        }
        return recordDate.equals(today.minusDays(1)) && now.toLocalTime().isBefore(GRACE_UNTIL);
    }

}
