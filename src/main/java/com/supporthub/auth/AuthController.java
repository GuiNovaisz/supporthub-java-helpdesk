package com.supporthub.auth;

import com.supporthub.shared.ApiException;
import com.supporthub.user.UserDtos.Account;
import com.supporthub.user.UserDtos.CreateAccount;
import com.supporthub.user.UserService;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.session.SessionAuthenticationStrategy;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
@Tag(name = "Session", description = "Fetch a CSRF token before any write and refresh it after login.")
class AuthController {
    private final UserService users;
    private final AuthenticationManager authentication;
    private final SessionAuthenticationStrategy sessions;
    private final SecurityContextRepository contexts;

    AuthController(UserService users, AuthenticationManager authentication,
                   SessionAuthenticationStrategy sessions, SecurityContextRepository contexts) {
        this.users = users;
        this.authentication = authentication;
        this.sessions = sessions;
        this.contexts = contexts;
    }

    @GetMapping("/csrf")
    @SecurityRequirements
    ResponseEntity<Csrf> csrf(CsrfToken token) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(new Csrf(token.getHeaderName(), token.getToken()));
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    Account register(@Valid @RequestBody CreateAccount input) {
        return users.registerCustomer(input);
    }

    @PostMapping("/login")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void login(@Valid @RequestBody Login input, HttpServletRequest request, HttpServletResponse response) {
        var signedIn = authentication.authenticate(
                UsernamePasswordAuthenticationToken.unauthenticated(input.email(), input.password()));
        sessions.onAuthentication(signedIn, request, response);
        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(signedIn);
        SecurityContextHolder.setContext(context);
        contexts.saveContext(context, request, response);
    }

    @GetMapping("/me")
    Account me(@AuthenticationPrincipal SessionPrincipal principal) {
        return users.findById(principal.id()).filter(user -> user.active()).map(Account::from)
                .orElseThrow(() -> ApiException.notFound("Account not found."));
    }

    record Login(@NotBlank @Email @Size(max = 254) String email,
                 @NotBlank @Size(max = 72) String password) {}

    record Csrf(String headerName, String token) {}
}
