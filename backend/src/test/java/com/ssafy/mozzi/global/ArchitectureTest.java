package com.ssafy.mozzi.global;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.methods;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.Year;
import java.time.YearMonth;
import java.time.ZonedDateTime;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;

import com.tngtech.archunit.core.domain.JavaMethod;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;

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

    /**
     * An error response built with a plain {@code ResponseEntity} is negotiated against the
     * client's {@code Accept}; when that rules out JSON the handler itself fails and the client
     * gets an empty 500. {@code ErrorResponseEntity} fixes the Content-Type to JSON.
     *
     * <p>Accesses, not just calls, so a method reference such as {@code ResponseEntity::ok}
     * counts too.
     *
     * <p>Checks only the handler method itself, so a helper it calls is on review.
     */
    @ArchTest
    static final ArchRule exceptionHandlersBuildTheirResponseThroughErrorResponseEntity = methods()
            .that().areAnnotatedWith(ExceptionHandler.class)
            .should(new ArchCondition<JavaMethod>("not build a ResponseEntity directly") {
                @Override
                public void check(JavaMethod method, ConditionEvents events) {
                    method.getAccessesFromSelf().stream()
                            .filter(access -> access.getTargetOwner().isEquivalentTo(ResponseEntity.class))
                            .forEach(access -> events.add(SimpleConditionEvent.violated(method, access.getDescription())));
                }
            })
            .because("an error body must be JSON whatever the client accepts; use ErrorResponseEntity");

}
