package com.supporthub.user;

import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.UUID;

public final class UserDtos {
    private UserDtos() {}

    public record CreateAccount(
            @NotBlank @Size(max = 100) @Pattern(regexp = "[^\\x00]*") String name,
            @NotBlank @Email @Size(max = 254) @Pattern(regexp = "[!-~]+") String email,
            @NotBlank @Size(min = 12, max = 72) String password) {}

    public record AccountStatus(@NotNull Boolean active) {}

    public record Account(UUID id, String name, String email, Role role, boolean active,
                          Instant createdAt, Instant updatedAt) {
        public static Account from(UserAccount user) {
            return new Account(user.id(), user.name(), user.email(), user.role(), user.active(),
                    user.createdAt(), user.updatedAt());
        }
    }
}
