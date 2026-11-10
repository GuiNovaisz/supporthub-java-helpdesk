package com.supporthub.comment;

import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

interface CommentRepository extends JpaRepository<TicketComment, UUID> {
    Page<TicketComment> findByTicketId(UUID ticketId, Pageable pageable);

    Page<TicketComment> findByTicketIdAndVisibility(UUID ticketId, Visibility visibility, Pageable pageable);
}
