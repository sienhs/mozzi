package com.ssafy.mozzi.domain.diary.repository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import jakarta.persistence.LockModeType;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ssafy.mozzi.domain.diary.entity.ActivityCode;
import com.ssafy.mozzi.domain.diary.entity.Diary;
import com.ssafy.mozzi.domain.diary.entity.Emotion;

/**
 * Every lookup carries {@code memberId}: someone else's diary is answered with 404, the
 * same as a missing one (spec 1.3), so ownership is part of the query rather than a check
 * after it.
 */
public interface DiaryRepository extends JpaRepository<Diary, Long> {

    Optional<Diary> findByIdAndMemberIdAndDeletedAtIsNull(Long id, Long memberId);

    /**
     * The read every write to an existing diary starts from.
     *
     * <p>Without the row lock, two writers that both read the diary first can each save
     * what they read, so a memo edit puts back an emotion another request just changed, or
     * an edit racing a delete writes {@code deleted_at = null} and brings the diary back
     * (both reproduced). With it, the second writer waits for the first to commit and then
     * reads the committed row — PostgreSQL re-checks the {@code where} clause after the
     * wait, so a diary deleted in the meantime is simply not found.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select d from Diary d where d.id = :id and d.memberId = :memberId and d.deletedAt is null")
    Optional<Diary> findForUpdate(@Param("id") Long id, @Param("memberId") Long memberId);

    Optional<Diary> findByMemberIdAndRecordDateAndDeletedAtIsNull(Long memberId, LocalDate recordDate);

    /**
     * One page of {@code GET /diaries}, newest day first.
     *
     * <p>The cursor compares {@code (record_date, diary_id)} together (convention 4.3). One
     * live diary per day makes {@code record_date} unique per member today, but a page would
     * silently skip rows the moment that rule changed, and the id costs nothing.
     *
     * <p>The date parameters are cast before {@code is null}: PostgreSQL cannot infer the
     * type of a bare null parameter and fails the whole query with "could not determine data
     * type of parameter" (verified). The enum parameters bind as varchar and need no cast.
     *
     * @param pageable only its size is used; callers ask for one row more than the page
     */
    @Query("""
            select d from Diary d
            where d.memberId = :memberId
              and d.deletedAt is null
              and (:emotion is null or d.emotion = :emotion)
              and (cast(:from as LocalDate) is null or d.recordDate >= :from)
              and (cast(:to as LocalDate) is null or d.recordDate <= :to)
              and (:activity is null or exists (
                    select 1 from d.activities a where a.code = :activity))
              and (cast(:cursorDate as LocalDate) is null
                    or d.recordDate < :cursorDate
                    or (d.recordDate = :cursorDate and d.id < :cursorId))
            order by d.recordDate desc, d.id desc
            """)
    List<Diary> search(
            @Param("memberId") Long memberId,
            @Param("emotion") Emotion emotion,
            @Param("activity") ActivityCode activity,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to,
            @Param("cursorDate") LocalDate cursorDate,
            @Param("cursorId") Long cursorId,
            Pageable pageable);

    /** Activities of a page of diaries in one query, for list responses (convention 4.4). */
    @Query("""
            select new com.ssafy.mozzi.domain.diary.repository.DiaryActivityRow(d.id, a.code)
            from Diary d join d.activities a
            where d.id in :diaryIds
            order by a.sortOrder
            """)
    List<DiaryActivityRow> findActivityCodes(@Param("diaryIds") Collection<Long> diaryIds);

}
