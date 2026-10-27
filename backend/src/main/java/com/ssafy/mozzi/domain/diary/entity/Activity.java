package com.ssafy.mozzi.domain.diary.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * An activity chip (API spec ERD 5.6). Rows are seeded by the V3 migration.
 *
 * <p>Read-only from the application's side, so there is no id generation and no setters.
 */
@Entity
@Table(name = "activity")
public class Activity {

    @Id
    @Column(name = "activity_id")
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ActivityCode code;

    @Column(nullable = false, length = 20)
    private String label;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(name = "is_active", nullable = false)
    private boolean active;

    protected Activity() {
        // JPA
    }

    public Long getId() {
        return id;
    }

    public ActivityCode getCode() {
        return code;
    }

    public String getLabel() {
        return label;
    }

    public int getSortOrder() {
        return sortOrder;
    }

    public boolean isActive() {
        return active;
    }

}
