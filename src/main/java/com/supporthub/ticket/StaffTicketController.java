package com.supporthub.ticket;

import com.supporthub.audit.AuditLog.EventView;
import com.supporthub.auth.SessionPrincipal;
import com.supporthub.comment.CommentService.CommentView;
import com.supporthub.shared.PageResult;
import com.supporthub.sla.SlaPolicy.Outcome;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import static com.supporthub.ticket.TicketDtos.*;

@RestController
@RequestMapping("/api/v1/agent/tickets")
@Tag(name = "Support queue", description = "AGENT and ADMIN. Agents may change status and priority on tickets assigned to them.")
class StaffTicketController {
    private final TicketService tickets;

    StaffTicketController(TicketService tickets) {
        this.tickets = tickets;
    }

    @GetMapping
    PageResult<Summary> queue(@RequestParam(required = false) TicketStatus status,
                              @RequestParam(required = false) Priority priority,
                              @RequestParam(required = false) Boolean assigned,
                              @RequestParam(required = false) UUID requesterId,
                              @RequestParam(required = false) UUID agentId,
                              @RequestParam(required = false) Outcome firstResponseSla,
                              @RequestParam(required = false) Outcome resolutionSla,
                              @RequestParam(defaultValue = "0") @Min(0) @Max(100000) int page,
                              @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
                              @RequestParam(defaultValue = "CREATED_AT") Order sort,
                              @RequestParam(defaultValue = "DESC") Direction direction) {
        var filter = new QueueFilter(status, priority, assigned, requesterId, agentId, firstResponseSla, resolutionSla);
        return tickets.queue(filter, page, size, sort, direction);
    }

    @GetMapping("/{reference}")
    Details detail(@AuthenticationPrincipal SessionPrincipal actor, @PathVariable String reference) {
        return tickets.details(actor, reference);
    }

    @PostMapping("/{reference}/claim")
    @Operation(description = "AGENT only. Claims an active ticket with no assignee. Competing claims return 409.")
    Details claim(@AuthenticationPrincipal SessionPrincipal actor, @PathVariable String reference) {
        return tickets.claim(actor, reference);
    }

    @PatchMapping("/{reference}/status")
    Details status(@AuthenticationPrincipal SessionPrincipal actor, @PathVariable String reference,
                   @Valid @RequestBody ChangeStatus input) {
        return tickets.status(actor, reference, input.status());
    }

    @PatchMapping("/{reference}/priority")
    Details priority(@AuthenticationPrincipal SessionPrincipal actor, @PathVariable String reference,
                     @Valid @RequestBody ChangePriority input) {
        return tickets.priority(actor, reference, input.priority());
    }

    @GetMapping("/{reference}/comments")
    PageResult<CommentView> comments(@AuthenticationPrincipal SessionPrincipal actor, @PathVariable String reference,
                                     @RequestParam(defaultValue = "0") @Min(0) @Max(100000) int page,
                                     @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return tickets.comments(actor, reference, page, size);
    }

    @PostMapping("/{reference}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    CommentView comment(@AuthenticationPrincipal SessionPrincipal actor, @PathVariable String reference,
                        @Valid @RequestBody AddComment input) {
        return tickets.addComment(actor, reference, input);
    }

    @GetMapping("/{reference}/history")
    PageResult<EventView> history(@AuthenticationPrincipal SessionPrincipal actor, @PathVariable String reference,
                                  @RequestParam(defaultValue = "0") @Min(0) @Max(100000) int page,
                                  @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return tickets.history(actor, reference, page, size);
    }
}
