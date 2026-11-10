package com.supporthub.comment;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "ticket_comment")
class TicketComment {
    @Id
    private UUID id;
    private UUID ticketId;
    private UUID authorId;
    private String body;
    @Enumerated(EnumType.STRING)
    private Visibility visibility;
    private Instant createdAt;

    protected TicketComment() {}

    TicketComment(UUID ticketId, UUID authorId, String body, Visibility visibility, Instant createdAt) {
        this.id = UUID.randomUUID();
        this.ticketId = ticketId;
        this.authorId = authorId;
        this.body = body.strip();
        this.visibility = visibility;
        this.createdAt = createdAt;
    }

    CommentService.CommentView view() {
        return new CommentService.CommentView(id, authorId, body, visibility, createdAt);
    }
}
