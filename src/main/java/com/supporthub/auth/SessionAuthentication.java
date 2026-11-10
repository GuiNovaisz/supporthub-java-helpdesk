package com.supporthub.auth;

import com.supporthub.user.UserAccount;
import com.supporthub.user.UserService;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.crypto.password.PasswordEncoder;

class SessionAuthentication implements AuthenticationProvider {
    private final UserService users;
    private final PasswordEncoder passwords;
    private final String fallbackHash;

    SessionAuthentication(UserService users, PasswordEncoder passwords) {
        this.users = users;
        this.passwords = passwords;
        this.fallbackHash = passwords.encode(java.util.UUID.randomUUID().toString());
    }

    @Override
    public Authentication authenticate(Authentication attempt) {
        String password = (String) attempt.getCredentials();
        if (UserService.passwordTooLong(password)) {
            throw new BadCredentialsException("Invalid credentials");
        }
        var user = users.findByEmail(attempt.getName()).orElse(null);
        String hash = user == null ? fallbackHash : user.passwordHash();
        if (!passwords.matches(password, hash) || user == null || !user.active()) {
            throw new BadCredentialsException("Invalid credentials");
        }
        return authenticated(user);
    }

    static Authentication authenticated(UserAccount user) {
        return UsernamePasswordAuthenticationToken.authenticated(SessionPrincipal.from(user), null,
                AuthorityUtils.createAuthorityList("ROLE_" + user.role().name()));
    }

    @Override
    public boolean supports(Class<?> authentication) {
        return UsernamePasswordAuthenticationToken.class.isAssignableFrom(authentication);
    }
}
