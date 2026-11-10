package com.supporthub.ticket;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

interface TicketRepository extends JpaRepository<Ticket, UUID>, JpaSpecificationExecutor<Ticket> {
    Optional<Ticket> findByReference(String reference);

    Optional<Ticket> findByReferenceAndRequesterId(String reference, UUID requesterId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from Ticket t where t.reference = :reference")
    Optional<Ticket> lockByReference(String reference);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from Ticket t where t.reference = :reference and t.requesterId = :requesterId")
    Optional<Ticket> lockByReferenceAndRequesterId(String reference, UUID requesterId);

    @Query(value = "select nextval('ticket_reference_seq')", nativeQuery = true)
    long nextReference();
}
