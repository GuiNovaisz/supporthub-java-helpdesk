package com.supporthub;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.CookieManager;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

final class HttpSessionClient {
    private final URI base;
    private final ObjectMapper json;
    private final CookieManager cookies = new CookieManager();
    private final HttpClient client = HttpClient.newBuilder().cookieHandler(cookies)
            .connectTimeout(Duration.ofSeconds(5)).build();
    private String csrf;

    HttpSessionClient(int port, ObjectMapper json) {
        this.base = URI.create("http://localhost:" + port);
        this.json = json;
    }

    Reply refreshCsrf() throws Exception {
        var result = send("GET", "/api/v1/auth/csrf", null).expect(200);
        assertThat(result.body().path("headerName").asText()).isEqualTo("X-CSRF-TOKEN");
        csrf = result.body().path("token").asText();
        assertThat(csrf).isNotBlank();
        return result;
    }

    void signIn(String email, String password) throws Exception {
        refreshCsrf();
        send("POST", "/api/v1/auth/login", Map.of("email", email, "password", password)).expect(204);
        refreshCsrf();
    }

    String sessionId() {
        return cookies.getCookieStore().getCookies().stream().filter(c -> c.getName().equals("JSESSIONID"))
                .findFirst().orElseThrow().getValue();
    }

    Reply send(String method, String path, Object payload) throws Exception {
        var request = HttpRequest.newBuilder(base.resolve(path)).timeout(Duration.ofSeconds(25))
                .header("Accept", "application/json, application/problem+json");
        if (csrf != null && !method.equals("GET")) {
            request.header("X-CSRF-TOKEN", csrf);
        }
        var body = HttpRequest.BodyPublishers.noBody();
        if (payload != null) {
            request.header("Content-Type", "application/json");
            body = HttpRequest.BodyPublishers.ofString(json.writeValueAsString(payload));
        }
        var response = client.send(request.method(method, body).build(), HttpResponse.BodyHandlers.ofString());
        return new Reply(response.statusCode(), response.body().isEmpty() ? json.nullNode()
                : json.readTree(response.body()), response);
    }

    record Reply(int status, JsonNode body, HttpResponse<String> response) {
        Reply expect(int expected) {
            assertThat(status).as("%s %s returned %s", response.request().method(), response.uri(), body)
                    .isEqualTo(expected);
            return this;
        }

        Reply problem(int expected) {
            expect(expected);
            assertThat(response.headers().firstValue("Content-Type")).hasValueSatisfying(
                    value -> assertThat(value).startsWith("application/problem+json"));
            assertThat(body.path("status").asInt()).isEqualTo(expected);
            assertThat(body.path("detail").asText()).isNotBlank();
            return this;
        }
    }
}
