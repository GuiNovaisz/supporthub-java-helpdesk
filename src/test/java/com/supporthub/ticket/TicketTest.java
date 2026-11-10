package com.supporthub.ticket;

import com.supporthub.shared.ApiException;
import java.time.Instant;
import java.util.EnumSet;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import static com.supporthub.ticket.TicketStatus.*;
import static org.assertj.core.api.Assertions.*;

class TicketTest {
    private static final Instant OPENED = Instant.parse("2026-11-10T13:00:00Z");
    private static final UUID AGENT = UUID.randomUUID();

    @ParameterizedTest
    @EnumSource(TicketStatus.class)
    void enforcesTheCompleteTransitionMatrix(TicketStatus from) {
        var allowed = Map.of(OPEN, EnumSet.of(IN_PROGRESS),
                IN_PROGRESS, EnumSet.of(WAITING_CUSTOMER, RESOLVED),
                WAITING_CUSTOMER, EnumSet.of(IN_PROGRESS, RESOLVED),
                RESOLVED, EnumSet.of(IN_PROGRESS, CLOSED),
                CLOSED, EnumSet.noneOf(TicketStatus.class));
        for (var to : TicketStatus.values()) {
            assertThat(from.allows(to)).as("%s to %s", from, to).isEqualTo(allowed.get(from).contains(to));
        }
    }

    @Test
    void claimCannotStealAndStartingRequiresAssignment() {
        var ticket = ticket();
        assertThatThrownBy(() -> ticket.transitionTo(IN_PROGRESS, OPENED)).isInstanceOf(ApiException.class);
        ticket.claim(AGENT, OPENED);
        assertThatThrownBy(() -> ticket.claim(UUID.randomUUID(), OPENED)).isInstanceOf(ApiException.class);
        assertThat(ticket.assignedAgentId()).isEqualTo(AGENT);
        ticket.transitionTo(IN_PROGRESS, OPENED);
        assertThat(ticket.status()).isEqualTo(IN_PROGRESS);
    }

    @Test
    void priorityChangeAndReopenPreserveOpeningDeadlines() {
        var ticket = ticket();
        var responseDueAt = ticket.firstResponseDueAt();
        var resolutionDueAt = ticket.resolutionDueAt();
        assertThat(ticket.changePriority(Priority.URGENT, OPENED)).isTrue();
        assertThat(ticket.changePriority(Priority.URGENT, OPENED)).isFalse();
        ticket.claim(AGENT, OPENED);
        ticket.transitionTo(IN_PROGRESS, OPENED);
        ticket.transitionTo(RESOLVED, OPENED.plusSeconds(10));
        assertThat(ticket.resolvedAt()).isNotNull();
        ticket.reopen(OPENED.plusSeconds(20));
        assertThat(ticket.resolvedAt()).isNull();
        assertThat(ticket.firstResponseDueAt()).isEqualTo(responseDueAt);
        assertThat(ticket.resolutionDueAt()).isEqualTo(resolutionDueAt);
    }

    @Test
    void onlyTheFirstPublicStaffCommentSetsFirstResponse() {
        var ticket = ticket();
        var first = OPENED.plusSeconds(10);
        assertThat(ticket.recordComment(false, true, first)).isFalse();
        assertThat(ticket.updatedAt()).isEqualTo(OPENED);
        assertThat(ticket.recordComment(true, false, first)).isFalse();
        assertThat(ticket.firstResponseAt()).isNull();
        assertThat(ticket.recordComment(true, true, first)).isTrue();
        assertThat(ticket.recordComment(true, true, first.plusSeconds(10))).isFalse();
        assertThat(ticket.firstResponseAt()).isEqualTo(first);
    }

    @Test
    void closedTicketRejectsEveryMutation() {
        var ticket = ticket();
        ticket.claim(AGENT, OPENED);
        ticket.transitionTo(IN_PROGRESS, OPENED);
        ticket.transitionTo(RESOLVED, OPENED);
        ticket.transitionTo(CLOSED, OPENED);
        assertThatThrownBy(() -> ticket.reopen(OPENED)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> ticket.recordComment(true, true, OPENED)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> ticket.assign(null, OPENED)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> ticket.changePriority(Priority.LOW, OPENED)).isInstanceOf(ApiException.class);
    }

    private static Ticket ticket() {
        return new Ticket("SUP-000001", "Test ticket", "Description", UUID.randomUUID(), OPENED);
    }
}
