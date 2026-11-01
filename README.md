# Horácio

Assistente pessoal do Sr. Nathanael — reconstruído do zero, por etapas.

## Etapa 1 — Interface
Interface monocromática (preto e branco) com vidro fosco e cantos arredondados.
HTML/CSS/JS puros, sem build: basta abrir `index.html` no navegador.

- `index.html` — estrutura
- `styles.css` — visual (tokens de cor, vidro, fontes)
- `app.js` — interações da interface (respostas ainda simuladas)

Fontes: Space Grotesk (títulos), Inter (texto), Instrument Serif (destaques), JetBrains Mono (detalhes técnicos).

## Etapa 2 — Conexão com o Asafe
O Horácio se conecta ao **Asafe** (repositório `companynathanael/Asafe`), o servidor central que liga os agentes da Nathanael Industries.

- `asafe-link.js` — SDK do protocolo Asafe (cópia de `Asafe/sdk/asafe-link.js`)
- `asafe.js` — ponte Horácio ⇄ Asafe: entende pedidos, mostra respostas formatadas e o status no cartão lateral

Na caixa de mensagem:
- `peça ao Miquéias que …`, `@miqueias …` ou `Miquéias, …` — envia o pedido pelo Asafe
- `/agentes` — lista os agentes conectados

Para funcionar, a página do Asafe precisa estar aberta no mesmo navegador (ou o servidor `node server/asafe-server.js` rodando), com as linhas Asafe ⇄ Horácio e Asafe ⇄ Miquéias ligadas.

## Etapa 2.1 — Controle do Miquéias (as "mãos")
O Horácio opera a tela de outro agente pelo Asafe: lê a tela, clica, digita, envia, rola e espera.
Especificação: [`docs/CONTROLE.md`](docs/CONTROLE.md).

- `asafe-controle.js` — entende as ordens e mostra cada operação num cartão com os passos, **Parar** e **Confirmar/Cancelar**
- `integrations/asafe-ui.js` — módulo pronto para o agente controlado (Miquéias) implementar `ui.*`

Exemplos: `Miquéias, leia a tela` · `Miquéias, clique em Nova conversa; digite "Olá" e depois envie; espere a resposta`

## Etapa 2.2 — Habilidades do Miquéias
`asafe-habilidades.js`: pesquisa na web com fontes e Laboratório de Trade (situação, estudo e piloto automático, com dinheiro fictício). O piloto só liga depois de **Confirmar**. Comandos em [`docs/CONTROLE.md`](docs/CONTROLE.md#habilidades-do-miquéias-no-horácio).

## Arquivo único
`python3 tools/build-single.py` gera `dist/horacio.html` com tudo embutido, para abrir com dois cliques no Chrome.
