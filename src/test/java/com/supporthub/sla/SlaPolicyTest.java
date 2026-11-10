package com.supporthub.sla;

import com.supporthub.ticket.Priority;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static com.supporthub.sla.SlaPolicy.Outcome.*;
import static org.assertj.core.api.Assertions.assertThat;

class SlaPolicyTest {
    private static final Instant OPENED = Instant.parse("2026-11-10T13:00:00Z");

    @ParameterizedTest
    @CsvSource({"LOW, 24, 72", "MEDIUM, 8, 48", "HIGH, 4, 24", "URGENT, 1, 8"})
    void computesCalendarHourDeadlines(Priority priority, long responseHours, long resolutionHours) {
        var deadlines = SlaPolicy.deadlines(priority, OPENED);
        assertThat(deadlines.firstResponseDueAt()).isEqualTo(OPENED.plus(responseHours, ChronoUnit.HOURS));
        assertThat(deadlines.resolutionDueAt()).isEqualTo(OPENED.plus(resolutionHours, ChronoUnit.HOURS));
    }

    @Test
    void distinguishesPendingMetAndBreachedAtTheBoundary() {
        var due = OPENED.plusSeconds(60);
        assertThat(SlaPolicy.outcome(due, null, due)).isEqualTo(PENDING);
        assertThat(SlaPolicy.outcome(due, null, due.plusNanos(1))).isEqualTo(BREACHED);
        assertThat(SlaPolicy.outcome(due, due, due.plusSeconds(10))).isEqualTo(MET);
        assertThat(SlaPolicy.outcome(due, due.plusNanos(1), due.plusSeconds(10))).isEqualTo(BREACHED);
    }
}
