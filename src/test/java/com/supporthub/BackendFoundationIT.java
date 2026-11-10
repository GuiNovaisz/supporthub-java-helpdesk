package com.supporthub;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.Connection;
import java.sql.SQLException;
import java.time.Duration;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.stream.StreamSupport;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static com.supporthub.TestClock.START;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "server.servlet.session.cookie.secure=false",
        "supporthub.bootstrap.email=admin@example.test",
        "supporthub.bootstrap.password=synthetic-test-password",
        "logging.structured.format.console="
})
@Import(TestClock.class)
@Testcontainers
class BackendFoundationIT {
    private static final String AUTH = "/api/v1/auth";
    private static final String CUSTOMER = "/api/v1/tickets";
    private static final String STAFF = "/api/v1/agent/tickets";
    private static final String ADMIN_TICKETS = "/api/v1/admin/tickets";
    private static final String USERS = "/api/v1/admin/users";
    private static final String PASSWORD = "synthetic-test-password";

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17.11-alpine");

    @LocalServerPort int port;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    @Autowired DataSource database;
    @Autowired TestClock.MutableClock time;

    @BeforeEach
    void resetClock() {
        time.set(START);
    }

    @Test
    void sessionRotatesAndCsrfIsRequiredBeforeAndAfterLogin() throws Exception {
        var client = client();
        var email = email("session");
        var registration = account("Session Customer", email);
        client.send("GET", AUTH + "/me", null).problem(401);
        client.send("POST", AUTH + "/register", registration).problem(403);
        client = client();
        var csrf = client.refreshCsrf();
        var cookie = csrf.response().headers().firstValue("Set-Cookie").orElseThrow();
        assertThat(cookie).contains("HttpOnly", "SameSite=Lax");
        var oldId = client.sessionId();

        var user = client.send("POST", AUTH + "/register", registration).expect(201).body();
        assertThat(user.path("role").asText()).isEqualTo("CUSTOMER");
        assertThat(user.has("passwordHash")).isFalse();
        var hash = jdbc.queryForObject("select password_hash from user_account where email = ?", String.class, email);
        assertThat(hash).startsWith("$2a$12$").doesNotContain(PASSWORD);
        client.send("POST", AUTH + "/register", registration).problem(409);
        client.send("POST", AUTH + "/login", Map.of("email", email, "password", "wrong")).problem(401);
        client.send("POST", AUTH + "/login", Map.of("email", email.toUpperCase(java.util.Locale.ROOT),
                "password", PASSWORD)).expect(204);
        assertThat(client.sessionId()).isNotEqualTo(oldId);
        assertThat(client.send("GET", AUTH + "/me", null).expect(200).body()).isEqualTo(user);
        client.send("POST", AUTH + "/logout", null).problem(403);

        client.refreshCsrf();
        client.send("POST", AUTH + "/logout", null).expect(204);
        client.send("GET", AUTH + "/me", null).problem(401);
    }

    @Test
    void aliceAndBobAreIsolatedAndCannotEscalatePrivileges() throws Exception {
        var alice = customer("alice");
        var bob = customer("bob");
        var ticket = createTicket(alice, "Alice only");
        var reference = ticket.path("reference").asText();
        var path = CUSTOMER + "/" + reference;

        bob.send("GET", path, null).problem(404);
        bob.send("GET", path + "/comments", null).problem(404);
        bob.send("POST", path + "/comments", comment("intrusion", "PUBLIC")).problem(404);
        bob.send("POST", path + "/reopen", null).problem(404);
        assertThat(bob.send("GET", CUSTOMER, null).expect(200).body().path("items").isEmpty()).isTrue();
        alice.send("POST", path + "/comments", comment("private note", "INTERNAL")).problem(403);
        alice.send("GET", STAFF, null).problem(403);
        alice.send("GET", STAFF + "/" + reference + "/history", null).problem(403);
        alice.send("POST", USERS + "/agents", account("Fake Agent", email("fake"))).problem(403);
        alice.send("PUT", ADMIN_TICKETS + "/" + reference + "/assignment",
                Map.of("agentId", UUID.randomUUID())).problem(403);
        alice.send("POST", AUTH + "/register", Map.of("name", "Intruder", "email", email("role"),
                "password", PASSWORD, "role", "ADMIN")).problem(400);
        alice.send("POST", CUSTOMER, Map.of("title", "Impersonated", "description", "Attempt",
                "requesterId", UUID.randomUUID())).problem(400);
    }

    @Test
    void adminCanManageAgentsAndDeactivationRevokesAnExistingSession() throws Exception {
        var admin = admin();
        var agent = agent(admin, "revocable");
        var staleSession = client();
        staleSession.signIn(agent.email(), PASSWORD);
        agent.session().send("GET", STAFF, null).expect(200);
        agent.session().send("PATCH", USERS + "/" + agent.id() + "/status", Map.of("active", true)).problem(403);
        agent.session().send("POST", USERS + "/agents", account("Other Agent", email("forbidden"))).problem(403);
        admin.send("GET", USERS, null).expect(200);

        admin.send("PATCH", USERS + "/" + agent.id() + "/status", Map.of("active", false)).expect(200);
        agent.session().send("GET", STAFF, null).problem(401);
        var rejectedLogin = client();
        rejectedLogin.refreshCsrf();
        rejectedLogin.send("POST", AUTH + "/login", Map.of("email", agent.email(), "password", PASSWORD)).problem(401);

        admin.send("PATCH", USERS + "/" + agent.id() + "/status", Map.of("active", true)).expect(200);
        agent.session().send("GET", STAFF, null).problem(401);
        staleSession.send("GET", STAFF, null).problem(401);
        agent.session().signIn(agent.email(), PASSWORD);
        agent.session().send("GET", STAFF, null).expect(200);
        var adminId = admin.send("GET", AUTH + "/me", null).expect(200).body().path("id").asText();
        admin.send("PATCH", USERS + "/" + adminId + "/status", Map.of("active", false)).problem(403);
    }

    @Test
    void assignmentReassignmentAndLifecycleRespectRoleAndState() throws Exception {
        var admin = admin();
        var agent = agent(admin, "owner");
        var other = agent(admin, "replacement");
        var customer = customer("lifecycle");
        var created = createTicket(customer, "Lifecycle");
        var reference = created.path("reference").asText();
        var path = STAFF + "/" + reference;
        var assignment = ADMIN_TICKETS + "/" + reference + "/assignment";

        assertThat(reference).matches("SUP-[0-9]{6,19}");
        assertThat(created.path("status").asText()).isEqualTo("OPEN");
        assertThat(created.path("priority").asText()).isEqualTo("MEDIUM");
        assertThat(created.path("assignedAgentId").isNull()).isTrue();
        status(admin, path, "IN_PROGRESS", 409);
        admin.send("POST", path + "/claim", null).problem(403);
        admin.send("PUT", assignment, Map.of("agentId", created.path("requesterId").asText())).problem(422);
        agent.session().send("POST", path + "/claim", null).expect(200);
        other.session().send("POST", path + "/claim", null).problem(409);
        status(other.session(), path, "IN_PROGRESS", 403);

        admin.send("DELETE", assignment, null).expect(200);
        admin.send("PUT", assignment, Map.of("agentId", agent.id())).expect(200);
        var reassigned = admin.send("PUT", assignment, Map.of("agentId", other.id())).expect(200).body();
        assertThat(reassigned.path("assignedAgentId").asText()).isEqualTo(other.id());
        var priority = other.session().send("PATCH", path + "/priority", Map.of("priority", "HIGH")).expect(200);
        assertThat(priority.body().path("priority").asText()).isEqualTo("HIGH");
        assertThat(priority.body().path("sla")).isEqualTo(created.path("sla"));

        status(other.session(), path, "RESOLVED", 409);
        status(other.session(), path, "IN_PROGRESS", 200);
        status(other.session(), path, "WAITING_CUSTOMER", 200);
        status(other.session(), path, "IN_PROGRESS", 200);
        time.set(START.plus(Duration.ofHours(6)));
        var resolved = status(other.session(), path, "RESOLVED", 200).body();
        assertThat(resolved.at("/sla/resolutionStatus").asText()).isEqualTo("MET");
        assertThat(customer.send("POST", CUSTOMER + "/" + reference + "/reopen", null).expect(200)
                .body().at("/sla/resolvedAt").isNull()).isTrue();
        customer.send("POST", CUSTOMER + "/" + reference + "/reopen", null).problem(409);
        status(admin, path, "RESOLVED", 200);
        var closed = status(admin, path, "CLOSED", 200).body();
        assertThat(closed.path("closedAt").asText()).isEqualTo(time.instant().toString());
        status(admin, path, "IN_PROGRESS", 409);
        admin.send("POST", path + "/comments", comment("Too late", "PUBLIC")).problem(409);

        var history = admin.send("GET", path + "/history", null).expect(200).body().path("items");
        assertThat(values(history, "type")).containsExactly(
                "CREATED", "SLA_CONFIGURED", "ASSIGNED", "UNASSIGNED", "ASSIGNED", "REASSIGNED",
                "PRIORITY_CHANGED", "STATUS_CHANGED", "STATUS_CHANGED", "STATUS_CHANGED",
                "RESOLVED", "REOPENED", "RESOLVED", "CLOSED");
        assertThat(history.get(5).path("previousValue").asText()).isEqualTo(agent.id());
        assertThat(history.get(5).path("newValue").asText()).isEqualTo(other.id());
        assertThat(history.get(11).path("actorId").asText()).isEqualTo(created.path("requesterId").asText());
    }

    @Test
    void internalNotesAreHiddenAndOnlyFirstPublicStaffReplyCounts() throws Exception {
        var admin = admin();
        var agent = agent(admin, "replies");
        var customer = customer("comments");
        var ticket = createTicket(customer, "Reply timing");
        var reference = ticket.path("reference").asText();
        var path = STAFF + "/" + reference;
        assertThat(ticket.at("/sla/firstResponseStatus").asText()).isEqualTo("PENDING");
        assertThat(ticket.at("/sla/firstResponseDueAt").asText()).isEqualTo(START.plus(Duration.ofHours(8)).toString());
        assertThat(ticket.at("/sla/resolutionDueAt").asText()).isEqualTo(START.plus(Duration.ofHours(48)).toString());

        time.set(START.plus(Duration.ofHours(1)));
        agent.session().send("POST", path + "/comments", comment("staff-only investigation", "INTERNAL")).expect(201);
        assertThat(customer.send("GET", CUSTOMER + "/" + reference, null).expect(200).body()).isEqualTo(ticket);
        customer.send("POST", CUSTOMER + "/" + reference + "/comments", comment("customer message", "PUBLIC")).expect(201);
        time.set(START.plus(Duration.ofHours(9)));
        var overdue = customer.send("GET", CUSTOMER + "/" + reference, null).expect(200).body();
        assertThat(overdue.at("/sla/firstResponseAt").isNull()).isTrue();
        assertThat(overdue.at("/sla/firstResponseStatus").asText()).isEqualTo("BREACHED");

        var firstResponse = time.instant();
        agent.session().send("POST", path + "/comments", comment("first staff reply", "PUBLIC")).expect(201);
        time.set(START.plus(Duration.ofHours(10)));
        admin.send("POST", path + "/comments", comment("second staff reply", "PUBLIC")).expect(201);
        var detail = customer.send("GET", CUSTOMER + "/" + reference, null).expect(200).body();
        assertThat(detail.at("/sla/firstResponseAt").asText()).isEqualTo(firstResponse.toString());
        assertThat(detail.at("/sla/firstResponseStatus").asText()).isEqualTo("BREACHED");

        var publicList = customer.send("GET", CUSTOMER + "/" + reference + "/comments", null).expect(200).body();
        assertThat(publicList.path("totalElements").asInt()).isEqualTo(3);
        assertThat(values(publicList.path("items"), "visibility")).containsOnly("PUBLIC");
        assertThat(publicList.toString()).doesNotContain("staff-only investigation", "INTERNAL");
        var staffList = admin.send("GET", path + "/comments", null).expect(200).body();
        assertThat(staffList.path("totalElements").asInt()).isEqualTo(4);
        assertThat(values(staffList.path("items"), "visibility")).contains("INTERNAL");
        var history = admin.send("GET", path + "/history", null).expect(200).body().path("items");
        assertThat(values(history, "type")).containsExactly("CREATED", "SLA_CONFIGURED", "INTERNAL_COMMENT",
                "PUBLIC_COMMENT", "PUBLIC_COMMENT", "FIRST_RESPONSE", "PUBLIC_COMMENT");

        agent.session().send("POST", path + "/claim", null).expect(200);
        status(agent.session(), path, "IN_PROGRESS", 200);
        status(agent.session(), path, "WAITING_CUSTOMER", 200);
        time.set(START.plus(Duration.ofHours(49)));
        var lateResolution = status(agent.session(), path, "RESOLVED", 200).body();
        assertThat(lateResolution.at("/sla/resolutionStatus").asText()).isEqualTo("BREACHED");
    }

    @Test
    void queueAndCustomerListsFilterAndPageWithWhitelistedSorting() throws Exception {
        var customer = customer("paging");
        var admin = admin();
        var first = createTicket(customer, "First");
        time.set(START.plus(Duration.ofHours(9)));
        var second = createTicket(customer, "Second");
        var requester = first.path("requesterId").asText();
        createTicket(customer("another-owner"), "Not in this queue");
        var result = customer.send("GET", CUSTOMER + "?status=OPEN&priority=MEDIUM&size=1&page=1",
                null).expect(200).body();
        assertThat(result.path("totalElements").asInt()).isEqualTo(2);
        assertThat(result.at("/items/0/reference").asText()).isEqualTo(first.path("reference").asText());
        var operational = STAFF + "?requesterId=" + requester + "&assigned=false&firstResponseSla=";
        var breached = admin.send("GET", operational + "BREACHED", null).expect(200).body();
        var pending = admin.send("GET", operational + "PENDING", null).expect(200).body();
        assertThat(values(breached.path("items"), "reference")).containsExactly(first.path("reference").asText());
        assertThat(values(pending.path("items"), "reference")).containsExactly(second.path("reference").asText());
        customer.send("GET", CUSTOMER + "?sort=passwordHash", null).problem(400);
        customer.send("GET", CUSTOMER + "?size=101", null).problem(422);
        customer.send("GET", CUSTOMER + "?page=-1", null).problem(422);
        customer.send("POST", CUSTOMER, Map.of("title", " ", "description", "")).problem(422);
    }

    @Test
    void concurrentHttpClaimsHaveOneWinnerAndOnePersistedAssignmentEvent() throws Exception {
        var admin = admin();
        var agentA = agent(admin, "claim-a");
        var agentB = agent(admin, "claim-b");
        var ticket = createTicket(customer("concurrent"), "Concurrent claim");
        var reference = ticket.path("reference").asText();
        assertThat(ticket.path("assignedAgentId").isNull()).isTrue();
        var endpoint = STAFF + "/" + reference + "/claim";
        var gate = new CyclicBarrier(3);

        try (var pool = Executors.newFixedThreadPool(2); var held = database.getConnection()) {
            lockTicket(held, reference);
            var a = pool.submit(() -> {
                gate.await(5, TimeUnit.SECONDS);
                return agentA.session().send("POST", endpoint, null);
            });
            var b = pool.submit(() -> {
                gate.await(5, TimeUnit.SECONDS);
                return agentB.session().send("POST", endpoint, null);
            });
            try {
                gate.await(5, TimeUnit.SECONDS);
                awaitBothClaimsBlockedInPostgres();
            } finally {
                held.rollback();
            }
            var left = a.get(15, TimeUnit.SECONDS);
            var right = b.get(15, TimeUnit.SECONDS);
            assertThat(java.util.List.of(left.status(), right.status())).containsExactlyInAnyOrder(200, 409);

            String winner = left.status() == 200 ? agentA.id() : agentB.id();
            var winnerResponse = left.status() == 200 ? left : right;
            assertThat(winnerResponse.body().path("assignedAgentId").asText()).isEqualTo(winner);
            var persisted = jdbc.queryForList("select assigned_agent_id::text from ticket where reference = ?",
                    String.class, reference);
            assertThat(persisted).containsExactly(winner);
            assertThat(jdbc.queryForList("""
                    select e.new_value from ticket_event e join ticket t on t.id = e.ticket_id
                    where t.reference = ? and e.event_type = 'ASSIGNED'
                    """, String.class, reference)).containsExactly(winner);
        }
    }

    @Test
    void deferredAuditFailureRollsBackAnAlreadyFlushedResolution() throws Exception {
        var admin = admin();
        var agent = agent(admin, "rollback");
        var reference = createTicket(customer("rollback"), "Atomic resolution").path("reference").asText();
        var path = STAFF + "/" + reference;
        agent.session().send("POST", path + "/claim", null).expect(200);
        status(agent.session(), path, "IN_PROGRESS", 200);
        var id = jdbc.queryForObject("select id from ticket where reference = ?", UUID.class, reference);
        var before = admin.send("GET", path + "/history", null).expect(200).body();
        jdbc.execute("""
                create function test_reject_resolution_audit() returns trigger language plpgsql as $$
                begin
                    if exists (select 1 from ticket where id = new.ticket_id and status = 'RESOLVED') then
                        raise exception 'test injected audit failure' using errcode = '23514';
                    end if;
                    return null;
                end;
                $$
                """);
        try {
            jdbc.execute("""
                    create constraint trigger test_resolution_audit
                    after insert on ticket_event deferrable initially deferred
                    for each row when (new.ticket_id = '%s'::uuid and new.event_type = 'RESOLVED')
                    execute function test_reject_resolution_audit()
                    """.formatted(id));
            var result = status(agent.session(), path, "RESOLVED", 500).problem(500);
            assertThat(result.body().toString()).doesNotContain("ticket_event", "23514", "test injected");
            var persisted = admin.send("GET", path, null).expect(200).body();
            assertThat(persisted.path("status").asText()).isEqualTo("IN_PROGRESS");
            assertThat(persisted.at("/sla/resolvedAt").isNull()).isTrue();
            assertThat(admin.send("GET", path + "/history", null).expect(200).body()).isEqualTo(before);
        } finally {
            jdbc.execute("drop trigger if exists test_resolution_audit on ticket_event");
            jdbc.execute("drop function test_reject_resolution_audit()");
        }
        status(agent.session(), path, "RESOLVED", 200);
    }

    @Test
    void databaseEnforcesAppendOnlyHistoryAndValidTicketState() throws Exception {
        var reference = createTicket(customer("immutable"), "Immutable events").path("reference").asText();
        var ticketId = jdbc.queryForObject("select id from ticket where reference = ?", UUID.class, reference);
        assertThatThrownBy(() -> jdbc.update("update ticket_event set metadata = null where ticket_id = ?", ticketId))
                .isInstanceOf(DataAccessException.class);
        assertThatThrownBy(() -> jdbc.update("delete from ticket_event where ticket_id = ?", ticketId))
                .isInstanceOf(DataAccessException.class);
        assertThatThrownBy(() -> jdbc.execute("truncate ticket_event")).isInstanceOf(DataAccessException.class);
        assertThatThrownBy(() -> jdbc.update("update ticket set status = 'RESOLVED' where id = ?", ticketId))
                .isInstanceOf(DataAccessException.class);
        assertThat(jdbc.queryForObject("select count(*) from ticket_event where ticket_id = ?", Integer.class, ticketId))
                .isEqualTo(2);
    }

    @Test
    void healthAndOpenApiExposeTheExpectedContract() throws Exception {
        var client = client();
        assertThat(client.send("GET", "/actuator/health", null).expect(200).body().path("status").asText())
                .isEqualTo("UP");
        var api = client.send("GET", "/v3/api-docs", null).expect(200).body();
        var login = api.at("/paths/~1api~1v1~1auth~1login/post");
        assertThat(login.at("/responses/204").isMissingNode()).isFalse();
        assertThat(values(login.path("parameters"), "name")).contains("X-CSRF-TOKEN");
        assertThat(api.at("/components/securitySchemes/session/name").asText()).isEqualTo("JSESSIONID");
        assertThat(api.at("/paths/~1api~1v1~1tickets/post/responses/201").isMissingNode()).isFalse();
    }

    private static void lockTicket(Connection connection, String reference) throws SQLException {
        connection.setAutoCommit(false);
        try (var query = connection.prepareStatement("select id from ticket where reference = ? for update")) {
            query.setString(1, reference);
            try (var rows = query.executeQuery()) {
                assertThat(rows.next()).isTrue();
            }
        }
    }

    private void awaitBothClaimsBlockedInPostgres() throws InterruptedException {
        long deadline = System.nanoTime() + Duration.ofSeconds(12).toNanos();
        while (System.nanoTime() < deadline) {
            Integer blocked = jdbc.queryForObject("""
                    select count(*) from pg_stat_activity
                    where datname = current_database() and wait_event_type = 'Lock'
                      and lower(query) like '%from ticket%' and lower(query) like '%for%update%'
                    """, Integer.class);
            if (blocked != null && blocked == 2) {
                return;
            }
            Thread.sleep(50);
        }
        fail("Both HTTP claims must reach PostgreSQL and wait on the same ticket lock.");
    }

    private HttpSessionClient client() {
        return new HttpSessionClient(port, json);
    }

    private HttpSessionClient admin() throws Exception {
        var session = client();
        session.signIn("admin@example.test", PASSWORD);
        return session;
    }

    private HttpSessionClient customer(String label) throws Exception {
        var session = client();
        var email = email(label);
        session.refreshCsrf();
        session.send("POST", AUTH + "/register", account(label, email)).expect(201);
        session.signIn(email, PASSWORD);
        return session;
    }

    private Agent agent(HttpSessionClient admin, String label) throws Exception {
        var email = email(label);
        var created = admin.send("POST", USERS + "/agents", account(label, email)).expect(201).body();
        var session = client();
        session.signIn(email, PASSWORD);
        return new Agent(created.path("id").asText(), email, session);
    }

    private JsonNode createTicket(HttpSessionClient session, String title) throws Exception {
        var result = session.send("POST", CUSTOMER, Map.of("title", title, "description", "Customer context")).expect(201);
        assertThat(result.response().headers().firstValue("Location"))
                .hasValue(CUSTOMER + "/" + result.body().path("reference").asText());
        return result.body();
    }

    private static HttpSessionClient.Reply status(HttpSessionClient session, String path, String status, int expected)
            throws Exception {
        return session.send("PATCH", path + "/status", Map.of("status", status)).expect(expected);
    }

    private static Map<String, String> comment(String body, String visibility) {
        return Map.of("body", body, "visibility", visibility);
    }

    private static Map<String, String> account(String name, String email) {
        return Map.of("name", name, "email", email, "password", PASSWORD);
    }

    private static String email(String label) {
        return label + "-" + UUID.randomUUID() + "@example.test";
    }

    private static java.util.List<String> values(JsonNode items, String field) {
        return StreamSupport.stream(items.spliterator(), false).map(item -> item.path(field).asText()).toList();
    }

    private record Agent(String id, String email, HttpSessionClient session) {}
}
