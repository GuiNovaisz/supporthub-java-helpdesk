package com.supporthub.shared;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.Operation;
import io.swagger.v3.oas.models.PathItem;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.media.Content;
import io.swagger.v3.oas.models.media.IntegerSchema;
import io.swagger.v3.oas.models.media.MediaType;
import io.swagger.v3.oas.models.media.ObjectSchema;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.media.StringSchema;
import io.swagger.v3.oas.models.parameters.HeaderParameter;
import io.swagger.v3.oas.models.responses.ApiResponse;
import io.swagger.v3.oas.models.responses.ApiResponses;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import java.util.List;
import java.util.Set;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
class OpenApiConfig {
    private static final Set<String> PUBLIC_PATHS = Set.of(
            "/api/v1/auth/csrf", "/api/v1/auth/register", "/api/v1/auth/login");
    private static final String LOGOUT = "/api/v1/auth/logout";

    @Bean
    OpenAPI supportHubOpenApi() {
        var problem = new ObjectSchema()
                .addProperty("type", new StringSchema().format("uri"))
                .addProperty("title", new StringSchema())
                .addProperty("status", new IntegerSchema())
                .addProperty("detail", new StringSchema())
                .addProperty("instance", new StringSchema().format("uri-reference"));
        return new OpenAPI()
                .info(new Info().title("SupportHub API").version("v1").description("""
                        Sign in using the JSESSIONID cookie. Fetch /api/v1/auth/csrf before each new session
                        and again after login. For every mutation, send the returned token as X-CSRF-TOKEN.
                        Page indexes start at zero. The default page size is 20 and the maximum is 100.
                        """))
                .components(new Components().addSchemas("Problem", problem)
                        .addSecuritySchemes("session", new SecurityScheme().type(SecurityScheme.Type.APIKEY)
                                .in(SecurityScheme.In.COOKIE).name("JSESSIONID")))
                .addSecurityItem(new SecurityRequirement().addList("session"))
                .path(LOGOUT, new PathItem().post(new Operation().operationId("logout")
                        .addTagsItem("Session")
                        .description("Invalidates the session and removes the cookie. Requires a valid CSRF token.")
                        .responses(new ApiResponses().addApiResponse("204", new ApiResponse().description("Logged out.")))));
    }

    @Bean
    OpenApiCustomizer documentSecurityAndErrors() {
        return api -> api.getPaths().forEach((path, item) -> item.readOperationsMap().forEach((method, operation) -> {
            if (!path.startsWith("/api/v1/")) {
                return;
            }
            var responses = operation.getResponses();
            if (PUBLIC_PATHS.contains(path)) {
                operation.setSecurity(List.of());
            } else if (!path.equals(LOGOUT)) {
                responses.putIfAbsent("401", error("Authentication required."));
            }
            if (method != PathItem.HttpMethod.GET) {
                operation.addParametersItem(new HeaderParameter().name("X-CSRF-TOKEN").required(true)
                        .schema(new StringSchema()).description("Token from GET /api/v1/auth/csrf."));
                responses.putIfAbsent("409", error("The operation conflicts with the current state."));
            }
            if (!path.equals("/api/v1/auth/csrf")) {
                responses.putIfAbsent("400", error("Malformed request."));
                responses.putIfAbsent("403", error("Forbidden or invalid CSRF token."));
                responses.putIfAbsent("422", error("Request validation failed."));
            }
            if (path.contains("{")) {
                responses.putIfAbsent("404", error("Resource not found or hidden from this requester."));
            }
            if (path.equals("/api/v1/auth/login")) {
                responses.putIfAbsent("401", error("Invalid credentials."));
            }
            if (method == PathItem.HttpMethod.POST && path.equals("/api/v1/tickets")) {
                responses.remove("200");
                responses.putIfAbsent("201", new ApiResponse().description("Ticket created.")
                        .content(new Content().addMediaType("application/json", new MediaType()
                                .schema(new Schema<>().$ref("#/components/schemas/Details")))));
            }
        }));
    }

    private static ApiResponse error(String description) {
        return new ApiResponse().description(description).content(new Content()
                .addMediaType("application/problem+json", new MediaType()
                        .schema(new Schema<>().$ref("#/components/schemas/Problem"))));
    }
}
