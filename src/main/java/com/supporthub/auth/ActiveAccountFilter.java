package com.supporthub.auth;

import com.supporthub.user.UserService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.filter.OncePerRequestFilter;

class ActiveAccountFilter extends OncePerRequestFilter {
    private final UserService users;
    private final SecurityContextLogoutHandler logout = new SecurityContextLogoutHandler();

    ActiveAccountFilter(UserService users, SecurityContextRepository contexts) {
        this.users = users;
        logout.setSecurityContextRepository(contexts);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof SessionPrincipal principal) {
            var account = users.findById(principal.id());
            if (account.filter(user -> user.active() && user.authVersion() == principal.authVersion()
                    && user.role() == principal.role()).isEmpty()) {
                logout.logout(request, response, authentication);
            }
        }
        chain.doFilter(request, response);
    }
}
