# ADR 003 · Integridade do ticket, histórico e SLA

**Status** Aceito

## Concorrência

| Estratégia | Consequência para SupportHub |
| --- | --- |
| Optimistic locking com `@Version` | A disputa pode ser detectada no flush. Todos os escritores precisariam tratar falha de versão e decidir quando um retry ainda representa a intenção original |
| Update condicional atômico | Excelente para claim isolado. Status, autorizações, primeira resposta e auditoria exigiriam coordenar operações SQL adicionais com o estado JPA |
| Pessimistic write lock | Lê o estado atual, valida invariantes e insere o histórico dentro da mesma transação. Uma disputa pode aumentar o tempo de espera |

Usamos `PESSIMISTIC_WRITE` no ticket para todas as mutações de um ticket existente. A segunda transação verifica o valor que a primeira confirmou e retorna 409. A conta do agente recebe lock antes do ticket quando a operação atribui alguém, serializando a verificação de agente ativo com a desativação. A aplicação mantém as transações curtas e executa validações e persistência local enquanto mantém o lock.

## Histórico

AuditLog usa propagação `MANDATORY`. O evento guarda ID sequencial, ticket, ator, tipo, instante, valor anterior, novo valor e metadados de esquema conhecido. Por exemplo, `REASSIGNED` guarda UUIDs e `REOPENED` inclui a resolução anterior em `metadata`. Comentários são referenciados pelo ID e o histórico guarda o tipo de visibilidade, sem duplicar seu conteúdo. A migration impede alterações, deleções e truncamento de eventos por trigger. Uma falha na inserção ou na confirmação reverte o caso de uso. O modelo cobre trilha operacional por ticket. Um operador com DDL continua capaz de administrar o schema.

## SLA

A prioridade de abertura seleciona durações de horas corridas. A abertura grava os dois prazos no ticket e no evento `SLA_CONFIGURED`. As ações gravam conclusão da primeira resposta e da resolução. A leitura compara esses valores com `Clock` UTC. Essa abordagem dispensa jobs de varredura e conserva o compromisso original após triagem, espera e reabertura. A ausência de um evento de breach é compensada pela classificação derivada na API e pela preservação dos fatos que permitem recalculá-la.
