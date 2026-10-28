package com.ssafy.mozzi.domain.search.repository;

import java.time.LocalDate;
import java.util.List;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import com.ssafy.mozzi.domain.diary.entity.Emotion;

/**
 * The diary reads behind emotion search, in SQL because ordering by vector distance
 * ({@code <=>}) is pgvector syntax that JPQL cannot express.
 *
 * <p>Every query is scoped by {@code member_id} and skips soft-deleted diaries, as the
 * {@code @SQLRestriction} on {@code Diary} does for JPA reads.
 */
@Repository
public class SearchDiaryQuery {

    /**
     * A diary's live icon names, oldest icon first, joined by the unit separator: names are
     * free text and may contain a comma.
     */
    static final String ICON_NAMES = """
            (select string_agg(mi.name, chr(31) order by mi.created_at, mi.my_icon_id)
             from diary_icon di join my_icon mi on mi.my_icon_id = di.my_icon_id
             where di.diary_id = d.diary_id and mi.deleted_at is null)""";

    private final NamedParameterJdbcTemplate jdbc;

    public SearchDiaryQuery(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * A diary as the answer prompt sees it.
     *
     * @param iconNames the names of the icons the member attached, deleted ones left out
     */
    public record Candidate(Long diaryId, LocalDate recordDate, Emotion emotion, String content,
            List<String> iconNames) {
    }

    public record EmotionCount(Emotion emotion, long count) {
    }

    public record DayEmotion(LocalDate recordDate, Emotion emotion) {
    }

    /**
     * The best matches first.
     *
     * <p>With a query vector, diaries are ordered by cosine distance to it; diaries with no
     * embedding yet (or one from another model) come after all that have one. Without it,
     * newest first.
     *
     * @param queryVector the question's embedding, or {@code null} to rank by date
     * @param model       {@code diary_embedding.model} to compare against
     */
    public List<Candidate> candidates(Long memberId, SearchCriteria criteria, float[] queryVector, String model,
            int limit) {
        MapSqlParameterSource params = new MapSqlParameterSource("limit", limit).addValue("model", model);
        String order = "d.record_date desc, d.diary_id desc";
        if (queryVector != null) {
            order = "e.embedding <=> cast(:query as vector) nulls last, " + order;
            params.addValue("query", vectorLiteral(queryVector));
        }
        String sql = "select d.diary_id, d.record_date, d.emotion, d.content, " + ICON_NAMES + " as icon_names"
                + " from diary d"
                + " left join diary_embedding e on e.diary_id = d.diary_id and e.model = :model"
                + where(memberId, criteria, params) + " order by " + order + " limit :limit";
        return jdbc.query(sql, params, (rs, rowNum) -> new Candidate(
                rs.getLong("diary_id"),
                rs.getObject("record_date", LocalDate.class),
                Emotion.valueOf(rs.getString("emotion")),
                rs.getString("content"),
                splitIconNames(rs.getString("icon_names"))));
    }

    /** How many matching diaries carry each emotion, most frequent first. */
    public List<EmotionCount> emotionCounts(Long memberId, SearchCriteria criteria) {
        MapSqlParameterSource params = new MapSqlParameterSource();
        String sql = "select d.emotion, count(*) as cnt from diary d" + where(memberId, criteria, params)
                + " group by d.emotion order by cnt desc, d.emotion";
        return jdbc.query(sql, params, (rs, rowNum) -> new EmotionCount(
                Emotion.valueOf(rs.getString("emotion")), rs.getLong("cnt")));
    }

    /** One row per recorded day in the range, oldest first. */
    public List<DayEmotion> emotionsBetween(Long memberId, LocalDate from, LocalDate to) {
        MapSqlParameterSource params = new MapSqlParameterSource("memberId", memberId)
                .addValue("from", from)
                .addValue("to", to);
        return jdbc.query("""
                select record_date, emotion from diary
                where member_id = :memberId and deleted_at is null and record_date between :from and :to
                order by record_date
                """, params, (rs, rowNum) -> new DayEmotion(
                rs.getObject("record_date", LocalDate.class), Emotion.valueOf(rs.getString("emotion"))));
    }

    /** The shared {@code where} clause. */
    private static String where(Long memberId, SearchCriteria criteria, MapSqlParameterSource params) {
        StringBuilder sql = new StringBuilder(" where d.member_id = :memberId and d.deleted_at is null");
        params.addValue("memberId", memberId);
        if (criteria.from() != null) {
            sql.append(" and d.record_date >= :from");
            params.addValue("from", criteria.from());
        }
        if (criteria.to() != null) {
            sql.append(" and d.record_date <= :to");
            params.addValue("to", criteria.to());
        }
        if (!criteria.emotions().isEmpty()) {
            sql.append(" and d.emotion in (:emotions)");
            params.addValue("emotions", criteria.emotions().stream().map(Emotion::name).toList());
        }
        return sql.toString();
    }

    /** The reverse of {@link #ICON_NAMES}. */
    static List<String> splitIconNames(String joined) {
        if (joined == null || joined.isEmpty()) {
            return List.of();
        }
        return List.of(joined.split("\u001F"));
    }

    /** pgvector's text form, {@code [0.1,0.2,...]}; it accepts Java's exponent notation. */
    static String vectorLiteral(float[] vector) {
        StringBuilder literal = new StringBuilder(vector.length * 12).append('[');
        for (int i = 0; i < vector.length; i++) {
            if (i > 0) {
                literal.append(',');
            }
            literal.append(vector[i]);
        }
        return literal.append(']').toString();
    }

}
