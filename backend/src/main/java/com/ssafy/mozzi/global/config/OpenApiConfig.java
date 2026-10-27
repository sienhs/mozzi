package com.ssafy.mozzi.global.config;

import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springdoc.core.utils.SpringDocUtils;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.ssafy.mozzi.global.security.AuthenticatedMember;
import com.ssafy.mozzi.global.security.CurrentMember;
import com.ssafy.mozzi.global.security.PublicEndpoints;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;

/**
 * The document served at {@code /v3/api-docs} and rendered by Swagger UI.
 *
 * <p>Paste the token from a login response into the Authorize dialog without the
 * {@code Bearer } prefix; the UI adds it.
 *
 * <p>Controller annotations stay minimal: a tag, a one-line summary and any success status
 * other than 200. Behaviour and error codes live in the API spec, not here, so there is one
 * place to keep current.
 */
@Configuration
public class OpenApiConfig {

    static final String ACCESS_TOKEN_SCHEME = "accessToken";

    static {
        // Filled in by our argument resolvers from the access token, not sent by the client.
        // Without this springdoc lists them as required query parameters.
        SpringDocUtils.getConfig()
                .addAnnotationsToIgnore(CurrentMember.class)
                .addRequestWrapperToIgnore(AuthenticatedMember.class);
    }

    @Bean
    public OpenAPI openApi() {
        return new OpenAPI()
                .info(new Info().title("Mozzi API").version("v1"))
                .components(new Components().addSecuritySchemes(ACCESS_TOKEN_SCHEME, new SecurityScheme()
                        .type(SecurityScheme.Type.HTTP)
                        .scheme("bearer")
                        .bearerFormat("JWT")));
    }

    /**
     * Marks each operation as needing the access token unless {@link PublicEndpoints} lets it
     * through, the same list {@code AuthenticationFilter} reads. Annotating the public
     * methods instead would be a second list to keep in step, and springdoc 3.2 ignores an
     * empty {@code @SecurityRequirements} under a document-wide requirement anyway.
     */
    @Bean
    public OpenApiCustomizer accessTokenRequirement() {
        SecurityRequirement accessToken = new SecurityRequirement().addList(ACCESS_TOKEN_SCHEME);
        return openApi -> openApi.getPaths().forEach((path, item) -> item.readOperationsMap()
                .forEach((method, operation) -> {
                    if (!PublicEndpoints.contains(method.name(), path)) {
                        operation.addSecurityItem(accessToken);
                    }
                }));
    }

}
