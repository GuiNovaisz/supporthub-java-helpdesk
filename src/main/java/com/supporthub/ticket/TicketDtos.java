package com.supporthub.ticket;

import com.supporthub.comment.Visibility;
import com.supporthub.sla.SlaPolicy;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.UUID;

final class TicketDtos {
    private TicketDtos() {}

    record CreateTicket(@NotBlank @Size(max = 160) @Pattern(regexp = "[^\\x00]*") String title,
                        @NotBlank @Size(max = 8000) @Pattern(regexp = "[^\\x00]*") String description) {}

    record ChangeStatus(@NotNull TicketStatus status) {}

    record ChangePriority(@NotNull Priority priority) {}

    record AssignAgent(@NotNull UUID agentId) {}

    record AddComment(@NotBlank @Size(max = 4000) @Pattern(regexp = "[^\\x00]*") String body,
                      @NotNull Visibility visibility) {}

    enum Order {
        CREATED_AT("createdAt"), UPDATED_AT("updatedAt"),
        FIRST_RESPONSE_DUE_AT("firstResponseDueAt"), RESOLUTION_DUE_AT("resolutionDueAt");

        private final String property;

        Order(String property) {
            this.property = property;
        }

        String property() {
            return property;
        }
    }

    enum Direction { ASC, DESC }

    record QueueFilter(TicketStatus status, Priority priority, Boolean assigned, UUID requesterId, UUID agentId,
                       SlaPolicy.Outcome firstResponseSla, SlaPolicy.Outcome resolutionSla) {}

    record Summary(String reference, String title, TicketStatus status, Priority priority, UUID requesterId,
                   UUID assignedAgentId, Instant createdAt, Instant updatedAt, Sla sla) {
        static Summary from(Ticket ticket, Instant now) {
            return new Summary(ticket.reference(), ticket.title(), ticket.status(), ticket.priority(),
                    ticket.requesterId(), ticket.assignedAgentId(), ticket.createdAt(), ticket.updatedAt(),
                    Sla.from(ticket, now));
        }
    }

    record Details(String reference, String title, String description, TicketStatus status, Priority priority,
                   UUID requesterId, UUID assignedAgentId, Instant createdAt, Instant updatedAt,
                   Instant closedAt, Sla sla) {
        static Details from(Ticket ticket, Instant now) {
            return new Details(ticket.reference(), ticket.title(), ticket.description(), ticket.status(),
                    ticket.priority(), ticket.requesterId(), ticket.assignedAgentId(), ticket.createdAt(),
                    ticket.updatedAt(), ticket.closedAt(), Sla.from(ticket, now));
        }
    }

    record Sla(Instant firstResponseDueAt, Instant firstResponseAt, SlaPolicy.Outcome firstResponseStatus,
               Instant resolutionDueAt, Instant resolvedAt, SlaPolicy.Outcome resolutionStatus) {
        static Sla from(Ticket ticket, Instant now) {
            return new Sla(ticket.firstResponseDueAt(), ticket.firstResponseAt(),
                    SlaPolicy.outcome(ticket.firstResponseDueAt(), ticket.firstResponseAt(), now),
                    ticket.resolutionDueAt(), ticket.resolvedAt(),
                    SlaPolicy.outcome(ticket.resolutionDueAt(), ticket.resolvedAt(), now));
        }
    }
}
