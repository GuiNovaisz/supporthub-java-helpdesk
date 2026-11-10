package com.supporthub.ticket;

import com.supporthub.auth.SessionPrincipal;
import com.supporthub.comment.CommentService.CommentView;
import com.supporthub.shared.PageResult;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.net.URI;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import static com.supporthub.ticket.TicketDtos.*;

@RestController
@RequestMapping("/api/v1/tickets")
@Tag(name = "Customer tickets", description = "CUSTOMER only. Requests are scoped to the authenticated requester.")
class CustomerTicketController {
    private final TicketService tickets;

    CustomerTicketController(TicketService tickets) {
        this.tickets = tickets;
    }

    @PostMapping
    ResponseEntity<Details> create(@AuthenticationPrincipal SessionPrincipal actor,
                                    @Valid @RequestBody CreateTicket input) {
        var ticket = tickets.create(actor, input);
        return ResponseEntity.created(URI.create("/api/v1/tickets/" + ticket.reference())).body(ticket);
    }

    @GetMapping
    PageResult<Summary> list(@AuthenticationPrincipal SessionPrincipal actor,
                             @RequestParam(required = false) TicketStatus status,
                             @RequestParam(required = false) Priority priority,
                             @RequestParam(defaultValue = "0") @Min(0) @Max(100000) int page,
                             @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
                             @RequestParam(defaultValue = "CREATED_AT") Order sort,
                             @RequestParam(defaultValue = "DESC") Direction direction) {
        return tickets.customerList(actor, status, priority, page, size, sort, direction);
    }

    @GetMapping("/{reference}")
    Details detail(@AuthenticationPrincipal SessionPrincipal actor, @PathVariable String reference) {
        return tickets.details(actor, reference);
    }

    @PostMapping("/{reference}/reopen")
    Details reopen(@AuthenticationPrincipal SessionPrincipal actor, @PathVariable String reference) {
        return tickets.reopen(actor, reference);
    }

    @GetMapping("/{reference}/comments")
    PageResult<CommentView> comments(@AuthenticationPrincipal SessionPrincipal actor, @PathVariable String reference,
                                     @RequestParam(defaultValue = "0") @Min(0) @Max(100000) int page,
                                     @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return tickets.comments(actor, reference, page, size);
    }

    @PostMapping("/{reference}/comments")
    @ResponseStatus(org.springframework.http.HttpStatus.CREATED)
    CommentView comment(@AuthenticationPrincipal SessionPrincipal actor, @PathVariable String reference,
                        @Valid @RequestBody AddComment input) {
        return tickets.addComment(actor, reference, input);
    }
}
