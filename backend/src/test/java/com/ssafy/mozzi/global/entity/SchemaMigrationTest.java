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

        assertThat(versions).containsExactly("1", "2");
    }

    @Test
    void allExpectedTablesExist() {
        List<String> tables = jdbcTemplate.queryForList(
                "select table_name from information_schema.tables where table_schema = 'public'", String.class);

        assertThat(tables).contains(
                "member", "member_setting", "terms_agreement", "push_device",
                "refresh_token", "idempotency_record");
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

    @Test
    void oneAccountPerGoogleUserIsEnforcedByAnIndex() {
        List<String> indexes = jdbcTemplate.queryForList(
                "select indexname from pg_indexes where tablename = 'member'", String.class);

        assertThat(indexes).contains("uq_member_provider_subject");
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

    /** Spec 4.2 defaults the reminder to 21:00 with notifications on. */
    @Test
    void reminderDefaultsComeFromTheSchema() {
        jdbcTemplate.update("insert into member "
                + "(email, provider, provider_subject, role, status, created_at, updated_at) "
                + "values ('defaults@gmail.com', 'GOOGLE', 'sub-defaults', 'USER', 'ACTIVE', now(), now())");
        Long memberId = jdbcTemplate.queryForObject(
                "select member_id from member where provider_subject = 'sub-defaults'", Long.class);
        jdbcTemplate.update("insert into member_setting (member_id, updated_at) values (?, now())", memberId);

        var setting = jdbcTemplate.queryForMap(
                "select reminder_enabled, reminder_time, timezone from member_setting where member_id = ?",
                memberId);

        assertThat(setting.get("reminder_enabled")).isEqualTo(true);
        // java.sql.Time renders seconds, so the schema default '21:00' reads back as 21:00:00.
        assertThat(setting.get("reminder_time")).hasToString("21:00:00");
        assertThat(setting.get("timezone")).isEqualTo("Asia/Seoul");
    }

}
