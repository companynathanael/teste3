# Controle de interface via Asafe · `ui.*` v1

Permite que o **Horácio** opere a tela de outro agente (primeiro o **Miquéias**) como uma pessoa faria: ler a tela, clicar, digitar, rolar e esperar. Tudo passa pelo Asafe, com o protocolo normal (`request` → `response`). O agente controlado só precisa publicar as ações abaixo.

```
Sr. Nathanael ─► Horácio ──request ui.click──► Asafe ──► Miquéias (clica na própria tela)
                        ◄──────response──────        ◄──
```

Esta é a **etapa 1 (as mãos)**: o Sr. Nathanael dá ordens diretas. Na etapa 2 (o cérebro), o núcleo de IA do Horácio decidirá os passos sozinho usando estas mesmas ações.

## Ações que o agente controlado publica

Todas aceitam o alvo por `ref` (vindo do `ui.snapshot`) **ou** por `name` (texto visível ou rótulo do elemento). A busca por `name` ignora acentos e maiúsculas e prefere: igual > começa com > contém. Empate entre elementos diferentes devolve o erro `ambiguous` com a lista `candidates`.

| Ação | payload | resposta |
| --- | --- | --- |
| `ui.snapshot` | `{}` | `{ app, screen, elements: [{ ref, role, name, value?, state?, protected? }], text? }` |
| `ui.click` | `{ ref?, name?, confirm? }` | `{ done: true, target }` |
| `ui.type` | `{ ref?, name?, text, clear = true, submit = false, confirm? }` | `{ done: true, target }`. Sem `ref`/`name`: a caixa de mensagem principal |
| `ui.key` | `{ key, ref? }` (`Enter`, `Escape`, `Tab`, `ArrowUp`, `ArrowDown`) | `{ done: true }` |
| `ui.scroll` | `{ direction: "up" \| "down" \| "top" \| "bottom", ref? }` | `{ done: true }` |
| `ui.wait` | `{ text?, idle?, timeout = 15000 }`: espera um texto aparecer ou o agente terminar de responder (`idle: true`) | `{ found: true }` ou erro `timeout` |
| `ui.control` | `{ on: true \| false, by: "horacio" }` | `{ on }` |

### `ui.snapshot`
- Só elementos **visíveis**: botões, campos, abas, itens de menu, links, itens do histórico e títulos.
- `role`: `button`, `input`, `textarea`, `tab`, `menuitem`, `link`, `item`, `heading`, `toggle`.
- `ref`: identificador curto (`e1`, `e2`, …) estável enquanto o elemento existir.
- `state`: lista com `disabled`, `selected`, `pressed`, `expanded`, `focused`.
- `text`: resumo curto do que está escrito na tela (ex.: as últimas mensagens), até ~2 000 caracteres.
- **Nunca** devolve o valor de senhas nem da chave de API (`value` vem vazio nesses campos).

### `ui.control`
- `on: true` mostra no agente um aviso fixo **"Horácio está operando"** com o botão **Parar**, e um cursor fantasma que se move até cada elemento antes de clicar ou digitar.
- Se o Sr. Nathanael apertar **Parar**, o agente envia ao Horácio o evento `ui.stopped` e recusa os próximos `ui.*` com o erro `stopped` até receber um novo `ui.control { on: true }`.
- `on: false` remove o aviso.

## Segurança: elementos protegidos

O agente marca como `protected: true` e **recusa sem `confirm: true`** (erro `needs_confirmation`, com `message` explicando o que aconteceria):

- sair da conta (logout);
- apagar conversas ou limpar o histórico;
- campos de senha e da chave de API (ler ou digitar);
- salvar configurações.

O Horácio só reenvia com `confirm: true` depois que o Sr. Nathanael aperta **Confirmar** na própria conversa do Horácio.

## Erros

`not_found`, `ambiguous` (com `candidates: [{ ref, role, name }]`), `disabled`, `needs_confirmation`, `stopped`, `timeout`, `bad_request`.

## No Horácio

O Sr. Nathanael escreve o nome do agente seguido de um verbo de controle. Vários passos podem ser separados por `;` ou `e depois`:

- `Miquéias, leia a tela`
- `Miquéias, clique em Nova conversa`
- `Miquéias, digite "Olá, tudo bem?" e depois envie`
- `@miqueias abra Configurações; role para baixo`
- `Miquéias, espere a resposta`

Verbos reconhecidos: **clique/clica/aperte, abra/abre, digite/digita, envie/enviar, pressione/tecle, role/rola, espere/aguarde, leia/mostre a tela**. Perguntas comuns (`Miquéias, escreva um plano…`) continuam indo para `chat.ask`. Para a digitação usa-se **digite**, e não "escreva".

Cada operação aparece no Horácio como um cartão com os passos (pendente, em andamento, feito ou erro), o botão **Parar** e, quando preciso, **Confirmar/Cancelar**.
