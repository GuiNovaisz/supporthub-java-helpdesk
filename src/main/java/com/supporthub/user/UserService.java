package com.supporthub.user;

import com.supporthub.shared.ApiException;
import com.supporthub.shared.PageResult;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserService {
    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final JdbcTemplate jdbc;
    private final Clock clock;

    UserService(UserRepository users, PasswordEncoder passwords, JdbcTemplate jdbc, Clock clock) {
        this.users = users;
        this.passwords = passwords;
        this.jdbc = jdbc;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Optional<UserAccount> findByEmail(String email) {
        return users.findByEmail(normalize(email));
    }

    @Transactional(readOnly = true)
    public Optional<UserAccount> findById(UUID id) {
        return users.findById(id);
    }

    @Transactional
    public UserDtos.Account registerCustomer(UserDtos.CreateAccount input) {
        return create(input, Role.CUSTOMER);
    }

    @Transactional
    public UserDtos.Account createAgent(UserDtos.CreateAccount input) {
        return create(input, Role.AGENT);
    }

    @Transactional
    public void bootstrapAdmin(UserDtos.CreateAccount input) {
        if (findByEmail(input.email()).isEmpty()) {
            insert(input, Role.ADMIN);
        }
        var user = findByEmail(input.email()).orElseThrow();
        if (user.role() != Role.ADMIN || !user.active()) {
            throw new IllegalStateException("Bootstrap email is already reserved by an incompatible account.");
        }
    }

    private UserDtos.Account create(UserDtos.CreateAccount input, Role role) {
        if (insert(input, role) == 0) {
            throw ApiException.conflict("Email is already registered.");
        }
        return UserDtos.Account.from(findByEmail(input.email()).orElseThrow());
    }

    private int insert(UserDtos.CreateAccount input, Role role) {
        if (passwordTooLong(input.password())) {
            throw ApiException.invalid("Password must fit within 72 UTF-8 bytes.");
        }
        var user = new UserAccount(input.name().strip(), normalize(input.email()),
                passwords.encode(input.password()), role, clock.instant());
        return jdbc.update("""
                insert into user_account (id, name, email, password_hash, role, active, created_at, updated_at)
                values (?, ?, ?, ?, ?, true, ?, ?) on conflict (email) do nothing
                """, user.id(), user.name(), user.email(), user.passwordHash(), role.name(),
                java.sql.Timestamp.from(user.createdAt()), java.sql.Timestamp.from(user.updatedAt()));
    }

    @Transactional(readOnly = true)
    public PageResult<UserDtos.Account> list(int page, int size) {
        return PageResult.from(users.findAll(PageRequest.of(page, size, Sort.by("email"))), UserDtos.Account::from);
    }

    @Transactional
    public UserDtos.Account setActive(UUID id, boolean active) {
        var user = users.lockById(id).orElseThrow(() -> ApiException.notFound("User not found."));
        if (user.role() == Role.ADMIN) {
            throw ApiException.forbidden("Administrator status cannot be changed through this API.");
        }
        user.setActive(active, clock.instant());
        return UserDtos.Account.from(user);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void requireActiveAgent(UUID id) {
        var user = users.lockById(id).orElseThrow(() -> ApiException.notFound("Agent not found."));
        if (user.role() != Role.AGENT || !user.active()) {
            throw ApiException.invalid("Assignee must be an active agent.");
        }
    }

    public static boolean passwordTooLong(String password) {
        return password.getBytes(StandardCharsets.UTF_8).length > 72;
    }

    private static String normalize(String email) {
        return email.strip().toLowerCase(Locale.ROOT);
    }
}
