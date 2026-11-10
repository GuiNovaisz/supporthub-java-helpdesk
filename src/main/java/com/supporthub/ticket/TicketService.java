package com.supporthub.ticket;

import com.supporthub.audit.AuditLog;
import com.supporthub.audit.EventType;
import com.supporthub.auth.SessionPrincipal;
import com.supporthub.comment.CommentService;
import com.supporthub.comment.Visibility;
import com.supporthub.shared.ApiException;
import com.supporthub.shared.PageResult;
import com.supporthub.user.Role;
import com.supporthub.user.UserService;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Locale;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import static com.supporthub.ticket.TicketDtos.*;

@Service
class TicketService {
    private final TicketRepository tickets;
    private final CommentService comments;
    private final AuditLog audit;
    private final UserService users;
    private final Clock clock;

    TicketService(TicketRepository tickets, CommentService comments, AuditLog audit, UserService users, Clock clock) {
        this.tickets = tickets;
        this.comments = comments;
        this.audit = audit;
        this.users = users;
        this.clock = clock;
    }

    @Transactional
    public Details create(SessionPrincipal actor, CreateTicket input) {
        var now = now();
        var reference = String.format(Locale.ROOT, "SUP-%06d", tickets.nextReference());
        var ticket = tickets.saveAndFlush(new Ticket(reference, input.title(), input.description(), actor.id(), now));
        append(ticket, actor, EventType.CREATED, now, null, ticket.status(), "priority=" + ticket.priority());
        append(ticket, actor, EventType.SLA_CONFIGURED, now, null, ticket.firstResponseDueAt(),
                "resolutionDueAt=" + ticket.resolutionDueAt());
        return Details.from(ticket, now);
    }

    @Transactional(readOnly = true)
    public PageResult<Summary> customerList(SessionPrincipal actor, TicketStatus status, Priority priority,
                                            int page, int size, Order order, Direction direction) {
        var now = now();
        return list(TicketQueries.customer(actor.id(), status, priority, now), page, size, order, direction, now);
    }

    @Transactional(readOnly = true)
    public PageResult<Summary> queue(QueueFilter filter, int page, int size, Order order, Direction direction) {
        var now = now();
        return list(TicketQueries.queue(filter, now), page, size, order, direction, now);
    }

    private PageResult<Summary> list(Specification<Ticket> query, int page, int size, Order order,
                                     Direction direction, Instant now) {
        var sort = Sort.by(Sort.Direction.valueOf(direction.name()), order.property(), "id");
        return PageResult.from(tickets.findAll(query, PageRequest.of(page, size, sort)), t -> Summary.from(t, now));
    }

    @Transactional(readOnly = true)
    public Details details(SessionPrincipal actor, String reference) {
        return Details.from(visibleTicket(actor, reference), now());
    }

    @Transactional
    public Details claim(SessionPrincipal actor, String reference) {
        if (actor.role() != Role.AGENT) {
            throw ApiException.forbidden("Only agents may claim a ticket.");
        }
        users.requireActiveAgent(actor.id());
        var ticket = lockTicket(actor, reference);
        var now = now();
        ticket.claim(actor.id(), now);
        append(ticket, actor, EventType.ASSIGNED, now, null, actor.id(), null);
        return Details.from(ticket, now);
    }

    @Transactional
    public Details assign(SessionPrincipal actor, String reference, UUID agentId) {
        if (agentId != null) {
            users.requireActiveAgent(agentId);
        }
        var ticket = lockTicket(actor, reference);
        var previous = ticket.assignedAgentId();
        var now = now();
        if (ticket.assign(agentId, now)) {
            var type = agentId == null ? EventType.UNASSIGNED
                    : previous == null ? EventType.ASSIGNED : EventType.REASSIGNED;
            append(ticket, actor, type, now, previous, agentId, null);
        }
        return Details.from(ticket, now);
    }

    @Transactional
    public Details status(SessionPrincipal actor, String reference, TicketStatus target) {
        var ticket = lockTicket(actor, reference);
        requireOperator(actor, ticket);
        var now = now();
        var previous = ticket.status();
        if (previous == TicketStatus.RESOLVED && target == TicketStatus.IN_PROGRESS) {
            return reopen(ticket, actor, now);
        }
        ticket.transitionTo(target, now);
        var type = switch (target) {
            case RESOLVED -> EventType.RESOLVED;
            case CLOSED -> EventType.CLOSED;
            default -> EventType.STATUS_CHANGED;
        };
        append(ticket, actor, type, now, previous, target, null);
        return Details.from(ticket, now);
    }

    @Transactional
    public Details priority(SessionPrincipal actor, String reference, Priority target) {
        var ticket = lockTicket(actor, reference);
        requireOperator(actor, ticket);
        var previous = ticket.priority();
        var now = now();
        if (ticket.changePriority(target, now)) {
            append(ticket, actor, EventType.PRIORITY_CHANGED, now, previous, target, null);
        }
        return Details.from(ticket, now);
    }

    @Transactional
    public Details reopen(SessionPrincipal actor, String reference) {
        return reopen(lockTicket(actor, reference), actor, now());
    }

    private Details reopen(Ticket ticket, SessionPrincipal actor, Instant now) {
        var previousResolution = ticket.resolvedAt();
        ticket.reopen(now);
        append(ticket, actor, EventType.REOPENED, now, TicketStatus.RESOLVED, TicketStatus.IN_PROGRESS,
                "previousResolvedAt=" + previousResolution);
        return Details.from(ticket, now);
    }

    @Transactional
    public CommentService.CommentView addComment(SessionPrincipal actor, String reference, AddComment input) {
        var ticket = lockTicket(actor, reference);
        boolean staff = isStaff(actor);
        boolean publicComment = input.visibility() == Visibility.PUBLIC;
        if (!staff && !publicComment) {
            throw ApiException.forbidden("Internal comments are restricted to support staff.");
        }
        var now = now();
        boolean firstResponse = ticket.recordComment(publicComment, staff, now);
        var comment = comments.add(ticket.id(), actor.id(), input.body(), input.visibility(), now);
        append(ticket, actor, publicComment ? EventType.PUBLIC_COMMENT : EventType.INTERNAL_COMMENT,
                now, null, comment.id(), null);
        if (firstResponse) {
            append(ticket, actor, EventType.FIRST_RESPONSE, now, null, now, "commentId=" + comment.id());
        }
        return comment;
    }

    @Transactional(readOnly = true)
    public PageResult<CommentService.CommentView> comments(SessionPrincipal actor, String reference,
                                                          int page, int size) {
        return comments.list(visibleTicket(actor, reference).id(), isStaff(actor), page, size);
    }

    @Transactional(readOnly = true)
    public PageResult<AuditLog.EventView> history(SessionPrincipal actor, String reference, int page, int size) {
        return audit.list(visibleTicket(actor, reference).id(), page, size);
    }

    private Ticket visibleTicket(SessionPrincipal actor, String reference) {
        return (isStaff(actor) ? tickets.findByReference(reference)
                : tickets.findByReferenceAndRequesterId(reference, actor.id()))
                .orElseThrow(() -> ApiException.notFound("Ticket not found."));
    }

    private Ticket lockTicket(SessionPrincipal actor, String reference) {
        return (isStaff(actor) ? tickets.lockByReference(reference)
                : tickets.lockByReferenceAndRequesterId(reference, actor.id()))
                .orElseThrow(() -> ApiException.notFound("Ticket not found."));
    }

    private static boolean isStaff(SessionPrincipal actor) {
        return actor.role() != Role.CUSTOMER;
    }

    private static void requireOperator(SessionPrincipal actor, Ticket ticket) {
        if (actor.role() != Role.ADMIN && !actor.id().equals(ticket.assignedAgentId())) {
            throw ApiException.forbidden("Only the assigned agent or an administrator can change this ticket.");
        }
    }

    private void append(Ticket ticket, SessionPrincipal actor, EventType event, Instant now,
                        Object previous, Object next, String metadata) {
        audit.append(ticket.id(), actor.id(), event, now,
                java.util.Objects.toString(previous, null), java.util.Objects.toString(next, null), metadata);
    }

    private Instant now() {
        return clock.instant().truncatedTo(ChronoUnit.MICROS);
    }
}
