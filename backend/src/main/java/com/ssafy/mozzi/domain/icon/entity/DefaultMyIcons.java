package com.ssafy.mozzi.domain.icon.entity;

import java.util.List;

/**
 * Icons every member starts with, made at sign-up in this order (a category's list is
 * oldest first). They are ordinary icons once made: the member can delete them, and they
 * count toward {@link MyIcon#MAX_PER_CATEGORY}.
 *
 * <p>Members who signed up before these existed got them from migration V18, which copies
 * this list as it was then. Changing the list here affects new members only.
 */
public final class DefaultMyIcons {

    public record DefaultMyIcon(String name, IconCategory category) {
    }

    public static final List<DefaultMyIcon> ALL = List.of(
            new DefaultMyIcon("공부", IconCategory.WHAT),
            new DefaultMyIcon("일하기", IconCategory.WHAT),
            new DefaultMyIcon("운동", IconCategory.WHAT),
            new DefaultMyIcon("산책", IconCategory.WHAT),
            new DefaultMyIcon("휴식", IconCategory.WHAT),
            new DefaultMyIcon("식사", IconCategory.WHAT),
            new DefaultMyIcon("요리", IconCategory.WHAT),
            new DefaultMyIcon("독서", IconCategory.WHAT),
            new DefaultMyIcon("집", IconCategory.WHERE),
            new DefaultMyIcon("회사", IconCategory.WHERE),
            new DefaultMyIcon("학교", IconCategory.WHERE),
            new DefaultMyIcon("카페", IconCategory.WHERE),
            new DefaultMyIcon("공원", IconCategory.WHERE),
            new DefaultMyIcon("가족", IconCategory.WHO),
            new DefaultMyIcon("친구", IconCategory.WHO),
            new DefaultMyIcon("연인", IconCategory.WHO),
            new DefaultMyIcon("동료", IconCategory.WHO));

    private DefaultMyIcons() {
    }

}
