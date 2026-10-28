package com.ssafy.mozzi.support;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * The database every integration test runs against.
 *
 * <p>Pinned to the same image tag as {@code backend/compose.yaml}. If the two drift, a test
 * can pass against a PostgreSQL version that nobody actually develops or deploys on.
 *
 * <p>{@code @ServiceConnection} hands the generated URL, user and password to Spring, so no
 * profile has to know them. The container starts once and is shared by every test class
 * that reaches this configuration, because Spring caches the context.
 */
@TestConfiguration(proxyBeanMethods = false)
public class PostgresTestContainer {

    private static final String IMAGE =
            "pgvector/pgvector:0.8.7-pg17-trixie@sha256:7a7e9f22015b67edb4bef5c59daeebcd7e74bfa570df6ce60ae01237c8648a84";

    /**
     * Testcontainers 2.x moved this class to {@code org.testcontainers.postgresql} and
     * dropped the self-type generic, so the 1.x {@code PostgreSQLContainer<?>} spelling
     * found in most examples does not compile here.
     *
     * <p>The container refuses any image not named {@code postgres} unless it is declared a
     * substitute. pgvector's image is the official one with the extension added, so it is.
     */
    @Bean
    @ServiceConnection
    PostgreSQLContainer postgresContainer() {
        return new PostgreSQLContainer(
                DockerImageName.parse(IMAGE).asCompatibleSubstituteFor("postgres"));
    }

}
