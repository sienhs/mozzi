package com.ssafy.mozzi.global.entity;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import com.ssafy.mozzi.support.IntegrationTest;

/**
 * Proves the migrations and the entity mappings agree.
 *
 * <p>The context starting at all is most of the assertion: {@code ddl-auto=validate} makes
 * Hibernate compare every mapped entity against the migrated schema and fail startup on any
 * mismatch — a renamed column, a wrong length, a missing table. The explicit checks below
 * cover what {@code validate} does not look at: indexes, defaults and constraints.
 */
@IntegrationTest
class SchemaMigrationTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void everyMigrationApplied() {
        List<String> versions = jdbcTemplate.queryForList(
                "select version from flyway_schema_history where success order by installed_rank", String.class);

        assertThat(versions).containsExactly("1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11");
    }

    @Test
    void allExpectedTablesExist() {
        List<String> tables = jdbcTemplate.queryForList(
                "select table_name from information_schema.tables where table_schema = 'public'", String.class);

        assertThat(tables).contains(
                "member", "terms_agreement", "push_device",
                "idempotency_record", "member_session", "signup_ticket",
                "emoticon", "my_icon", "diary", "diary_icon", "diary_image",
                "emotion_search", "emotion_search_result", "diary_embedding",
                "gacha_tier", "mozzi_card", "member_card", "gacha_draw", "gacha_draw_result",
                "member_wallet", "wallet_ledger");
        // No seasons: every active card is in one pool.
        assertThat(tables).doesNotContain("gacha_season");
        // Replaced by member_session in V5; two refresh schemes must not coexist.
        assertThat(tables).doesNotContain("refresh_token");
        // Replaced by member-made icons in V7.
        assertThat(tables).doesNotContain("activity", "diary_activity");
        // Icons became text only in V9.
        assertThat(tables).doesNotContain("icon");
        // The diary reminder was dropped in V10, and its settings with it.
        assertThat(tables).doesNotContain("member_setting");
    }

    /** Columns are snake_case in the database and camelCase in Java (convention 1.1). */
    @Test
    void columnNamesAreSnakeCase() {
        List<String> columns = jdbcTemplate.queryForList(
                "select column_name from information_schema.columns "
                        + "where table_schema = 'public' and table_name = 'member'", String.class);

        assertThat(columns).contains("member_id", "provider_subject", "created_at", "deleted_at");
        assertThat(columns).noneMatch(name -> name.matches(".*[A-Z].*"));
    }

    /**
     * Timestamps must keep their offset; "timestamp without time zone" loses it, which is
     * how a record written at 00:30 KST ends up dated to the previous day.
     *
     * <p>Flyway's own history table is excluded: {@code installed_on} is declared by Flyway
     * as a plain timestamp and is not ours to change.
     */
    @Test
    void timestampColumnsCarryATimeZone() {
        List<String> types = jdbcTemplate.queryForList(
                "select data_type from information_schema.columns "
                        + "where table_schema = 'public' and table_name <> 'flyway_schema_history' "
                        + "and data_type like 'timestamp%'", String.class);

        assertThat(types).isNotEmpty();
        assertThat(types).containsOnly("timestamp with time zone");
    }

    /** Unique among active members only, so a withdrawn account can sign up again at once. */
    @Test
    void oneActiveAccountPerGoogleUserIsEnforcedByAPartialIndex() {
        String definition = jdbcTemplate.queryForObject(
                "select indexdef from pg_indexes where indexname = 'uq_member_active_provider_subject'", String.class);

        assertThat(definition)
                .contains("UNIQUE")
                .contains("provider_subject")
                .contains("deleted_at IS NULL");
    }

    @Test
    void activeNicknamesAreUniqueIgnoringCase() {
        String definition = jdbcTemplate.queryForObject(
                "select indexdef from pg_indexes where indexname = 'uq_member_active_nickname'", String.class);

        assertThat(definition)
                .contains("UNIQUE")
                .contains("lower((nickname)")
                .contains("deleted_at IS NULL");
    }

    /** One session per member is the primary key itself; the session id is looked up on refresh. */
    @Test
    void memberSessionIsKeyedByMember() {
        List<String> primaryKey = jdbcTemplate.queryForList("""
                select a.attname
                from pg_index i
                join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
                where i.indrelid = 'member_session'::regclass and i.indisprimary
                """, String.class);
        List<String> indexes = jdbcTemplate.queryForList(
                "select indexname from pg_indexes where tablename = 'member_session'", String.class);

        assertThat(primaryKey).containsExactly("member_id");
        assertThat(indexes).contains("uq_member_session_session_id", "ix_member_session_refresh_expires_at");
    }

    @Test
    void idempotencyKeyIsScopedPerMemberAndEndpoint() {
        String definition = jdbcTemplate.queryForObject(
                "select indexdef from pg_indexes where indexname = 'uq_idempotency_record_scope'", String.class);

        assertThat(definition)
                .contains("UNIQUE")
                .contains("member_id")
                .contains("endpoint")
                .contains("idempotency_key");
    }

    /**
     * One diary per day, ignoring soft-deleted rows (policy 6). Without the predicate a
     * deleted diary would block its day forever; without UNIQUE, a double tap writes two.
     */
    @Test
    void oneDiaryPerDayIsAPartialUniqueIndex() {
        String definition = jdbcTemplate.queryForObject(
                "select indexdef from pg_indexes where indexname = 'uq_diary_member_record_date'", String.class);

        assertThat(definition)
                .contains("UNIQUE")
                .contains("(member_id, record_date)")
                .contains("WHERE (deleted_at IS NULL)");
    }

    /**
     * The dimension is part of the column type. A model that returns a different size must
     * fail on insert, not end up compared against vectors it has nothing in common with.
     */
    @Test
    void diaryEmbeddingIsAPgvectorColumnOf1536Dimensions() {
        String type = jdbcTemplate.queryForObject("""
                select format_type(atttypid, atttypmod) from pg_attribute
                where attrelid = 'diary_embedding'::regclass and attname = 'embedding'
                """, String.class);

        assertThat(type).isEqualTo("vector(1536)");
    }

    /** The response has one big card, so a second featured row for a search is a bug. */
    @Test
    void oneFeaturedDiaryPerSearchIsAPartialUniqueIndex() {
        String definition = jdbcTemplate.queryForObject(
                "select indexdef from pg_indexes where indexname = 'uq_emotion_search_result_featured'", String.class);

        assertThat(definition)
                .contains("UNIQUE")
                .contains("(emotion_search_id)")
                .contains("WHERE is_featured");
    }

    /**
     * One picture row per diary: a retry resets the row, and a second insert for the same
     * diary is refused even if the row lock were ever skipped.
     */
    @Test
    void oneImagePerDiaryIsAUniqueIndex() {
        String definition = jdbcTemplate.queryForObject(
                "select indexdef from pg_indexes where indexname = 'uq_diary_image_diary'", String.class);

        assertThat(definition)
                .contains("UNIQUE")
                .contains("(diary_id)");
    }

    @Test
    void oneEmoticonPerEmotion() {
        String definition = jdbcTemplate.queryForObject(
                "select indexdef from pg_indexes where indexname = 'uq_emoticon_emotion'", String.class);

        assertThat(definition).contains("UNIQUE").contains("(emotion)");
    }

    /** The icon list and the nine-per-category count read live icons only. */
    @Test
    void myIconLookupIndexSkipsDeletedIcons() {
        String definition = jdbcTemplate.queryForObject(
                "select indexdef from pg_indexes where indexname = 'ix_my_icon_member_category'", String.class);

        assertThat(definition)
                .contains("(member_id, category, created_at)")
                .contains("WHERE (deleted_at IS NULL)");
    }

    /** The draw odds are read from these rows; the application refuses to start without all five. */
    @Test
    void gachaTiersAreSeeded() {
        List<String> tiers = jdbcTemplate.queryForList(
                "select tier || ':' || weight || ':' || duplicate_shards || ':' || coalesce(exchange_cost::text, '-') "
                        + "from gacha_tier order by weight desc", String.class);

        assertThat(tiers).containsExactly(
                "COMMON:45000:1:-", "RARE:30000:2:-", "EPIC:17000:5:-", "LEGENDARY:7000:15:200", "MYTHIC:1000:40:400");
    }

    /** A reward is paid once per key; rows without a key (draws, exchanges) are not checked. */
    @Test
    void rewardKeyIsUniquePerMember() {
        String definition = jdbcTemplate.queryForObject(
                "select indexdef from pg_indexes where indexname = 'uq_wallet_ledger_reward_key'", String.class);

        assertThat(definition)
                .contains("UNIQUE")
                .contains("(member_id, reward_key)")
                .contains("WHERE (reward_key IS NOT NULL)");
    }

    @Test
    void ledgerRowsTiedToADrawOrCardAreUnique() {
        String definition = jdbcTemplate.queryForObject(
                "select indexdef from pg_indexes where indexname = 'uq_wallet_ledger_ref'", String.class);

        assertThat(definition).contains("UNIQUE").contains("(member_id, currency, reason, ref_id)");
    }

    /** The draw pool is the active cards of one tier. */
    @Test
    void cardLookupByTierSkipsInactiveCards() {
        String definition = jdbcTemplate.queryForObject(
                "select indexdef from pg_indexes where indexname = 'ix_mozzi_card_tier'", String.class);

        assertThat(definition).contains("(tier)").contains("WHERE is_active");
    }

    /** The last line against a negative balance, should a check in Java ever be skipped. */
    @Test
    void walletBalancesCannotGoNegative() {
        List<String> checks = jdbcTemplate.queryForList("""
                select pg_get_constraintdef(oid) from pg_constraint
                where conrelid = 'member_wallet'::regclass and contype = 'c'
                """, String.class);

        assertThat(checks).anyMatch(check -> check.contains("ticket_balance >= 0"))
                .anyMatch(check -> check.contains("shard_balance >= 0"));
    }

}
