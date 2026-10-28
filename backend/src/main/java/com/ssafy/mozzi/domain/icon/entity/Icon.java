package com.ssafy.mozzi.domain.icon.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import com.ssafy.mozzi.global.entity.BaseTimeEntity;

/**
 * A base image a member picks when making a {@link MyIcon} (ERD {@code icon}).
 *
 * <p>Rows are registered by the server outside the migrations, so the application only reads
 * them: no id generation and no setters.
 */
@Entity
@Table(name = "icon")
public class Icon extends BaseTimeEntity {

    @Id
    @Column(name = "icon_id")
    private Long id;

    /** Public S3 URL. */
    @Column(name = "image_url", nullable = false)
    private String imageUrl;

    protected Icon() {
        // JPA
    }

    public Long getId() {
        return id;
    }

    public String getImageUrl() {
        return imageUrl;
    }

}
