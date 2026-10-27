package com.ssafy.mozzi.global.config;

import java.util.List;
import java.util.function.Predicate;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.method.HandlerTypePredicate;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.config.annotation.PathMatchConfigurer;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

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

    public WebConfig(CurrentMemberArgumentResolver currentMemberArgumentResolver) {
        this.currentMemberArgumentResolver = currentMemberArgumentResolver;
    }

    @Override
    public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
        resolvers.add(currentMemberArgumentResolver);
    }

    @Override
    public void configurePathMatch(PathMatchConfigurer configurer) {
        Predicate<Class<?>> ourControllers = HandlerTypePredicate.forAnnotation(RestController.class)
                .and(HandlerTypePredicate.forBasePackage(BASE_PACKAGE));
        configurer.addPathPrefix(API_PREFIX, ourControllers);
    }

}
