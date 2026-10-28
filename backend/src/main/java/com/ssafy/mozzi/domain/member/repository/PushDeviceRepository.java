package com.ssafy.mozzi.domain.member.repository;

import java.time.OffsetDateTime;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.mozzi.domain.member.entity.PushDevice;

public interface PushDeviceRepository extends JpaRepository<PushDevice, Long> {

    /**
     * Saves the device's token as active, overwriting the row of the same member and device.
     * One statement, so two launches registering at once cannot both insert and trip the
     * unique index.
     */
    @Modifying
    @Query(value = """
            insert into push_device (member_id, device_id, platform, token, is_active, updated_at)
            values (:memberId, :deviceId, :platform, :token, true, :now)
            on conflict (member_id, device_id)
            do update set platform = excluded.platform,
                          token = excluded.token,
                          is_active = true,
                          updated_at = excluded.updated_at
            """, nativeQuery = true)
    void upsert(
            @Param("memberId") Long memberId,
            @Param("deviceId") String deviceId,
            @Param("platform") String platform,
            @Param("token") String token,
            @Param("now") OffsetDateTime now);

    /**
     * Turns off every device of the member but one. A member has one session at a time, so
     * any other device is signed out and must not get the member's pushes.
     */
    @Modifying
    @Query("""
            update PushDevice d set d.active = false, d.updatedAt = :now
            where d.memberId = :memberId and d.deviceId <> :deviceId and d.active = true
            """)
    int deactivateOtherDevices(
            @Param("memberId") Long memberId, @Param("deviceId") String deviceId, @Param("now") OffsetDateTime now);

    /**
     * Turns the token off under other members. A phone keeps its token when someone else
     * signs in on it, and the previous member's row would otherwise send their pushes there.
     */
    @Modifying
    @Query("""
            update PushDevice d set d.active = false, d.updatedAt = :now
            where d.token = :token and d.memberId <> :memberId and d.active = true
            """)
    int deactivateTokenOfOthers(
            @Param("token") String token, @Param("memberId") Long memberId, @Param("now") OffsetDateTime now);

    @Modifying
    @Query("""
            update PushDevice d set d.active = false, d.updatedAt = :now
            where d.memberId = :memberId and d.active = true
            """)
    int deactivateAllOfMember(@Param("memberId") Long memberId, @Param("now") OffsetDateTime now);

    @Modifying
    @Query("delete from PushDevice d where d.memberId = :memberId")
    int deleteAllOfMember(@Param("memberId") Long memberId);

    /**
     * A token FCM reports as dead. Its own transaction: the caller sends pushes with none
     * open, so a slow send never holds a connection.
     */
    @Transactional
    @Modifying
    @Query("update PushDevice d set d.active = false, d.updatedAt = :now where d.id = :id")
    int deactivate(@Param("id") Long id, @Param("now") OffsetDateTime now);

    /** Where a push to the member goes. */
    List<PushDevice> findByMemberIdAndActiveTrue(Long memberId);

}
