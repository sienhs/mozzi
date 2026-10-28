package com.ssafy.mozzi.domain.emoticon.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.ssafy.mozzi.domain.emoticon.entity.Emoticon;

public interface EmoticonRepository extends JpaRepository<Emoticon, Long> {

    List<Emoticon> findAllByOrderByIdAsc();

}
