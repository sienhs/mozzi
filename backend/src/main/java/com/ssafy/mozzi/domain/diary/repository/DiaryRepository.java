package com.ssafy.mozzi.domain.diary.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import jakarta.persistence.LockModeType;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ssafy.mozzi.domain.diary.entity.Diary;
import com.ssafy.mozzi.domain.diary.entity.Emotion;
import com.ssafy.mozzi.domain.icon.entity.MyIcon;

/**
 * Every lookup carries {@code memberId}: someone else's diary is answered with 404, the
 * same as a missing one (spec 1.3), so ownership is part of the query rather than a check
 * after it.
 */
public interface DiaryRepository extends JpaRepository<Diary, Long> {

    /**
     * The read every write to an existing diary starts from.
     *
     * <p>Without the row lock, two picture requests for the same diary could both see "no
     * picture yet" and both start one. With it, the second waits for the first to commit and
     * then reads the committed status.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select d from Diary d where d.id = :id and d.memberId = :memberId and d.deletedAt is null")
    Optional<Diary> findForUpdate(@Param("id") Long id, @Param("memberId") Long memberId);

    /**
     * Same lock as {@link #findForUpdate}, for writers outside a member's request: a result
     * from the AI server or the timeout watchdog. They share the lock with the picture
     * request, so a result never lands between a request's check and its write.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select d from Diary d where d.id = :id and d.deletedAt is null")
    Optional<Diary> findByIdForUpdate(@Param("id") Long id);

    Optional<Diary> findByIdAndMemberIdAndDeletedAtIsNull(Long id, Long memberId);

    Optional<Diary> findByMemberIdAndRecordDateAndDeletedAtIsNull(Long memberId, LocalDate recordDate);

    Optional<Diary> findFirstByMemberIdAndRecordDateBeforeAndDeletedAtIsNullOrderByRecordDateDesc(
            Long memberId, LocalDate recordDate);

    /** The calendar month: one row per day written, at most 31. */
    List<Diary> findByMemberIdAndRecordDateBetweenAndDeletedAtIsNullOrderByRecordDateAsc(
            Long memberId, LocalDate from, LocalDate to);

    /**
     * One page of {@code GET /diaries}, newest day first.
     *
     * <p>The cursor compares {@code (record_date, diary_id)} together (convention 4.3). One
     * live diary per day makes {@code record_date} unique per member today, but a page would
     * silently skip rows the moment that rule changed, and the id costs nothing.
     *
     * <p>The date parameters are cast before {@code is null}: PostgreSQL cannot infer the
     * type of a bare null parameter and fails the whole query with "could not determine data
     * type of parameter" (verified). The enum parameter binds as varchar and needs no cast.
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
              and (cast(:cursorDate as LocalDate) is null
                    or d.recordDate < :cursorDate
                    or (d.recordDate = :cursorDate and d.id < :cursorId))
            order by d.recordDate desc, d.id desc
            """)
    List<Diary> search(
            @Param("memberId") Long memberId,
            @Param("emotion") Emotion emotion,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to,
            @Param("cursorDate") LocalDate cursorDate,
            @Param("cursorId") Long cursorId,
            Pageable pageable);

    /**
     * A diary's icons that are still live, with their base images, oldest first. Deleted
     * icons are left out, so a diary can come back with none.
     */
    @Query("""
            select mi from Diary d join d.myIcons mi join fetch mi.icon
            where d.id = :diaryId
              and mi.deletedAt is null
            order by mi.createdAt, mi.id
            """)
    List<MyIcon> findActiveIcons(@Param("diaryId") Long diaryId);

}
