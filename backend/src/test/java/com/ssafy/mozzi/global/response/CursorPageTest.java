package com.ssafy.mozzi.global.response;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;

import org.junit.jupiter.api.Test;

class CursorPageTest {

    @Test
    void dropsTheProbeRowAndPointsAtTheLastRowKept() {
        List<String> fetched = List.of("a", "b", "c", "d");

        CursorPage<String> page = CursorPage.of(fetched, 3, value -> "cursor-" + value);

        assertThat(page.items()).containsExactly("a", "b", "c");
        assertThat(page.nextCursor()).isEqualTo("cursor-c");
    }

    /** No probe row came back, so this is the last page and the client must stop. */
    @Test
    void lastPageHasNoCursor() {
        CursorPage<String> page = CursorPage.of(List.of("a", "b"), 3, value -> "cursor-" + value);

        assertThat(page.items()).containsExactly("a", "b");
        assertThat(page.nextCursor()).isNull();
    }

    @Test
    void exactlyFullPageIsStillTheLastPage() {
        CursorPage<String> page = CursorPage.of(List.of("a", "b", "c"), 3, value -> "cursor-" + value);

        assertThat(page.nextCursor()).isNull();
    }

    @Test
    void emptyResultIsAnEmptyLastPage() {
        CursorPage<String> page = CursorPage.of(List.of(), 3, value -> "cursor-" + value);

        assertThat(page.items()).isEmpty();
        assertThat(page.nextCursor()).isNull();
    }

    @Test
    void itemsCannotBeModifiedThroughTheResponse() {
        CursorPage<String> page = CursorPage.of(List.of("a", "b", "c", "d"), 3, value -> "cursor-" + value);

        assertThatThrownBy(() -> page.items().add("e")).isInstanceOf(UnsupportedOperationException.class);
    }

    @Test
    void nonPositiveSizeIsRejected() {
        assertThatThrownBy(() -> CursorPage.of(List.of("a"), 0, value -> value))
                .isInstanceOf(IllegalArgumentException.class);
    }

}
