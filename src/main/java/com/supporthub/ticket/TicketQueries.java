package com.supporthub.ticket;

import com.supporthub.sla.SlaPolicy.Outcome;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Predicate;
import java.time.Instant;
import java.util.ArrayList;
import java.util.UUID;
import org.springframework.data.jpa.domain.Specification;

final class TicketQueries {
    private TicketQueries() {}

    static Specification<Ticket> customer(UUID customer, TicketStatus status, Priority priority, Instant now) {
        var filter = new TicketDtos.QueueFilter(status, priority, null, customer, null, null, null);
        return queue(filter, now);
    }

    static Specification<Ticket> queue(TicketDtos.QueueFilter filter, Instant now) {
        return (ticket, query, criteria) -> {
            var predicates = new ArrayList<Predicate>();
            if (filter.status() != null) {
                predicates.add(criteria.equal(ticket.get("status"), filter.status()));
            }
            if (filter.priority() != null) {
                predicates.add(criteria.equal(ticket.get("priority"), filter.priority()));
            }
            if (filter.requesterId() != null) {
                predicates.add(criteria.equal(ticket.get("requesterId"), filter.requesterId()));
            }
            if (filter.agentId() != null) {
                predicates.add(criteria.equal(ticket.get("assignedAgentId"), filter.agentId()));
            }
            if (filter.assigned() != null) {
                var assignee = ticket.get("assignedAgentId");
                predicates.add(filter.assigned() ? criteria.isNotNull(assignee) : criteria.isNull(assignee));
            }
            if (filter.firstResponseSla() != null) {
                predicates.add(sla(criteria, filter.firstResponseSla(), ticket.get("firstResponseDueAt"),
                        ticket.get("firstResponseAt"), now));
            }
            if (filter.resolutionSla() != null) {
                predicates.add(sla(criteria, filter.resolutionSla(), ticket.get("resolutionDueAt"),
                        ticket.get("resolvedAt"), now));
            }
            return criteria.and(predicates.toArray(Predicate[]::new));
        };
    }

    private static Predicate sla(CriteriaBuilder cb, Outcome outcome, Expression<Instant> dueAt,
                                 Expression<Instant> completedAt, Instant now) {
        return switch (outcome) {
            case PENDING -> cb.and(cb.isNull(completedAt), cb.greaterThanOrEqualTo(dueAt, now));
            case MET -> cb.lessThanOrEqualTo(completedAt, dueAt);
            case BREACHED -> cb.or(cb.greaterThan(completedAt, dueAt),
                    cb.and(cb.isNull(completedAt), cb.lessThan(dueAt, now)));
        };
    }
}
