# Exercícios

Use uma branch de estudo separada. Execute cada experimento contra uma instância descartável.

## Básico

1. Modele os cinco valores de `TicketStatus`. Desenhe o grafo e escreva um teste que enumere as 25 combinações de origem e destino.
2. Implemente `Priority` e calcule dois `Instant` a partir da tabela de SLA. Teste os quatro pares de duração.
3. Use `Clock.fixed` para exercitar o instante anterior, o limite exato e o instante posterior ao vencimento. Defina o resultado para prazo com e sem conclusão.

## Intermediário

4. Implemente a busca de ticket pelo par referência e solicitante. Com Alice e Bob, comprove que leitura e escrita retornam 404 quando o ticket pertence à outra pessoa.
5. Adicione comentário público e interno com autoria da sessão. Valide o conteúdo e compare o total retornado para suporte e para cliente.
6. Defina a primeira resposta quando um agente comentar publicamente. Envie duas respostas, uma nota interna e uma mensagem do cliente. Verifique o timestamp e a contagem de eventos.
7. Reabra um ticket resolvido. Compare o SLA antes e depois e explique quais dados precisam sobreviver no histórico.

## Avançado

8. Explique o limite da transação de resolução. Instale uma falha adiada no evento apenas no ambiente de teste e prove que o estado original sobrevive.
9. Faça dois clientes disputarem o mesmo ticket. Sincronize a largada, observe os waits e compare HTTP, banco e histórico.
10. Em um experimento separado, tente substituir o lock do claim por um update condicional. Identifique as condições adicionais necessárias para impedir atribuição fora do workflow e para manter a auditoria atômica.
