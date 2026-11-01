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
