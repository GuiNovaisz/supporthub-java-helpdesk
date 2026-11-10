package com.supporthub.audit;

import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.Repository;

interface AuditRepository extends Repository<AuditEvent, Long> {
    AuditEvent save(AuditEvent event);

    Page<AuditEvent> findByTicketId(UUID ticketId, Pageable pageable);
}
