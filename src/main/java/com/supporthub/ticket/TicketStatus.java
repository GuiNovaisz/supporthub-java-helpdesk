package com.supporthub.ticket;

public enum TicketStatus {
    OPEN, IN_PROGRESS, WAITING_CUSTOMER, RESOLVED, CLOSED;

    boolean allows(TicketStatus next) {
        return switch (this) {
            case OPEN -> next == IN_PROGRESS;
            case IN_PROGRESS -> next == WAITING_CUSTOMER || next == RESOLVED;
            case WAITING_CUSTOMER -> next == IN_PROGRESS || next == RESOLVED;
            case RESOLVED -> next == CLOSED || next == IN_PROGRESS;
            case CLOSED -> false;
        };
    }
}
