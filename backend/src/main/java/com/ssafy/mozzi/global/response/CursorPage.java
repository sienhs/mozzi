package com.ssafy.mozzi.global.response;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;

/**
 * Cursor-paged list body from API spec 1: {@code { "items": [...], "nextCursor": ... }}.
 *
 * <p>Success responses are not wrapped in an envelope, so this is the list shape itself
 * rather than a wrapper around one.
 *
 * <p>{@code nextCursor} is opaque to the client and {@code null} on the last page. How a
 * cursor is encoded is left to each domain, because it has to carry that domain's sort key.
 *
 * @param items      the page's rows, at most the requested size
 * @param nextCursor cursor to pass as {@code ?cursor=} for the next page, or {@code null}
 */
public record CursorPage<T>(List<T> items, String nextCursor) {

    public static <T> CursorPage<T> lastPage(List<T> items) {
        return new CursorPage<>(List.copyOf(items), null);
    }

    /**
     * Builds a page from a query that fetched one row more than the client asked for.
     *
     * <p>Reading {@code size + 1} rows is what makes "is there a next page" answerable
     * without a second count query: if the extra row came back there is more to read, and it
     * is dropped from the response.
     *
     * @param fetched  rows from a query with {@code limit = size + 1}, in page order
     * @param size     page size the client requested
     * @param cursorOf extracts the cursor of the last row kept
     */
    public static <T> CursorPage<T> of(List<T> fetched, int size, Function<T, String> cursorOf) {
        if (size <= 0) {
            throw new IllegalArgumentException("size must be positive but was " + size);
        }
        if (fetched.size() <= size) {
            return lastPage(fetched);
        }
        List<T> items = new ArrayList<>(fetched.subList(0, size));
        return new CursorPage<>(List.copyOf(items), cursorOf.apply(items.get(items.size() - 1)));
    }

}
