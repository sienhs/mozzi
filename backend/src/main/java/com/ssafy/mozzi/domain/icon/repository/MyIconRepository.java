package com.ssafy.mozzi.domain.icon.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ssafy.mozzi.domain.icon.entity.IconCategory;
import com.ssafy.mozzi.domain.icon.entity.MyIcon;

/**
 * Every lookup carries {@code memberId}: another member's icon is answered like a missing
 * one (spec 1.3), and cannot be attached to a diary.
 */
public interface MyIconRepository extends JpaRepository<MyIcon, Long> {

    Optional<MyIcon> findByIdAndMemberIdAndDeletedAtIsNull(Long id, Long memberId);

    long countByMemberIdAndCategoryAndDeletedAtIsNull(Long memberId, IconCategory category);

    /** Oldest first, the order the member made them in. */
    @Query("""
            select mi from MyIcon mi
            where mi.memberId = :memberId
              and mi.category = :category
              and mi.deletedAt is null
            order by mi.createdAt, mi.id
            """)
    List<MyIcon> findActiveByCategory(@Param("memberId") Long memberId, @Param("category") IconCategory category);

    @Query("""
            select mi from MyIcon mi
            where mi.id in :ids
              and mi.memberId = :memberId
              and mi.deletedAt is null
            """)
    List<MyIcon> findActiveByIds(@Param("ids") Collection<Long> ids, @Param("memberId") Long memberId);

}
