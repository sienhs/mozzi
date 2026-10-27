package com.ssafy.mozzi.global.config;

import java.util.List;
import java.util.function.Predicate;

import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.http.converter.HttpMessageConverters;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.method.HandlerTypePredicate;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.config.annotation.PathMatchConfigurer;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import com.ssafy.mozzi.global.security.AuthenticatedMemberArgumentResolver;
import com.ssafy.mozzi.global.security.CurrentMemberArgumentResolver;

/**
 * Applies the {@code /api/v1} base path from spec 1 in one place.
 *
 * <p>Controllers map the bare resource path ({@code /diaries}), so moving to {@code v2}
 * does not touch every controller.
 *
 * <p>The predicate is restricted to this project's packages, not just to
 * {@code @RestController}. Third-party controllers are annotated the same way, and
 * springdoc's {@code /v3/api-docs} would otherwise be served from
 * {@code /api/v1/v3/api-docs}. {@code WebConfigTest} pins both halves of that.
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    public static final String API_PREFIX = "/api/v1";

    private static final String BASE_PACKAGE = "com.ssafy.mozzi";

    private final CurrentMemberArgumentResolver currentMemberArgumentResolver;
    private final AuthenticatedMemberArgumentResolver authenticatedMemberArgumentResolver;

    public WebConfig(CurrentMemberArgumentResolver currentMemberArgumentResolver,
            AuthenticatedMemberArgumentResolver authenticatedMemberArgumentResolver) {
        this.currentMemberArgumentResolver = currentMemberArgumentResolver;
        this.authenticatedMemberArgumentResolver = authenticatedMemberArgumentResolver;
    }

    @Override
    public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
        resolvers.add(currentMemberArgumentResolver);
        resolvers.add(authenticatedMemberArgumentResolver);
    }

    @Override
    public void configurePathMatch(PathMatchConfigurer configurer) {
        Predicate<Class<?>> ourControllers = HandlerTypePredicate.forAnnotation(RestController.class)
                .and(HandlerTypePredicate.forBasePackage(BASE_PACKAGE));
        configurer.addPathPrefix(API_PREFIX, ourControllers);
    }

    /**
     * Removes the YAML converter, so the API reads and writes JSON only.
     *
     * <p>springdoc brings in jackson-dataformat-yaml (Jackson 2), and Spring registers a YAML
     * converter whenever that is on the classpath. It does not use the application's Jackson 3
     * mapper, so none of {@code spring.jackson.*} applies to it: a YAML request body with a
     * misspelled field reached the service instead of getting 400, and {@code Accept:
     * application/yaml} returned timestamps as epoch numbers (both verified).
     * {@code WebConfigTest} pins the removal.
     */
    @Override
    public void configureMessageConverters(HttpMessageConverters.ServerBuilder builder) {
        builder.configureMessageConvertersList(converters -> converters
                .removeIf(converter -> converter.getSupportedMediaTypes().contains(MediaType.APPLICATION_YAML)));
    }

}
