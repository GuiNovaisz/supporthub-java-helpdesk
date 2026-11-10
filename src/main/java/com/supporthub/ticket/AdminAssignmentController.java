package com.supporthub.ticket;

import com.supporthub.auth.SessionPrincipal;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import static com.supporthub.ticket.TicketDtos.*;

@RestController
@RequestMapping("/api/v1/admin/tickets/{reference}/assignment")
@Tag(name = "Assignment", description = "ADMIN only. Assign, reassign or remove an agent from an active ticket.")
class AdminAssignmentController {
    private final TicketService tickets;

    AdminAssignmentController(TicketService tickets) {
        this.tickets = tickets;
    }

    @PutMapping
    Details assign(@AuthenticationPrincipal SessionPrincipal actor, @PathVariable String reference,
                   @Valid @RequestBody AssignAgent input) {
        return tickets.assign(actor, reference, input.agentId());
    }

    @DeleteMapping
    Details remove(@AuthenticationPrincipal SessionPrincipal actor, @PathVariable String reference) {
        return tickets.assign(actor, reference, null);
    }
}
