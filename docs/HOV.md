# HoV 1.0 — núcleo de IA do Horácio

O HoV 1.0 dá ao Horácio um cérebro de verdade: o **Claude**, chamado direto do navegador pelo SDK oficial da Anthropic (`@anthropic-ai/sdk` 0.135.0, empacotado em `vendor/anthropic-sdk.js` por `tools/build-sdk.sh`). Nada de servidor próprio: a página fala só com `api.anthropic.com` e, para o Miquéias, com o Asafe.

## Ligar o núcleo
1. Crie uma chave em **console.anthropic.com** (a API é paga por uso).
2. No Horácio, ⚙ **Configurações** → cole a chave → **Salvar**. O chip do topo mostra `HoV 1.0 · Opus 5.5`.

A chave fica guardada **só neste navegador** (localStorage) e vai apenas para a API do Claude.

## Arquivos
| Arquivo | O que faz |
| --- | --- |
| `hov-nucleo.js` | Consciência (identidade + contexto), laço do agente com streaming e ferramentas, conversas salvas, barra lateral (Conversas · Tarefas · Biblioteca), Configurações, `/consciencia`, resposta automática ao Miquéias (`chat.say`) |
| `hov-ferramentas.js` | Ferramentas: memória, tarefas, documentos e estudos, planilhas `.xlsx`, imagens SVG, vídeos WebM, JavaScript isolado, Asafe/Miquéias |
| `hov-voz.js` | Ditado pelo microfone, **Modo voz** (conversa falada) e fala com voz masculina em português |
| `vendor/anthropic-sdk.js` | SDK oficial da Anthropic para o navegador |

## Configuração da API
- Modelo padrão **Claude Opus 5.5** (`claude-opus-5-5`); opções Sonnet 5.5 e Haiku 5.5.
- Pensamento adaptativo; esforço `low`/`medium`/`high` (Rápido/Equilibrado/Profundo); `display: "updates"` mostra o andamento entre ferramentas.
- `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`) em Opus e Sonnet: se o modelo recusar por segurança, outro modelo do Claude assume.
- Cache do prompt de sistema; o contexto que muda (data, memória, tarefas, agentes) vai num bloco no começo de cada mensagem do Sr. Nathanael, para não invalidar o cache.
- Histórico só cresce no fim (regra do pensamento preservado). Após um fallback no meio da resposta, os blocos internos antes do bloco `fallback` não são reenviados.
- Pesquisa na web pela ferramenta do servidor (`web_search_20260209`; `web_search_20250305` no Haiku).

## O que o Horácio faz
| Pedido | Como |
| --- | --- |
| Conversar, responder, raciocinar | Claude com consciência de contexto |
| “pesquise…” | pesquisa na web (`web_search`) ou, se pedir, pelo Miquéias (`miqueias_pesquisar`) |
| “crie uma planilha…” | `.xlsx` real (abas, cabeçalho, fórmulas em inglês, ex.: `=SUM(B2:B9)`) e `.csv` |
| “faça um plano / projeto / relatório…” | documento Markdown na Biblioteca, baixável em `.md` e `.html` |
| “faça um estudo sobre…” | estudo independente (governo, política, exercício físico, matemática, física, Python, JavaScript…) com pesquisa, contas conferidas, exercícios e fontes |
| “gere uma imagem / logo / diagrama…” | ilustração SVG (limpa de scripts), baixável em `.svg` e `.png` |
| “faça um vídeo / animação…” | motion graphics desenhado em canvas e gravado em `.webm` (até 30 s) |
| “calcule…” | JavaScript num Worker sem rede, com limite de 6 s |
| “crie uma tarefa… / conclua…” | lista de Tarefas na barra lateral |
| “lembre que…” | memória duradoura |
| “peça ao Miquéias…”, trade, ordens | ferramentas do Miquéias pelo Asafe (com as permissões do Asafe e Confirmar para ações protegidas) |

Comandos: `/consciencia` (o que o Horácio sabe agora), `/config`.

## Limites honestos
- **Imagens**: o Claude não gera fotos; o Horácio faz ilustrações vetoriais (SVG).
- **Vídeos**: animações com textos e formas, não filmagem realista.
- **Voz**: usa as vozes do sistema. No Windows/Chrome sai a voz masculina **Microsoft Daniel** (ou **Antonio** no Edge). Se o computador não tiver voz masculina em português, o Horácio usa uma voz disponível com tom mais grave; instale a voz em Configurações do Windows → Hora e idioma → Fala.
- **Python**: o Horácio ensina e escreve Python; para executar cálculos ele usa JavaScript isolado.
- Tudo fica salvo no navegador (conversas, biblioteca, tarefas, memória). Limpar os dados do site apaga tudo.
