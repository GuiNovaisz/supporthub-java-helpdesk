# ADR 001 · Monólito modular

**Status** Aceito

O fluxo de suporte precisa coordenar ticket, comentários e histórico no mesmo commit. Há uma única API e uma única equipe na v0.1.0.

A aplicação é implantada em um processo Spring Boot. Os pacotes representam capacidades do domínio. `TicketService` orquestra os casos de uso e chama `CommentService`, `AuditLog` e `UserService` por interfaces Java de serviço concretas. Os repositories de tickets, comentários, usuários e auditoria ficam internos aos respectivos pacotes. As FKs usam UUIDs e o histórico tem tipo e campos próprios.

Microserviços acrescentariam falhas de rede, versionamento de contratos e coordenação entre bancos para o mesmo fluxo. Uma estrutura por camadas globais deixaria regras de ticket dispersas. A divisão atual conserva o limite transacional do banco e torna os pontos de dependência visíveis. A implantação, o schema e a escala operacional seguem compartilhados.
