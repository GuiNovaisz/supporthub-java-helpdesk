package com.supporthub.audit;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.Immutable;

@Entity
@Immutable
@Table(name = "ticket_event")
class AuditEvent {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private UUID ticketId;
    private UUID actorId;
    @Enumerated(EnumType.STRING)
    private EventType eventType;
    private Instant occurredAt;
    private String previousValue;
    private String newValue;
    private String metadata;

    protected AuditEvent() {}

    AuditEvent(UUID ticketId, UUID actorId, EventType eventType, Instant occurredAt,
               String previousValue, String newValue, String metadata) {
        this.ticketId = ticketId;
        this.actorId = actorId;
        this.eventType = eventType;
        this.occurredAt = occurredAt;
        this.previousValue = previousValue;
        this.newValue = newValue;
        this.metadata = metadata;
    }

    AuditLog.EventView view() {
        return new AuditLog.EventView(id, actorId, eventType, occurredAt, previousValue, newValue, metadata);
    }
}
