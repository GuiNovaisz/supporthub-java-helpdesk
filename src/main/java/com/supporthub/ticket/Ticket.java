package com.supporthub.ticket;

import com.supporthub.shared.ApiException;
import com.supporthub.sla.SlaPolicy;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "ticket")
class Ticket {
    @Id
    private UUID id;
    private String reference;
    private String title;
    private String description;
    @Enumerated(EnumType.STRING)
    private TicketStatus status;
    @Enumerated(EnumType.STRING)
    private Priority priority;
    private UUID requesterId;
    private UUID assignedAgentId;
    private Instant createdAt;
    private Instant updatedAt;
    private Instant firstResponseAt;
    private Instant resolvedAt;
    private Instant closedAt;
    private Instant firstResponseDueAt;
    private Instant resolutionDueAt;

    protected Ticket() {}

    Ticket(String reference, String title, String description, UUID requesterId, Instant now) {
        this.id = UUID.randomUUID();
        this.reference = reference;
        this.title = title.strip();
        this.description = description.strip();
        this.requesterId = requesterId;
        this.status = TicketStatus.OPEN;
        this.priority = Priority.MEDIUM;
        this.createdAt = now;
        this.updatedAt = now;
        var deadlines = SlaPolicy.deadlines(priority, now);
        this.firstResponseDueAt = deadlines.firstResponseDueAt();
        this.resolutionDueAt = deadlines.resolutionDueAt();
    }

    void transitionTo(TicketStatus target, Instant now) {
        if (!status.allows(target)) {
            throw ApiException.conflict("Transition from %s to %s is not allowed.".formatted(status, target));
        }
        if (status == TicketStatus.OPEN && assignedAgentId == null) {
            throw ApiException.conflict("Assign an agent before starting work.");
        }
        if (status == TicketStatus.RESOLVED && target == TicketStatus.IN_PROGRESS) {
            resolvedAt = null;
        }
        if (target == TicketStatus.RESOLVED) {
            resolvedAt = now;
        }
        if (target == TicketStatus.CLOSED) {
            closedAt = now;
        }
        status = target;
        updatedAt = now;
    }

    void reopen(Instant now) {
        if (status != TicketStatus.RESOLVED) {
            throw ApiException.conflict("Only resolved tickets can be reopened.");
        }
        transitionTo(TicketStatus.IN_PROGRESS, now);
    }

    void claim(UUID agent, Instant now) {
        requireOpenCycle();
        if (assignedAgentId != null) {
            throw ApiException.conflict("Ticket already has an assigned agent.");
        }
        assign(agent, now);
    }

    boolean assign(UUID agent, Instant now) {
        requireOpenCycle();
        if (java.util.Objects.equals(assignedAgentId, agent)) {
            return false;
        }
        assignedAgentId = agent;
        updatedAt = now;
        return true;
    }

    boolean changePriority(Priority target, Instant now) {
        requireOpenCycle();
        if (priority == target) {
            return false;
        }
        priority = target;
        updatedAt = now;
        return true;
    }

    boolean recordComment(boolean publicComment, boolean staff, Instant now) {
        if (status == TicketStatus.CLOSED) {
            throw ApiException.conflict("Closed tickets do not accept comments.");
        }
        if (publicComment) {
            updatedAt = now;
        }
        if (publicComment && staff && firstResponseAt == null) {
            firstResponseAt = now;
            return true;
        }
        return false;
    }

    private void requireOpenCycle() {
        if (status == TicketStatus.RESOLVED || status == TicketStatus.CLOSED) {
            throw ApiException.conflict("Assignment and priority require an active ticket.");
        }
    }

    UUID id() { return id; }
    String reference() { return reference; }
    String title() { return title; }
    String description() { return description; }
    TicketStatus status() { return status; }
    Priority priority() { return priority; }
    UUID requesterId() { return requesterId; }
    UUID assignedAgentId() { return assignedAgentId; }
    Instant createdAt() { return createdAt; }
    Instant updatedAt() { return updatedAt; }
    Instant firstResponseAt() { return firstResponseAt; }
    Instant resolvedAt() { return resolvedAt; }
    Instant closedAt() { return closedAt; }
    Instant firstResponseDueAt() { return firstResponseDueAt; }
    Instant resolutionDueAt() { return resolutionDueAt; }
}
