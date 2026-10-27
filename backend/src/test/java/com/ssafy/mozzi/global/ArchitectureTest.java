package com.ssafy.mozzi.global;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.Year;
import java.time.YearMonth;
import java.time.ZonedDateTime;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

/**
 * Rules the compiler cannot express but that silently rot if left to review.
 */
@AnalyzeClasses(packages = "com.ssafy.mozzi", importOptions = ImportOption.DoNotIncludeTests.class)
class ArchitectureTest {

    /**
     * Boot 4 uses Jackson 3 ({@code tools.jackson}), but springdoc pulls Jackson 2 in for
     * swagger-core. Both end up on the classpath, so an import of the Jackson 2
     * {@code ObjectMapper} compiles and runs — it is simply not the mapper the application
     * configured, which makes every setting in application.yml appear to be ignored.
     *
     * <p>Only {@code databind} is banned. Jackson 3 still ships its annotations under
     * {@code com.fasterxml.jackson.annotation}, so {@code @JsonProperty} and friends stay
     * legal.
     */
    @ArchTest
    static final ArchRule jackson2DatabindIsNotUsed = noClasses()
            .should().dependOnClassesThat().resideInAnyPackage("com.fasterxml.jackson.databind..")
            .because("Boot 4 runs Jackson 3; use tools.jackson.databind so application.yml applies");

    /**
     * "Today" decides which date a diary belongs to, including the three-hour grace window
     * after midnight (spec 4.4). A no-argument {@code now()} reads the machine clock, which
     * no test can move, so those rules go through the injected {@code Clock} bean.
     *
     * @see com.ssafy.mozzi.global.config.ClockConfig
     */
    @ArchTest
    static final ArchRule currentTimeComesFromTheClockBean = noClasses()
            .should().callMethod(LocalDate.class, "now")
            .orShould().callMethod(LocalDateTime.class, "now")
            .orShould().callMethod(LocalTime.class, "now")
            .orShould().callMethod(OffsetDateTime.class, "now")
            .orShould().callMethod(ZonedDateTime.class, "now")
            .orShould().callMethod(Instant.class, "now")
            .orShould().callMethod(YearMonth.class, "now")
            .orShould().callMethod(Year.class, "now")
            .because("the service timezone and the midnight grace window need an injectable Clock");

}
