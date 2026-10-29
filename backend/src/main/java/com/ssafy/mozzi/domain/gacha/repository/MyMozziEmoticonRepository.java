package com.ssafy.mozzi.domain.gacha.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ssafy.mozzi.domain.gacha.entity.MyMozziEmoticon;

public interface MyMozziEmoticonRepository extends JpaRepository<MyMozziEmoticon, MyMozziEmoticon.Key> {

    List<MyMozziEmoticon> findByMemberId(Long memberId);

    @Modifying
    @Query("delete from MyMozziEmoticon m where m.memberId = :memberId")
    int deleteByMember(@Param("memberId") Long memberId);

}
