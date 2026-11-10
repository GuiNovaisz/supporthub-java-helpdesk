package com.supporthub.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.supporthub.shared.ApiErrors;
import com.supporthub.user.UserService;
import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.intercept.AuthorizationFilter;
import org.springframework.security.web.authentication.session.ChangeSessionIdAuthenticationStrategy;
import org.springframework.security.web.authentication.session.CompositeSessionAuthenticationStrategy;
import org.springframework.security.web.authentication.session.SessionAuthenticationStrategy;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CsrfAuthenticationStrategy;
import org.springframework.security.web.csrf.CsrfTokenRepository;
import org.springframework.security.web.csrf.HttpSessionCsrfTokenRepository;

@Configuration
class SecurityConfig {
    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    AuthenticationManager authenticationManager(UserService users, PasswordEncoder passwords) {
        return new ProviderManager(new SessionAuthentication(users, passwords));
    }

    @Bean
    SecurityContextRepository securityContexts() {
        return new HttpSessionSecurityContextRepository();
    }

    @Bean
    CsrfTokenRepository csrfTokens() {
        return new HttpSessionCsrfTokenRepository();
    }

    @Bean
    SessionAuthenticationStrategy sessionAuthentication(CsrfTokenRepository tokens) {
        return new CompositeSessionAuthenticationStrategy(List.of(
                new ChangeSessionIdAuthenticationStrategy(), new CsrfAuthenticationStrategy(tokens)));
    }

    @Bean
    SecurityFilterChain security(HttpSecurity http, UserService users, ObjectMapper mapper,
                                 SecurityContextRepository contexts, CsrfTokenRepository tokens) throws Exception {
        return http.securityContext(security -> security.securityContextRepository(contexts))
                .csrf(csrf -> csrf.csrfTokenRepository(tokens))
                .requestCache(cache -> cache.disable())
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint((request, response, failure) ->
                                ApiErrors.write(mapper, response, HttpStatus.UNAUTHORIZED, "Authentication required."))
                        .accessDeniedHandler((request, response, failure) ->
                                ApiErrors.write(mapper, response, HttpStatus.FORBIDDEN, "Access denied or invalid CSRF token.")))
                .logout(logout -> logout
                        .logoutUrl("/api/v1/auth/logout")
                        .deleteCookies("JSESSIONID")
                        .logoutSuccessHandler((request, response, authentication) -> response.setStatus(204)))
                .addFilterBefore(new ActiveAccountFilter(users, contexts), AuthorizationFilter.class)
                .authorizeHttpRequests(routes -> routes
                        .requestMatchers(HttpMethod.GET, "/api/v1/auth/csrf", "/actuator/health", "/actuator/health/readiness", "/actuator/info",
                                "/v3/api-docs/**", "/swagger-ui.html", "/swagger-ui/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/auth/register", "/api/v1/auth/login").permitAll()
                        .requestMatchers("/api/v1/auth/me").authenticated()
                        .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
                        .requestMatchers("/api/v1/agent/**").hasAnyRole("AGENT", "ADMIN")
                        .requestMatchers("/api/v1/tickets", "/api/v1/tickets/**").hasRole("CUSTOMER")
                        .anyRequest().denyAll())
                .build();
    }
}
