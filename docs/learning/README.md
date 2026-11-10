# Trilha de estudo

Use o [fluxo de smoke](../../scripts/smoke.ps1) para conhecer a API e depois acompanhe um caso de uso no código.

| Tema | Onde estudar | O que observar |
| --- | --- | --- |
| POO, encapsulamento e SOLID | [Ticket](../../src/main/java/com/supporthub/ticket/Ticket.java) e [TicketService](../../src/main/java/com/supporthub/ticket/TicketService.java) | A entidade muda seu estado por operações do domínio. O serviço escolhe a consulta, verifica o ator e grava os efeitos. Separar esses motivos de mudança mantém a regra de transição independente de HTTP |
| Interfaces, DI e Spring DI | [TicketRepository](../../src/main/java/com/supporthub/ticket/TicketRepository.java), [SessionAuthentication](../../src/main/java/com/supporthub/auth/SessionAuthentication.java) e [SupportHubApplication](../../src/main/java/com/supporthub/SupportHubApplication.java) | Spring Data implementa a interface de repository. O provider usa o contrato de Spring Security. Dependências entram pelo construtor. O bean `Clock` pode ser substituído em teste |
| Sessão, CSRF e RBAC | [SecurityConfig](../../src/main/java/com/supporthub/auth/SecurityConfig.java), [AuthController](../../src/main/java/com/supporthub/auth/AuthController.java) e [ActiveAccountFilter](../../src/main/java/com/supporthub/auth/ActiveAccountFilter.java) | A cadeia verifica a rota, o token e a conta. Veja onde o login altera a sessão e salva o contexto |
| Ownership e notas internas | [TicketRepository](../../src/main/java/com/supporthub/ticket/TicketRepository.java), [TicketQueries](../../src/main/java/com/supporthub/ticket/TicketQueries.java) e [CommentRepository](../../src/main/java/com/supporthub/comment/CommentRepository.java) | A propriedade do ticket e a visibilidade dos comentários restringem as consultas antes de construir os DTOs |
| Máquina de estados e SLA | [TicketStatus](../../src/main/java/com/supporthub/ticket/TicketStatus.java), [SlaPolicy](../../src/main/java/com/supporthub/sla/SlaPolicy.java) e [TestClock](../../src/test/java/com/supporthub/TestClock.java) | Enum define o grafo. A entidade controla timestamps. O relógio permite avançar 49 horas no teste sem espera real |
| Concorrência e transações | [ADR 003](../adr/003-ticket-integrity.md) e [BackendFoundationIT](../../src/test/java/com/supporthub/BackendFoundationIT.java) | Compare row lock com `@Version` e update condicional. A barreira sincroniza os clientes e o PostgreSQL confirma os dois waits |
| Auditoria, PostgreSQL e Flyway | [AuditLog](../../src/main/java/com/supporthub/audit/AuditLog.java) e [migration V1](../../src/main/resources/db/migration/V1__backend_foundation.sql) | FKs, checks, trigger e `MANDATORY` protegem dados. Um trigger adiado de teste prova rollback em commit |
| Testcontainers, Docker e CI | [BackendFoundationIT](../../src/test/java/com/supporthub/BackendFoundationIT.java), [Dockerfile](../../Dockerfile) e [CI](../../.github/workflows/backend.yml) | Testcontainers fornece a conexão da suíte. Compose valida a implantação e o smoke percorre a API. A CI conserva os relatórios |

Continue com o [guia de entrevista](interview-guide.md) e os [exercícios](exercises.md).
