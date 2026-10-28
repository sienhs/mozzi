package com.ssafy.mozzi.domain.member.entity;

import java.time.OffsetDateTime;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * A device a member receives pushes on (ERD {@code push_device}), one row per member and
 * device.
 *
 * <p>Read only here: rows are written by the statements in {@code PushDeviceRepository},
 * because a registration is an upsert that has to hold when two launches race.
 */
@Entity
@Table(name = "push_device")
public class PushDevice {

    @Id
    @Column(name = "push_device_id")
    private Long id;

    @Column(name = "member_id", nullable = false)
    private Long memberId;

    @Column(name = "device_id", nullable = false, length = 64)
    private String deviceId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private PushPlatform platform;

    @Column(nullable = false, length = 512)
    private String token;

    @Column(name = "is_active", nullable = false)
    private boolean active;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    protected PushDevice() {
        // JPA
    }

    public Long getId() {
        return id;
    }

    public Long getMemberId() {
        return memberId;
    }

    public String getDeviceId() {
        return deviceId;
    }

    public PushPlatform getPlatform() {
        return platform;
    }

    public String getToken() {
        return token;
    }

    public boolean isActive() {
        return active;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }

}
