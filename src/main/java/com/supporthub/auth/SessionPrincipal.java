package com.supporthub.auth;

import com.supporthub.user.Role;
import com.supporthub.user.UserAccount;
import java.io.Serializable;
import java.util.UUID;

public record SessionPrincipal(UUID id, Role role, long authVersion) implements Serializable {
    static SessionPrincipal from(UserAccount account) {
        return new SessionPrincipal(account.id(), account.role(), account.authVersion());
    }
}
