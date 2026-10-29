package com.ssafy.mozzi.domain.gacha.repository;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import com.ssafy.mozzi.domain.gacha.entity.MozziCard;

public interface MozziCardRepository extends JpaRepository<MozziCard, Long> {

    /**
     * The draw pool and the collection. A hundred or so rows, read whole. Ordered so that a
     * card index means the same card from one read to the next.
     */
    List<MozziCard> findByActiveTrueOrderByIdAsc();

    Optional<MozziCard> findByIdAndActiveTrue(Long id);

    long countByActiveTrue();

    /** Every card's code, active or not, so the seeder skips cards already registered. */
    @Query("select c.code from MozziCard c")
    Set<String> findAllCodes();

}
