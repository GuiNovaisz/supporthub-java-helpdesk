package com.supporthub.sla;

import com.supporthub.ticket.Priority;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

public final class SlaPolicy {
    private SlaPolicy() {}

    public static Deadlines deadlines(Priority priority, Instant openedAt) {
        return switch (priority) {
            case LOW -> after(openedAt, 24, 72);
            case MEDIUM -> after(openedAt, 8, 48);
            case HIGH -> after(openedAt, 4, 24);
            case URGENT -> after(openedAt, 1, 8);
        };
    }

    private static Deadlines after(Instant openedAt, int responseHours, int resolutionHours) {
        return new Deadlines(openedAt.plus(responseHours, ChronoUnit.HOURS),
                openedAt.plus(resolutionHours, ChronoUnit.HOURS));
    }

    public static Outcome outcome(Instant dueAt, Instant completedAt, Instant now) {
        if (completedAt == null) {
            return now.isAfter(dueAt) ? Outcome.BREACHED : Outcome.PENDING;
        }
        return completedAt.isAfter(dueAt) ? Outcome.BREACHED : Outcome.MET;
    }

    public record Deadlines(Instant firstResponseDueAt, Instant resolutionDueAt) {}
    public enum Outcome { PENDING, MET, BREACHED }
}
