package com.ssafy.mozzi.domain.gacha.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.ssafy.mozzi.domain.gacha.entity.CardTier;
import com.ssafy.mozzi.domain.gacha.entity.GachaTier;

public interface GachaTierRepository extends JpaRepository<GachaTier, CardTier> {
}
