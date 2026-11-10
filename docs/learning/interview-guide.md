# Guia de entrevista

### Por que monólito modular e quando considerar microserviços?

A alteração do ticket e a trilha de auditoria exigem um único commit. Os pacotes de domínio separam responsabilidades em um processo que atende esse requisito com uma transação PostgreSQL. Separar implantações passa a fazer sentido com necessidades comprovadas de autonomia, escala ou isolamento. A separação também exigiria uma estratégia explícita de consistência.

### Por que sessão em vez de JWT?

O cliente web planejado usa cookie de mesma origem. A identidade fica no servidor e logout invalida o contexto imediatamente. A cadeia do Spring implementa a rotação de sessão, a validação de CSRF e a verificação da conta. Um bearer token exigiria uma estratégia própria de armazenamento e revogação.

### Como ownership impede IDOR?

A API usa a referência pública junto com o UUID obtido do principal autenticado. A consulta do cliente retorna apenas um ticket que combine ambos. Bob recebe 404 tanto para o ticket de Alice quanto para uma referência ausente.

### Como comentários internos são protegidos?

A escrita recusa `INTERNAL` para CUSTOMER. A listagem desse papel usa uma consulta com `visibility=PUBLIC`, inclusive na contagem. A nota interna também preserva o `updatedAt` que o cliente enxerga. Apenas o suporte consulta o histórico.

### Por que uma máquina de estados?

`TicketStatus.allows` define o grafo. `Ticket.transitionTo` protege requisitos e timestamps. Iniciar a partir de OPEN exige agente atribuído. Reabrir exige RESOLVED e limpar `resolvedAt`. Aceitar qualquer enum permitiria fechar um ticket recém-aberto e produzir combinações de status e timestamps incompatíveis.

### O que ocorre quando dois agentes disputam um ticket?

O PostgreSQL concede `PESSIMISTIC_WRITE` a uma transação por vez na mesma linha. A vencedora atribui o ticket e confirma o evento. A próxima recebe a linha atualizada e o domínio devolve 409. `@Version` e update condicional eram alternativas. O [ADR 003](../adr/003-ticket-integrity.md) explica os efeitos sobre as demais mutações.

### Como o teste prova sobreposição?

Duas sessões independentes cruzam uma `CyclicBarrier` e fazem HTTP real. Uma conexão terceira segura o lock até `pg_stat_activity` mostrar ambas aguardando. Ao liberar a linha, o teste exige um 200, um 409, um único UUID persistido e um único `ASSIGNED` do vencedor.

### O que é SLA e por que usar Clock?

SLA estabelece um prazo para a primeira resposta e outro para a resolução. `Clock` fornece tempo UTC no servidor e tempo controlado nos testes. A classificação compara timestamps persistidos com o prazo e o instante atual. O prazo inclui o instante exato da entrega.

### O que conta como primeira resposta?

O primeiro comentário público de AGENT ou ADMIN. O ticket está bloqueado quando o serviço observa `firstResponseAt`. Comentário, timestamp e evento `FIRST_RESPONSE` são confirmados juntos.

### O que acontece quando a gravação do histórico falha?

Os eventos e o ticket compartilham a transação. O teste de integração instala um trigger de restrição adiado, que observa `RESOLVED` já escrito dentro da transação e falha na confirmação. Após o HTTP 500, uma nova requisição vê `IN_PROGRESS`, sem timestamp de resolução nem novo evento. A retirada do trigger permite a mesma operação.

### Por que PostgreSQL e Testcontainers?

A garantia envolve locks reais, visibilidade da versão confirmada, trigger de restrição adiado e regras PostgreSQL. Um banco em memória como H2 teria comportamento diferente nessas operações. Testcontainers sobe PostgreSQL descartável com o mesmo motor do Compose e evita depender de dados manuais.

### Como Flyway e Hibernate se complementam?

Flyway cria e versiona as tabelas e restrições. Hibernate valida o mapeamento na inicialização. Uma V1 adotada permanece fixa e alterações futuras entram em novas migrations.

### O que mudaria para múltiplas instâncias?

Compartilharia as sessões ou configuraria afinidade com um plano para falhas de réplica. O PostgreSQL continuaria a arbitrar locks e histórico entre instâncias. Mediria duração das transações e contenção antes de alterar a estratégia de atribuição.
