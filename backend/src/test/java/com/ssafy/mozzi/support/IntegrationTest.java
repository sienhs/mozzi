package com.ssafy.mozzi.support;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Inherited;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

/**
 * A test that loads the whole application against a real PostgreSQL.
 *
 * <p>Once JPA is on the classpath every {@code @SpringBootTest} needs a database — Boot
 * fails to start without one. Rather than excluding the DataSource auto-configuration in
 * some tests and not others, all of them share one container, which starts once per build.
 *
 * <p>Requires a running Docker daemon.
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Inherited
@ActiveProfiles("test")
@SpringBootTest
@Import(PostgresTestContainer.class)
public @interface IntegrationTest {
}
