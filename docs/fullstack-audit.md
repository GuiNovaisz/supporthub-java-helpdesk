# Auditoria Full Stack Experience

## Versão e escopo

`feature/fullstack-experience` parte do commit `1730d42848fa0623451abfdaafc527150157497b` de `dev`, publicado como v0.1.0. Maven e npm identificam a feature como `0.2.0-dev`. As alterações Spring limitam-se aos metadados de versão e milestone. Java 21, Spring Boot 3.5.16, Spring Security 6.5, PostgreSQL 17 e o contrato HTTP foram preservados.

## Arquitetura e papéis

React e TypeScript organizam a UI em `app`, `auth`, `tickets`, `comments`, `sla`, `users`, `shared` e `api`. React Router delimita as áreas, TanStack Query controla leituras e invalidação, e React Hook Form com Zod valida os formulários. No Compose, o navegador acessa o Nginx sem privilégios. O proxy encaminha a API Spring na mesma origem. A API e o PostgreSQL estão na rede privada da stack.

| Papel | Fluxos verificados |
| --- | --- |
| CUSTOMER | Cadastro, login, logout, identidade, criação, listagem e detalhe dos próprios tickets, comentários públicos, SLA e reabertura |
| AGENT | Fila, filtros, claim, prioridade, transições, resolução, resposta pública, nota interna e auditoria |
| ADMIN | Fila, histórico, criação de agente, ativação e desativação, atribuição, reatribuição e remoção |

Filtros, ordenação e páginas usam os parâmetros da API. O cliente recebe uma linha do tempo construída a partir de marcos públicos. O suporte usa o endpoint de auditoria append-only. A seleção administrativa de responsáveis usa as páginas do diretório e mostra somente agentes ativos.

## Segurança

- A identidade vem de `GET /api/v1/auth/me`. As mutações usam `credentials: include` e obtêm CSRF imediatamente antes do envio. Um novo login ou logout pode trocar o cookie. Cada mutação subsequente busca o token para a sessão atual. Nenhuma escrita é repetida automaticamente.
- O Spring mantém o cookie `HttpOnly`, `SameSite=Lax`, `Secure` configurável, BCrypt, rotação de sessão e invalidação por `auth_version`. A UI delimita rotas por papel. A API continua aplicando RBAC, ownership, IDOR e visibilidade.
- As chaves de query de dados incluem a identidade. O cache de dados autenticados é descartado em login, logout e sessão expirada. A única gravação persistente do frontend é a preferência de tema.
- O Nginx entrega CSP para o app, proteção contra enquadramento, `nosniff`, política de referência e de permissões. O HTML usa `no-store`. A API continua usando os cabeçalhos Spring. O Swagger permanece acessível pelo proxy.
- A auditoria usa volumes e credenciais descartáveis. O navegador roda em contexto isolado. O E2E conserva apenas o relatório JUnit na CI. A galeria usa contas sintéticas e telas sem campos de senha preenchidos.

## SLA e concorrência

A interface mostra os prazos persistidos e os resultados `PENDING`, `MET` e `BREACHED`. A política por prioridade de abertura permanece em 24 h/72 h, 8 h/48 h, 4 h/24 h e 1 h/8 h. Mudança de prioridade, espera pelo cliente e reabertura preservam os prazos. A primeira resposta continua sendo o primeiro comentário público de suporte.

O teste Java `concurrentHttpClaimsHaveOneWinnerAndOnePersistedAssignmentEvent` sincroniza dois clientes HTTP e observa ambos aguardando o lock PostgreSQL sobre o mesmo ticket. Resultado verificado: **1 HTTP 200, 1 HTTP 409, 1 responsável persistido e 1 evento ASSIGNED**, com o mesmo UUID vencedor nos dois registros. O `PESSIMISTIC_WRITE` permanece no backend. O E2E usa um claim real vencedor enquanto outra sessão mantém a tela anterior, verifica o 409 e exige que a UI busque o responsável correto. O teste Java continua sendo a prova de simultaneidade.

O teste `deferredAuditFailureRollsBackAnAlreadyFlushedResolution` injeta uma falha no commit. O ticket permanece em `IN_PROGRESS`, com o histórico anterior e sem timestamp de resolução. A edição de eventos continua bloqueada.

## Verificações

| Suíte | Aprovados | Falhas | Erros | Skips | Retries |
| --- | ---: | ---: | ---: | ---: | ---: |
| Backend unitário | 14 | 0 | 0 | 0 | 0 |
| Backend HTTP com PostgreSQL/Testcontainers | 10 | 0 | 0 | 0 | 0 |
| Vitest e Testing Library | 10 | 0 | 0 | 0 | 0 |
| Playwright em Compose real | 4 | 0 | 0 | 0 | 0 |

O backend passou em `mvnw.cmd -B -ntp clean verify`. O frontend passou em Prettier, ESLint, TypeScript, Vitest, build Vite e npm audit. O audit passou com zero vulnerabilidades após restringir a versão transitiva do minimatch a 11.0.1 no tooling de lint. O lockfile é usado por `npm ci`.

O clean-start criou um volume PostgreSQL novo. Flyway aplicou V1, os três serviços ficaram saudáveis e o Nginx executou como UID 101. O smoke validou health, Swagger, OpenAPI, SLA, histórico, ownership e logout por meio do proxy. O [workflow SupportHub CI](../.github/workflows/backend.yml) mantém **Verify** e **Container**. Container executa smoke e E2E, **Frontend** valida os checks npm, e **Dependency Review** se aplica a PRs públicos.

## Auditoria visual

A [galeria](screenshots/README.md) usa Chromium headless na stack real. Foram inspecionados desktop 1440×960, laptop 1280×900, tablet 820×1180 e mobile 390×844, com os temas claro e escuro. O Playwright verifica overflow de página e axe-core cobre login, tickets, fila, workspace e administração, incluindo a confirmação de desativação.

A revisão corrigiu a quebra do cabeçalho Permissions-Policy causada pelo formatador, a fonte que o build embutia como data URI e a visibilidade inconsistente das colunas de data em viewports intermediários. A página de login recebeu um título principal visível também no mobile. A revisão também ampliou os filtros no tablet, ajustou a continuidade da barra lateral e verificou por teclado o atalho de salto para o conteúdo. Asserções de navegador confirmam a ausência de erros de CSP e Permissions-Policy no fluxo do cliente.

## Achados

- **Critical** — Nenhum em aberto.
- **Important** — Nenhum em aberto.
- **Optional** — A implantação inicial usa sessão em memória, fila única e SLA em horas corridas. A baseline continua deixando sessões compartilhadas, horários úteis, limitação de login na borda e maior isolamento DDL para uma etapa posterior.
