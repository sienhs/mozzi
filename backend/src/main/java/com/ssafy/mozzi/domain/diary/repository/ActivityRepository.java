package com.ssafy.mozzi.domain.diary.repository;

import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.ssafy.mozzi.domain.diary.entity.Activity;
import com.ssafy.mozzi.domain.diary.entity.ActivityCode;

public interface ActivityRepository extends JpaRepository<Activity, Long> {

    List<Activity> findByCodeInAndActiveTrue(Collection<ActivityCode> codes);

}
