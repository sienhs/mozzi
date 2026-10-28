package com.ssafy.mozzi.domain.search.repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import com.ssafy.mozzi.domain.diary.entity.Emotion;

/**
 * Reads and writes {@code diary_embedding} in SQL: the {@code vector} column has no JPA
 * mapping here, and the writes need {@code on conflict}.
 *
 * <p>{@code updated_at} holds the {@code diary.updated_at} the vector was built from, not
 * the time of the write. Comparing the two finds every stale row in one query, and lets an
 * older build lose to a newer one when two run at once.
 */
@Repository
public class DiaryEmbeddingStore {

    private final NamedParameterJdbcTemplate jdbc;

    public DiaryEmbeddingStore(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * A live diary with what its embedding is built from.
     *
     * @param iconNames the attached icons' names, oldest icon first, deleted ones left out
     * @param content   the one-line diary
     * @param version   {@code diary.updated_at}
     */
    public record Source(Long diaryId, LocalDate recordDate, Emotion emotion, List<String> iconNames,
            String content, OffsetDateTime version) {
    }

    /** What an existing row was built with. */
    public record Built(String model, String contentHash) {
    }

    private static final String SOURCE_COLUMNS = "select d.diary_id, d.record_date, d.emotion, d.content, d.updated_at, "
            + SearchDiaryQuery.ICON_NAMES + " as icon_names from diary d ";

    /** Empty for a deleted or missing diary. */
    public Optional<Source> source(Long diaryId) {
        return jdbc.query(SOURCE_COLUMNS + " where d.diary_id = :diaryId and d.deleted_at is null",
                new MapSqlParameterSource("diaryId", diaryId), DiaryEmbeddingStore::source).stream().findFirst();
    }

    /**
     * Live diaries with content whose row is missing, built by another model, or older than
     * the diary. Least recently changed first, so a backlog drains in order.
     */
    public List<Source> stale(String model, int limit) {
        MapSqlParameterSource params = new MapSqlParameterSource("model", model).addValue("limit", limit);
        return jdbc.query(SOURCE_COLUMNS + """
                left join diary_embedding e on e.diary_id = d.diary_id
                where d.deleted_at is null and d.content is not null
                  and (e.diary_id is null or e.model <> :model or e.updated_at < d.updated_at)
                order by d.updated_at, d.diary_id
                limit :limit
                """, params, DiaryEmbeddingStore::source);
    }

    public Optional<Built> built(Long diaryId) {
        return jdbc.query("select model, content_hash from diary_embedding where diary_id = :diaryId",
                new MapSqlParameterSource("diaryId", diaryId),
                (rs, rowNum) -> new Built(rs.getString("model"), rs.getString("content_hash")))
                .stream().findFirst();
    }

    /**
     * Locks the diary against edits and deletes until the transaction ends, if it is still
     * live, still has content, and is still the version a vector was built from.
     *
     * <p>Writers to an existing diary take {@code for update} on the same row
     * ({@code DiaryRepository#findForUpdate}), so a write made under this lock cannot land
     * after one of theirs has committed.
     *
     * @return {@code false} when the diary changed since; the vector must not be written
     */
    public boolean lockIfCurrent(Long diaryId, OffsetDateTime version) {
        return !jdbc.queryForList("""
                select diary_id from diary
                where diary_id = :diaryId and deleted_at is null and content is not null and updated_at = :version
                for share
                """, new MapSqlParameterSource("diaryId", diaryId).addValue("version", version), Long.class)
                .isEmpty();
    }

    /**
     * Writes the vector unless the row already holds one built from a newer version of the
     * diary — the case of two edits whose embeddings come back in the wrong order. Call it
     * under {@link #lockIfCurrent}.
     */
    public void upsert(Long diaryId, String model, String contentHash, float[] embedding, OffsetDateTime version,
            OffsetDateTime now) {
        jdbc.update("""
                insert into diary_embedding (diary_id, model, content_hash, embedding, created_at, updated_at)
                values (:diaryId, :model, :contentHash, cast(:embedding as vector), :now, :version)
                on conflict (diary_id) do update
                set model = excluded.model, content_hash = excluded.content_hash,
                    embedding = excluded.embedding, updated_at = excluded.updated_at
                where diary_embedding.updated_at <= excluded.updated_at
                """, new MapSqlParameterSource("diaryId", diaryId)
                .addValue("model", model)
                .addValue("contentHash", contentHash)
                .addValue("embedding", SearchDiaryQuery.vectorLiteral(embedding))
                .addValue("now", now)
                .addValue("version", version));
    }

    /**
     * Marks the row current without a new vector: the diary changed in a way the embedded
     * text does not show (its picture's status).
     *
     * <p>Only if the row still holds the vector the caller checked. Between that check and
     * this update another build can write a different text's vector; stamping the new
     * version on it would make that vector look current, and no sweep would ever fix it.
     *
     * @return {@code false} when the row changed since it was checked; the caller embeds
     *         the text instead
     */
    public boolean markCurrent(Long diaryId, String model, String contentHash, OffsetDateTime version) {
        int updated = jdbc.update("""
                update diary_embedding set updated_at = :version
                where diary_id = :diaryId and model = :model and content_hash = :contentHash and updated_at <= :version
                """, new MapSqlParameterSource("diaryId", diaryId)
                .addValue("model", model)
                .addValue("contentHash", contentHash)
                .addValue("version", version));
        return updated == 1;
    }

    public void delete(Long diaryId) {
        jdbc.update("delete from diary_embedding where diary_id = :diaryId",
                new MapSqlParameterSource("diaryId", diaryId));
    }

    /**
     * Rows whose diary was deleted or lost its content since — the change event that should
     * have removed them was missed.
     */
    public int deleteOrphans() {
        return jdbc.update("""
                delete from diary_embedding e using diary d
                where d.diary_id = e.diary_id and (d.deleted_at is not null or d.content is null)
                """, new MapSqlParameterSource());
    }

    private static Source source(ResultSet rs, int rowNum) throws SQLException {
        return new Source(
                rs.getLong("diary_id"),
                rs.getObject("record_date", LocalDate.class),
                Emotion.valueOf(rs.getString("emotion")),
                SearchDiaryQuery.splitIconNames(rs.getString("icon_names")),
                rs.getString("content"),
                rs.getObject("updated_at", OffsetDateTime.class));
    }

}
