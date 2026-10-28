package com.ssafy.mozzi.domain.icon.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.ssafy.mozzi.domain.icon.entity.Icon;

public interface IconRepository extends JpaRepository<Icon, Long> {

    List<Icon> findAllByOrderByIdAsc();

}
