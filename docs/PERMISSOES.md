# Permissões do Asafe · v1

O **Horácio** só usa o núcleo de outra IA (Miquéias e as próximas) depois de **pedir permissão ao Asafe**. O Asafe decide, guarda a permissão concedida e pode retirá-la a qualquer momento. Sem permissão, nada sai do núcleo do Horácio.

```
Sr. Nathanael ─► Horácio ── permission.request ──► Asafe   (decide: permitir, perguntar ou bloquear)
                        ◄── { granted } ou erro ───
                Horácio ── request (chat.ask, ui.click, …) ──► Asafe ──► Miquéias
```

## Escopos

Cada ação de outro agente pertence a um escopo. A permissão é dada por **agente + escopo**.

| Escopo | Ações | Descrição para o Sr. Nathanael |
| --- | --- | --- |
| `conversa` | `chat.ask`, `chat.new` | conversar com o agente |
| `pesquisa` | `research.run` | pesquisar na web pelo agente |
| `trade.leitura` | `trade.status`, `trade.study` | ver e estudar o Laboratório de Trade |
| `trade.piloto` | `trade.autopilot` | ligar/desligar o piloto automático (dinheiro fictício) |
| `controle` | `ui.*` | operar a tela do agente (ler, clicar, digitar…) |
| `configuracao` | `settings.*` | mudar configurações do agente |
| `outros` | qualquer outra ação | ação sem escopo conhecido |

Sem permissão: `ping` e `ui.control { on: false }` (desligar o controle **sempre** é permitido), e tudo o que vai para o próprio Asafe (`to: "asafe"`).

## Ações do núcleo (`to: "asafe"`)

| Ação | payload | resposta |
| --- | --- | --- |
| `permission.request` | `{ to, scope, actions: [..], reason }` | `{ granted: true, to, scope, grantId, expiresAt? }` ou erro `denied` |
| `permission.release` | `{ to, scope? }` (sem `scope`: todas daquele agente) | `{ released: n }` |
| `permission.list` | `{}` | `{ grants: [{ to, scope, grantId, expiresAt? }] }` |

- `reason` é o pedido original do Sr. Nathanael (ex.: `Miquéias, clique em Nova conversa`), para o Asafe mostrar.
- Se a regra for **perguntar**, o Asafe segura a resposta até o Sr. Nathanael decidir na interface do Asafe. O Horácio espera até **2 minutos**.
- `expiresAt` (ms) é opcional; sem ele, vale até ser retirada ou o Asafe reiniciar.

## Eventos do Asafe para o Horácio

| Evento | payload | O Horácio faz |
| --- | --- | --- |
| `permission.revoked` | `{ to, scope? }` | esquece a permissão; se for `controle`, para a operação em andamento e desliga o aviso no agente |

## Regras recomendadas para o Asafe

1. O **roteador** deve recusar com o erro `forbidden` qualquer pedido do Horácio para outra IA sem permissão válida daquele escopo. Assim a regra vale mesmo que um agente não peça permissão.
2. Padrão sugerido: `conversa`, `pesquisa` e `trade.leitura` → **permitir**; `controle`, `trade.piloto` e `configuracao` → **perguntar**; `outros` → **perguntar**.
3. A interface do Asafe mostra as permissões ativas e um botão para **retirar** cada uma (envia `permission.revoked`).

## No Horácio

- Antes do primeiro pedido de cada agente + escopo, aparece na conversa um cartão **"Pedido de permissão ao Asafe"** com o estado: aguardando, concedida ou negada.
- Se o Asafe ainda não tiver o sistema de permissões (`unknown_action`), o Horácio **não executa** o pedido (falha fechada).
- Barra lateral, cartão **Núcleos externos**: agentes conectados, permissões ativas (com botão para soltar) e a chave **Operar o Miquéias**. Desligada, o Horácio para a operação atual, desliga o aviso no agente, devolve a permissão de `controle` e recusa novas ordens de tela até ser ligada de novo. A escolha fica salva no navegador.
- Comandos:
  - `pare de operar no Miquéias` · `Horácio, pare de operar o Miquéias` · `/parar` → desliga a chave
  - `volte a operar no Miquéias` · `/operar miqueias` → liga a chave
  - `/permissoes` → lista as permissões ativas
  - `/soltar miqueias` → devolve todas as permissões do Miquéias
