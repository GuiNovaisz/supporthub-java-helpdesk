package com.supporthub.user;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "user_account")
public class UserAccount {
    @Id
    private UUID id;
    private String name;
    private String email;
    private String passwordHash;
    @Enumerated(EnumType.STRING)
    private Role role;
    private boolean active;
    private long authVersion;
    private Instant createdAt;
    private Instant updatedAt;

    protected UserAccount() {}

    UserAccount(String name, String email, String passwordHash, Role role, Instant now) {
        this.id = UUID.randomUUID();
        this.name = name;
        this.email = email;
        this.passwordHash = passwordHash;
        this.role = role;
        this.active = true;
        this.createdAt = now;
        this.updatedAt = now;
    }

    void setActive(boolean value, Instant now) {
        if (active != value) {
            active = value;
            authVersion++;
            updatedAt = now;
        }
    }

    public UUID id() { return id; }
    public String name() { return name; }
    public String email() { return email; }
    public String passwordHash() { return passwordHash; }
    public Role role() { return role; }
    public boolean active() { return active; }
    public long authVersion() { return authVersion; }
    public Instant createdAt() { return createdAt; }
    public Instant updatedAt() { return updatedAt; }
}
