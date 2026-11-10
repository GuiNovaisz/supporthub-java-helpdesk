# Auditoria · Backend Foundation

## Status

**READY FOR REVIEW** técnico. A branch pode ser revisada. A integração depende da aprovação do usuário e da disponibilização de `dev` no remoto.

## Repositório e Git

- Repositório público [GuiNovaisz/supporthub-java-helpdesk](https://github.com/GuiNovaisz/supporthub-java-helpdesk) sob [licença MIT](../LICENSE).
- Branch padrão no GitHub e branch de trabalho `feature/backend-foundation`. Upstream `origin/feature/backend-foundation`. `main` e `dev` são branches locais no bootstrap `79ae733`. A publicação foi limitada à feature.
- Commits principais `e49de31` para domínio, API e schema, `e0b9708` para a suíte `05ae761` para Docker e CI e `b4b6571` para portabilidade do smoke. Este relatório pertence ao commit de documentação. O [histórico da branch](https://github.com/GuiNovaisz/supporthub-java-helpdesk/commits/feature/backend-foundation) identifica o HEAD publicado.
- Para verificar árvore limpa e divergência, execute `git status --short --branch` e `git rev-list --left-right --count HEAD...@{upstream}` após atualizar a referência remota.

## Stack

| Componente | Versão verificada |
| --- | --- |
| Java | Temurin 21.0.13+9 |
| Maven e Wrapper | 3.9.16 e 3.3.4 |
| Spring Boot e Spring Security | 3.5.16 e 6.5.11 |
| Hibernate e Flyway | 6.6.53.Final e 11.7.2 |
| PostgreSQL e driver JDBC | 17.11 e 42.7.11 |
| springdoc e Testcontainers | 2.10.0 e 1.21.4 |
| JUnit Jupiter | 5.12.2 |

## Arquitetura e domínio

Monólito modular por feature. `auth` e `user` cuidam de identidade, sessão e gestão de contas. `ticket` coordena workflow, ownership e atribuição. `comment` implementa comentários públicos e internos, `sla` calcula prazos e resultados, `audit` registra eventos, e `shared` define respostas comuns e OpenAPI. A API usa DTOs e referências públicas de ticket. UUIDs internos sustentam as FKs.

Uma conta possui papel, status ativo, versão de autenticação e hash de senha. Um ticket possui solicitante, agente opcional, prioridade, estado e timestamps. Comentários têm autoria da sessão. Cada evento de ticket inclui ator, instante, tipo, valor anterior, novo valor e metadados quando aplicáveis. [Arquitetura e diagramas](architecture.md)

## Workflow e papéis

| Origem | Destinos |
| --- | --- |
| OPEN | IN_PROGRESS, com agente atribuído |
| IN_PROGRESS | WAITING_CUSTOMER ou RESOLVED |
| WAITING_CUSTOMER | IN_PROGRESS ou RESOLVED |
| RESOLVED | IN_PROGRESS por reabertura, ou CLOSED |
| CLOSED | Terminal |

CUSTOMER abre em `MEDIUM`, consulta, comenta publicamente e reabre tickets próprios. AGENT consulta a fila completa, comenta com ambas as visibilidades, assume tickets livres e altera prioridade ou status dos tickets atribuídos a ele. ADMIN opera a fila, atribui e reatribui agentes ativos, remove atribuições e administra a ativação de agentes e clientes. Apenas AGENT pode receber uma atribuição. As transições de domínio também se aplicam ao ADMIN.

## Segurança

Spring Security usa sessão em memória, cookie `HttpOnly`, `SameSite=Lax` e `Secure` por padrão. Login renova sessão e token. Mutações exigem CSRF. Logout invalida a sessão. Mudanças de ativação invalidam sessões antigas pela versão da conta. BCrypt usa custo 12. Bootstrap aceita apenas configuração por ambiente e não promove uma conta preexistente. Cadastro público tem papel fixo e rejeita campos desconhecidos.

Consultas de CUSTOMER restringem referência e requester no PostgreSQL. Alice e Bob foram testados separadamente. Bob recebe 404 em leitura, comentários e reabertura de ticket de Alice. O filtro de visibilidade opera antes da paginação. Rotas administrativas e operacionais aplicam RBAC, e a aplicação exige o responsável ou ADMIN para status e prioridade.

## SLA

| Prioridade na abertura | Primeira resposta | Resolução |
| --- | ---: | ---: |
| LOW | 24 h | 72 h |
| MEDIUM | 8 h | 48 h |
| HIGH | 4 h | 24 h |
| URGENT | 1 h | 8 h |

Os prazos são persistidos na abertura. Mudanças de prioridade conservam o compromisso original. Espera pelo cliente consome horas corridas. O primeiro comentário público do suporte fixa `firstResponseAt` e gera `FIRST_RESPONSE`. Reabertura limpa a conclusão atual de resolução e preserva os dois prazos e a primeira resposta. `Clock` UTC fornece o tempo de referência para `PENDING`, `MET` e `BREACHED`. O teste move o relógio e comprova atrasos de primeira resposta e resolução.

## Concorrência e transações

Foi escolhido `PESSIMISTIC_WRITE` por linha do ticket. A estratégia mantém a decisão sobre atribuição, mudanças concorrentes do ticket e o evento em uma transação. `@Version` detectaria conflitos no flush. Um update condicional é direto para claim isolado e exigiria coordenar SQL e estado JPA nas outras mutações. [ADR de integridade](adr/003-ticket-integrity.md)

O teste lança **2** requisições HTTP com sessões de agentes diferentes e uma barreira. Uma terceira conexão mantém o lock até o PostgreSQL mostrar os dois pedidos aguardando. O teste confirmou **1 HTTP 200**, **1 HTTP 409**, **1 agente persistido** e **1 evento ASSIGNED**, ambos com o UUID do vencedor.

Cada escrita de ticket e seus eventos partilham a mesma transação. O teste de rollback instala um trigger adiado apenas no banco descartável. O trigger detecta `RESOLVED` já gravado na transação e falha no commit. O HTTP devolve 500 genérico. Após o rollback, o ticket está `IN_PROGRESS`, `resolvedAt` está nulo e o histórico é idêntico ao anterior. A resolução funciona depois de remover o trigger de teste.

## Verificação local

Execução de `mvnw.cmd -B -ntp clean verify` em 10/11/2026, com PostgreSQL 17.11 real em Testcontainers.

| Suíte | Casos | Falhas | Erros | Skips |
| --- | ---: | ---: | ---: | ---: |
| Unitária | 14 | 0 | 0 | 0 |
| Integração HTTP | 10 | 0 | 0 | 0 |
| **Total** | **24** | **0** | **0** | **0** |

Segurança, concorrência, rollback, OpenAPI e saúde são cenários da suíte de integração. Os relatórios XML ficam em `target/surefire-reports` e `target/failsafe-reports`.

Flyway aplicou V1 em banco vazio. Hibernate validou o schema. Testes confirmaram a rejeição de atualização, deleção e truncamento do histórico e de um estado de ticket incompatível com seus timestamps. [Migration V1](../src/main/resources/db/migration/V1__backend_foundation.sql)

## Docker

O clean-start usou um volume novo no projeto de auditoria e uma porta de loopback dinâmica. `api` e `db` ficaram saudáveis, Flyway aplicou V1 e o processo de API executou como UID 100. O smoke confirmou readiness UP, OpenAPI e Swagger, login do administrador, criação de agente, cadastro de dois clientes, ticket `SUP-000001`, claim, comentários público e interno, transições, resolução, histórico, isolamento de propriedade e logout. O volume descartável da auditoria foi removido ao final. [Script de smoke](../scripts/smoke.ps1)

## CI

O workflow [Backend CI](../.github/workflows/backend.yml) executa `clean verify` no job **Verify** e clean-start com smoke no job **Container**. A checagem **Dependency Review** roda em PRs públicos para as branches de integração. O YAML do workflow passou em actionlint 1.7.12. A configuração do Dependabot passou na validação de schema e usa `dev` como destino, sujeito à existência dessa branch no GitHub.

A [execução 42825786278](https://github.com/GuiNovaisz/supporthub-java-helpdesk/actions/runs/42825786278), no commit `b4b6571`, aprovou **Verify** e **Container**. O primeiro run detectou que o tipo de sessão do PowerShell ainda não estava carregado no runner Linux. O smoke passou a obter a sessão pelo cmdlet HTTP e foi revalidado localmente e na CI. **Dependency Review** teve o skip esperado de um evento de push. Consulte o [último run da feature](https://github.com/GuiNovaisz/supporthub-java-helpdesk/actions/workflows/backend.yml?query=branch%3Afeature%2Fbackend-foundation) para a evidência do HEAD, incluindo este relatório.

## Auditoria final

### Critical

Nenhum achado impeditivo na implementação ou nas verificações executadas.

### Important

A revisão automática do ambiente bloqueou o push de `main` e `dev` porque a publicação foi delimitada à feature. As duas branches permanecem locais. Antes de integrar via GitHub, a publicação das bases precisa ser autorizada separadamente. Os rulesets ativos [Protect main](https://github.com/GuiNovaisz/supporthub-java-helpdesk/rules/26945680) e [Protect dev](https://github.com/GuiNovaisz/supporthub-java-helpdesk/rules/26945682) já visam as respectivas referências. Ambos exigem Verify e Container e bloqueiam force push. Main também exige PR e protege contra exclusão. Os checks permitem a criação inicial da referência.

### Optional

Sessões compartilhadas para múltiplas instâncias, horários úteis para SLA, limitação de tentativas de login na borda e isolamento de privilégios DDL em implantação são evoluções possíveis da configuração inicial.

## Documentação

[README bilíngue](../README.md), [arquitetura](architecture.md), [ADRs](adr/), [trilha de estudo](learning/README.md), [guia de entrevista](learning/interview-guide.md) e [exercícios](learning/exercises.md).
