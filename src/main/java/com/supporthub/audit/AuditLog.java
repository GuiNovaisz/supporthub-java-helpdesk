package com.supporthub.audit;

import com.supporthub.shared.PageResult;
import java.time.Instant;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuditLog {
    private final AuditRepository events;

    AuditLog(AuditRepository events) {
        this.events = events;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void append(UUID ticket, UUID actor, EventType type, Instant now,
                       String previous, String next, String metadata) {
        events.save(new AuditEvent(ticket, actor, type, now, previous, next, metadata));
    }

    @Transactional(readOnly = true, propagation = Propagation.MANDATORY)
    public PageResult<EventView> list(UUID ticket, int page, int size) {
        return PageResult.from(events.findByTicketId(ticket, PageRequest.of(page, size, Sort.by("id"))),
                AuditEvent::view);
    }

    public record EventView(long id, UUID actorId, EventType type, Instant occurredAt, String previousValue,
                            String newValue, String metadata) {}
}
