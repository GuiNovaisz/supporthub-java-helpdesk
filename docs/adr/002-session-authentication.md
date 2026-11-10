# ADR 002 · Sessão de servidor e CSRF

**Status** Aceito

A API foi projetada para um cliente web de mesma origem. Spring Security mantém a identidade em sessão HTTP e a expõe por um cookie `HttpOnly`, `SameSite=Lax` e `Secure` em HTTPS. A API recebe JSON no login. O controlador usa `AuthenticationManager`, `ChangeSessionIdAuthenticationStrategy`, `CsrfAuthenticationStrategy` e persiste o contexto com `HttpSessionSecurityContextRepository`. O logout é tratado pelo filtro do Spring Security.

O token CSRF fica associado à sessão. O cliente busca o valor mascarado por GET, envia-o no cabeçalho e busca outro após o login. Usuários e senhas são verificados com BCrypt. A conta autenticada é verificada no banco por requisição. Mudanças de ativação incrementam a versão de autenticação, invalidando sessões anteriores.

Um bearer token exigiria decisões adicionais de armazenamento no navegador, renovação e revogação. A sessão local reduz esses requisitos para a implantação inicial. A consequência é que reiniciar o processo invalida sessões. Para múltiplas instâncias será preciso decidir como compartilhar sessões ou manter afinidade, preservando CSRF e revogação.
