# SupportHub

## Português

SupportHub é uma API de help desk corporativo. A milestone **v0.1.0 — Backend Foundation** cobre o fluxo da abertura ao fechamento de um ticket, com autorização por papel e solicitante, SLA e histórico transacional. O caso crítico é a disputa pelo mesmo ticket: dois agentes fazem a tentativa, um assume e o outro recebe HTTP 409.

### Stack e arquitetura

Java 21, Spring Boot 3.5, Spring MVC e Security, JPA/Hibernate, PostgreSQL 17, Flyway, OpenAPI, JUnit, Testcontainers, Maven Wrapper, Docker Compose e GitHub Actions. O monólito modular separa `auth`, `user`, `ticket`, `comment`, `sla`, `audit` e `shared`. O PostgreSQL guarda os dados operacionais e o histórico. A aplicação usa Flyway para migrar o schema e Hibernate para validá-lo.

- **CUSTOMER** abre tickets com prioridade inicial `MEDIUM`, vê e comenta apenas os próprios e pode reabrir um ticket resolvido. As consultas de propriedade incluem a referência e o ID do solicitante.
- **AGENT** vê a fila inteira, assume um ticket livre, comenta publicamente ou em nota interna e altera prioridade e status dos tickets atribuídos a ele.
- **ADMIN** opera a fila, atribui, reatribui e remove agentes e administra a ativação de clientes e agentes. A máquina de estados vale para todos. Apenas contas `AGENT` recebem atribuições.

`OPEN → IN_PROGRESS ↔ WAITING_CUSTOMER`. De `IN_PROGRESS` ou `WAITING_CUSTOMER`, o suporte pode resolver. De `RESOLVED`, o suporte pode fechar ou reabrir, e o solicitante pode reabrir por ação explícita. `CLOSED` é terminal. [Arquitetura, diagramas e regras](docs/architecture.md)

| Prioridade na abertura | Primeira resposta | Resolução |
| --- | ---: | ---: |
| LOW | 24 h | 72 h |
| MEDIUM | 8 h | 48 h |
| HIGH | 4 h | 24 h |
| URGENT | 1 h | 8 h |

A política usa horas corridas UTC e guarda os prazos originais. A primeira resposta é o primeiro comentário público de suporte. Espera pelo cliente e reabertura consomem o prazo original de resolução. O status do SLA é calculado com um `Clock` e os timestamps persistidos. Nesta milestone, a criação sempre usa `MEDIUM`. As demais faixas estão definidas e testadas para futuras políticas de abertura.

### Executar

Requer Docker com Compose v2. Copie `.env.example` para `.env` e escolha senhas locais. Em PowerShell:

```powershell
Copy-Item .env.example .env
docker compose up --build --wait
```

A API responde em `http://127.0.0.1:8080`. Consulte [Swagger UI](http://127.0.0.1:8080/swagger-ui/index.html), [OpenAPI JSON](http://127.0.0.1:8080/v3/api-docs) e [readiness](http://127.0.0.1:8080/actuator/health/readiness). O banco usa volume persistente e rede privada do Compose. `docker compose down` encerra os serviços e preserva o volume.

Para execução direta com um PostgreSQL 17 acessível, configure `DB_URL`, `DB_USER` e `DB_PASSWORD`, selecione um JDK 21 e execute `./mvnw.cmd spring-boot:run` no Windows ou `./mvnw spring-boot:run` em Linux. Em HTTP local, defina `SESSION_COOKIE_SECURE=false` no ambiente do processo. Em HTTPS, mantenha o padrão seguro da aplicação. O bootstrap usa `ADMIN_EMAIL` e `ADMIN_PASSWORD`. Com ambas ausentes, a aplicação inicia sem criar administrador. A senha de bootstrap de uma conta existente permanece a mesma em reinícios.

### API e testes

1. Busque `GET /api/v1/auth/csrf` e preserve o cookie `JSESSIONID`.
2. Envie o token retornado no cabeçalho `X-CSRF-TOKEN` ao registrar ou autenticar. Login usa JSON com `email` e `password`.
3. Busque um novo token após o login e use o mesmo cookie e o token nas mutações, inclusive no logout. Confira a identidade em `GET /api/v1/auth/me`.

As rotas de cliente ficam em `/api/v1/tickets`, as de suporte em `/api/v1/agent/tickets`, e as administrativas em `/api/v1/admin`. As listagens aceitam `page` a partir de 0 e `size` de 1 a 100. Consulte o [contrato de API](docs/architecture.md#api) para filtros e erros.

Execute `./mvnw.cmd -B -ntp clean verify` no Windows ou `./mvnw -B -ntp clean verify` em Linux, com JDK 21 e Docker ativos. A suíte de integração sobe um PostgreSQL descartável e faz chamadas HTTP reais. Os relatórios ficam em `target/surefire-reports` e `target/failsafe-reports`. Para o smoke do Compose, disponibilize as mesmas credenciais de bootstrap no processo PowerShell e execute `./scripts/smoke.ps1`. A CI executa o build, os testes e o smoke em stack nova e guarda os relatórios.

### Roadmap

A v0.1.0 usa sessões locais em uma instância, SLA em horas corridas e fila única. A futura **v0.2.0 — Full Stack Experience** poderá usar React, TypeScript e Vite, com TanStack Query, React Hook Form e Zod. Notificações podem ser avaliadas em uma milestone posterior.

- [Auditoria e evidências](docs/backend-audit.md)
- [Arquitetura e contrato de API](docs/architecture.md)
- [Decisões arquiteturais](docs/adr/)
- [Trilha de estudo](docs/learning/README.md), [guia de entrevista](docs/learning/interview-guide.md) e [exercícios](docs/learning/exercises.md)

The complete English version follows below.

## English

SupportHub is a corporate help desk API. The **v0.1.0 — Backend Foundation** milestone covers tickets from creation to closure, with role and requester authorization, SLA tracking and transactional history. The critical scenario is two agents claiming the same ticket. One claim succeeds and the other returns HTTP 409.

### Stack and architecture

Java 21, Spring Boot 3.5, Spring MVC and Security, JPA/Hibernate, PostgreSQL 17, Flyway, OpenAPI, JUnit, Testcontainers, Maven Wrapper, Docker Compose and GitHub Actions. The modular monolith separates `auth`, `user`, `ticket`, `comment`, `sla`, `audit` and `shared`. PostgreSQL stores operational data and history. Flyway migrates the schema and Hibernate validates it.

- **CUSTOMER** opens `MEDIUM` tickets, reads and comments on their own tickets, and can reopen a resolved ticket. Ownership queries include both the reference and the requester ID.
- **AGENT** sees the entire queue, claims an unassigned ticket, posts public and internal comments, and changes status and priority on tickets assigned to them.
- **ADMIN** operates the queue, assigns, reassigns or removes agents, and manages customer and agent activation. The same state machine applies to every role. Only `AGENT` accounts can receive assignments.

`OPEN → IN_PROGRESS ↔ WAITING_CUSTOMER`. Staff can resolve a ticket from `IN_PROGRESS` or `WAITING_CUSTOMER`. From `RESOLVED`, staff can close or reopen it, and the requester can reopen it through an explicit action. `CLOSED` is terminal. [Architecture, diagrams and domain rules](docs/architecture.md)

| Opening priority | First response | Resolution |
| --- | ---: | ---: |
| LOW | 24 h | 72 h |
| MEDIUM | 8 h | 48 h |
| HIGH | 4 h | 24 h |
| URGENT | 1 h | 8 h |

The policy uses UTC calendar hours and stores the original deadlines. The first public staff comment counts as the first response. Waiting for the customer and reopening both consume the original resolution deadline. The API derives the SLA outcome from an injected `Clock` and persisted timestamps. Ticket creation currently starts at `MEDIUM`. The other policy tiers are defined and tested for future opening policies.

### Run locally

Docker with Compose v2 is required. Copy `.env.example` to `.env` and choose local passwords. In PowerShell:

```powershell
Copy-Item .env.example .env
docker compose up --build --wait
```

The API listens on `http://127.0.0.1:8080`. See [Swagger UI](http://127.0.0.1:8080/swagger-ui/index.html), [OpenAPI JSON](http://127.0.0.1:8080/v3/api-docs) and [readiness](http://127.0.0.1:8080/actuator/health/readiness). The database uses a persistent volume and a private Compose network. `docker compose down` stops the services and preserves the volume.

To run directly against a reachable PostgreSQL 17 instance, set `DB_URL`, `DB_USER` and `DB_PASSWORD`, select a Java 21 JDK and run `./mvnw.cmd spring-boot:run` on Windows or `./mvnw spring-boot:run` on Linux. Set `SESSION_COOKIE_SECURE=false` in the process environment for local HTTP. Keep the application default for HTTPS. Bootstrap uses `ADMIN_EMAIL` and `ADMIN_PASSWORD`. With both absent, startup creates no administrator. Restarting with an existing administrator leaves its password intact.

### API and tests

1. Fetch `GET /api/v1/auth/csrf` and keep the `JSESSIONID` cookie.
2. Send the returned token in the `X-CSRF-TOKEN` header when registering or signing in. Login takes JSON with `email` and `password`.
3. Fetch a fresh token after login and send it with the same cookie on mutations, including logout. Check the current identity at `GET /api/v1/auth/me`.

Customer routes live under `/api/v1/tickets`, support routes under `/api/v1/agent/tickets`, and administrative routes under `/api/v1/admin`. List endpoints accept zero-based `page` and `size` between 1 and 100. See the [API contract](docs/architecture.md#api) for filters and errors.

Run `./mvnw.cmd -B -ntp clean verify` on Windows or `./mvnw -B -ntp clean verify` on Linux with a Java 21 JDK and Docker. Integration tests start disposable PostgreSQL and use real HTTP requests. Reports are stored in `target/surefire-reports` and `target/failsafe-reports`. To smoke-test Compose, set the matching bootstrap credentials in your PowerShell process and run `./scripts/smoke.ps1`. CI builds, runs the tests and smoke-tests a fresh stack. It retains the test reports.

### Roadmap

v0.1.0 uses in-memory sessions on a single instance, calendar-hour SLAs and one support queue. The future **v0.2.0 — Full Stack Experience** may use React, TypeScript and Vite, with TanStack Query, React Hook Form and Zod. Notifications are a possible later milestone.

- [Audit and verification evidence](docs/backend-audit.md)
- [Architecture and API contract](docs/architecture.md)
- [Architecture decisions](docs/adr/)
- [Learning track](docs/learning/README.md), [interview guide](docs/learning/interview-guide.md) and [exercises](docs/learning/exercises.md) in Portuguese

[MIT License](LICENSE)
