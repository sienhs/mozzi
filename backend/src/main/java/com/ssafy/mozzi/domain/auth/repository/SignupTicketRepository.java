package com.ssafy.mozzi.domain.auth.repository;

import java.time.OffsetDateTime;
import java.util.Optional;
import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ssafy.mozzi.domain.auth.entity.SignupTicket;

public interface SignupTicketRepository extends JpaRepository<SignupTicket, Long> {

    /**
     * {@code SELECT ... FOR UPDATE}, so two submissions of the same ticket run one after the
     * other and the second finds it already consumed.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from SignupTicket t where t.tokenHash = :tokenHash")
    Optional<SignupTicket> findByTokenHashForUpdate(@Param("tokenHash") String tokenHash);

    /** Expired tickets still hold an email address, so they are not kept around. */
    @Modifying
    @Query("delete from SignupTicket t where t.expiresAt <= :cutoff")
    int deleteExpired(@Param("cutoff") OffsetDateTime cutoff);

}
