package com.ssafy.mozzi.support;

import java.time.LocalDate;

import org.springframework.jdbc.core.JdbcTemplate;

import com.ssafy.mozzi.domain.diary.entity.Emotion;
import com.ssafy.mozzi.domain.icon.entity.IconCategory;
import com.ssafy.mozzi.domain.image.entity.ImageStatus;

/**
 * Rows the diary tests need, written straight through JDBC.
 *
 * <p>Emoticons and base icons are registered by the server outside the migrations, so the
 * tests insert their own. Diaries and pictures are inserted directly when a test needs a
 * past date or a state the API cannot reach yet (a finished or failed picture).
 */
public final class DiaryFixtures {

    private final JdbcTemplate jdbcTemplate;

    public DiaryFixtures(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /** Empties every table the diary tests write to. */
    public void reset() {
        jdbcTemplate.execute("truncate table member, emoticon, icon cascade");
    }

    public Long emoticon(Emotion emotion) {
        return jdbcTemplate.queryForObject("""
                insert into emoticon (emotion, image_url, created_at, updated_at)
                values (?, ?, now(), now()) returning emoticon_id
                """, Long.class, emotion.name(), "https://cdn.test/emoticons/" + emotion.name().toLowerCase() + ".webp");
    }

    public Long icon() {
        Long id = jdbcTemplate.queryForObject("""
                insert into icon (image_url, created_at, updated_at)
                values ('pending', now(), now()) returning icon_id
                """, Long.class);
        jdbcTemplate.update("update icon set image_url = ? where icon_id = ?", "https://cdn.test/icons/" + id + ".webp", id);
        return id;
    }

    public Long myIcon(Long memberId, Long iconId, String name, IconCategory category) {
        return jdbcTemplate.queryForObject("""
                insert into my_icon (member_id, icon_id, name, category, created_at, updated_at)
                values (?, ?, ?, ?, clock_timestamp(), clock_timestamp()) returning my_icon_id
                """, Long.class, memberId, iconId, name, category.name());
    }

    public Long diary(Long memberId, LocalDate recordDate, Long emoticonId, Emotion emotion) {
        return diary(memberId, recordDate, emoticonId, emotion, null);
    }

    /** @param content the one-line diary, or {@code null} */
    public Long diary(Long memberId, LocalDate recordDate, Long emoticonId, Emotion emotion, String content) {
        return jdbcTemplate.queryForObject("""
                insert into diary (member_id, record_date, emoticon_id, emotion, content, created_at, updated_at)
                values (?, ?, ?, ?, ?, now(), now()) returning diary_id
                """, Long.class, memberId, recordDate, emoticonId, emotion.name(), content);
    }

    public void attach(Long diaryId, Long myIconId) {
        jdbcTemplate.update("insert into diary_icon (diary_id, my_icon_id) values (?, ?)", diaryId, myIconId);
    }

    /** A picture in the given state, as the worker would leave it. */
    public void picture(Long diaryId, ImageStatus status, int failureCount, String imageUrl) {
        jdbcTemplate.update("""
                insert into diary_image (diary_id, status, failure_count, character_id, what_name, image_url,
                                         created_at, updated_at)
                values (?, ?, ?, 1, '요리', ?, now(), now())
                """, diaryId, status.name(), failureCount, imageUrl);
        jdbcTemplate.update("update diary set diary_image_status = ? where diary_id = ?", status.name(), diaryId);
    }

}
