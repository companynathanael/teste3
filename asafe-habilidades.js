// HORÁCIO ⇄ ASAFE — habilidades do Miquéias: pesquisa na web e Laboratório de Trade.
// Ações do Miquéias: research.run, trade.status, trade.study, trade.autopilot
// (companynathanael/miqu-ias, commit 5785866). O trade usa dinheiro fictício.

(function () {
  const H = window.horacioAsafe;
  if (!H) return;
  const { link, norm, md, showAgent } = H;
  const AGENT = "miqueias";

  /* ---------- entender o pedido ---------- */
  const STRATS = [
    { id: "cruzamento", re: /\b(cruzamento|medias?|ema)\b/ },
    { id: "rsi", re: /\brsi\b/ },
    { id: "rompimento", re: /\b(rompimento|canal|donchian)\b/ },
  ];
  const SYMBOLS = [
    { id: "BTCUSDT", re: /\b(btc|bitcoin)\b/ },
    { id: "ETHUSDT", re: /\b(eth|ethereum|ether)\b/ },
    { id: "SOLUSDT", re: /\b(sol|solana)\b/ },
  ];

  /** Tira o endereçamento ao Miquéias. Devolve o resto do pedido ou null. */
  function addressed(t) {
    const m = t.match(/^(?:horacio[\s,]+)?(?:por favor[\s,]+)?(?:@miqueias[\s,:]+|miqueias\s*[,:]\s*|(?:peca|pede|pedir|diga|diz|mande|manda|solicite|solicita)\s+(?:ao|a|para o|pro|pra)\s+miqueias\s+(?:que\s+|para\s+|pra\s+)?)/);
    return m ? t.slice(m[0].length).replace(/^por favor[\s,]+/, "") : null;
  }

  function parse(text) {
    const raw = text.trim();
    const t = norm(raw);
    let m;
    // atalhos
    if ((m = t.match(/^\/pesquisa\s+([\s\S]+)$/))) return { kind: "research", query: raw.replace(/^\/pesquisa\s+/i, "").trim() };
    if (/^\/trade$/.test(t)) return { kind: "status" };
    if (/^\/estudo$/.test(t)) return { kind: "study" };
    if ((m = t.match(/^\/piloto\s+(on|off|ligar|desligar)\b([\s\S]*)$/))) return autopilot(/on|ligar/.test(m[1]), m[2]);

    const rest = addressed(t);
    if (rest === null) return null;
    // pesquisa: mantém o texto original (com acentos) da consulta
    m = rest.match(/^(?:pesquise|pesquisa|pesquisar|busque|busca|buscar|procure|procura|procurar)(?:\s+(?:na\s+web|na\s+internet|no\s+google|online))?(?:\s+(?:sobre|por|a respeito de))?\s+([\s\S]+)$/);
    if (m) return { kind: "research", query: raw.slice(raw.length - m[1].length).trim() };
    if (/^(?:como\s+(?:esta|estao|vai|anda|andam)\s+(?:o\s+|a\s+|os\s+)?(?:trade|trading|laboratorio|piloto|conta|carteira|operacoes)|(?:mostre|mostra|me\s+mostre|qual\s+e|qual\s+o)\s+(?:o\s+|a\s+)?(?:status|estado|resumo|situacao)?\s*(?:do\s+|da\s+)?(?:trade|laboratorio|conta|carteira)|(?:status|estado|resumo|situacao)\s+(?:do\s+|da\s+)?(?:trade|laboratorio|conta|carteira))\b/.test(rest)) return { kind: "status" };
    if (/^(?:(?:faca|faz|fazer|rode|roda|rodar|execute|executa|inicie|inicia|comece|comeca)\s+(?:um\s+|o\s+|uma\s+)?(?:novo\s+)?(?:estudo|teste|backtest)|estude\s+(?:o\s+mercado|as\s+estrategias)|teste\s+as\s+estrategias)/.test(rest)) return { kind: "study" };
    if ((m = rest.match(/^(?:ligue|liga|ligar|ative|ativa|ativar|inicie|inicia|iniciar|comece|comeca)\s+(?:o\s+)?piloto(?:\s+automatico)?\b([\s\S]*)$/))) return autopilot(true, m[1]);
    if (/^(?:desligue|desliga|desligar|desative|desativa|desativar|pare|para|parar)\s+(?:o\s+)?piloto/.test(rest)) return { kind: "autopilot", payload: { on: false } };
    return null;
  }

  function autopilot(on, opts) {
    if (!on) return { kind: "autopilot", payload: { on: false } };
    const o = norm(opts || "");
    const payload = { on: true };
    const s = STRATS.find((x) => x.re.test(o)); if (s) payload.strategy = s.id;
    const y = SYMBOLS.find((x) => x.re.test(o)); if (y) payload.symbol = y.id;
    if (/\b(ao vivo|live|tempo real)\b/.test(o)) payload.mode = "live";
    else if (/\b(replay|historico|simulado)\b/.test(o)) payload.mode = "replay";
    return { kind: "autopilot", payload };
  }

  /* ---------- formatação ---------- */
  const money = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" }).format(Number(v) || 0);
  const pct = (v) => `${v > 0 ? "+" : ""}${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
  const STRAT_NAME = { cruzamento: "Cruzamento de médias", rsi: "Reversão por RSI", rompimento: "Rompimento de canal" };
  const SYM_NAME = { BTCUSDT: "Bitcoin (BTC)", ETHUSDT: "Ethereum (ETH)", SOLUSDT: "Solana (SOL)" };
  const MODE_NAME = { replay: "replay do histórico", live: "mercado ao vivo" };
  const SOURCE_NAME = { binance: "dados reais da Binance", sintetico: "mercado sintético (sem internet)" };

  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

  /** Cartão no estilo das operações do Horácio. */
  function card(title) {
    const el = document.createElement("div");
    el.className = "msg ai op skill";
    el.innerHTML = `
      <div class="avatar"><img src="assets/logo.svg" alt="" /></div>
      <div class="body">
        <div class="name">HORÁCIO<span class="via mono">via Asafe</span><span class="t"></span></div>
        <div class="op-card">
          <div class="op-head"><span class="op-title"></span><span class="op-state mono"></span></div>
          <div class="sk-body"></div>
          <p class="sk-foot mono">Horácio → Asafe → Miquéias</p>
        </div>
      </div>`;
    el.querySelector(".t").textContent = time();
    el.querySelector(".op-title").textContent = title;
    thread.append(el);
    scrollDown();
    const body = el.querySelector(".sk-body");
    const state = el.querySelector(".op-state");
    return {
      el, body,
      state(s, busy) { state.textContent = s; el.classList.toggle("busy", !!busy); },
      fail(msg) { el.classList.add("failed"); state.textContent = "falhou"; body.replaceChildren(h("p", "sk-err", msg)); scrollDown(); },
    };
  }

  function stats(items) {
    const g = h("div", "sk-stats");
    items.forEach(([k, v, sub]) => {
      const c = h("div", "sk-stat");
      c.append(h("span", "k mono", k), h("span", "v", v));
      if (sub) c.append(h("span", "s mono", sub));
      g.append(c);
    });
    return g;
  }

  function ranking(rows) {
    const box = h("div", "sk-rank");
    const max = Math.max(1, ...rows.map((r) => Math.abs(r.avgReturnPct || 0)));
    rows.forEach((r, i) => {
      const row = h("div", "sk-rank-row" + (i === 0 ? " top" : ""));
      const bar = h("span", "bar");
      const fill = h("i", (r.avgReturnPct || 0) < 0 ? "neg" : "");
      fill.style.width = `${Math.max(3, (Math.abs(r.avgReturnPct || 0) / max) * 100)}%`;
      bar.append(fill);
      row.append(h("span", "pos mono", `${i + 1}º`), h("span", "nm", r.strategy), bar, h("span", "val mono", pct(r.avgReturnPct)));
      if (r.beatMarket) row.append(h("span", "beat mono", `venceu o mercado ${r.beatMarket}`));
      box.append(row);
    });
    return box;
  }

  function list(items, cls) {
    const ul = h("ul", cls);
    items.forEach((t) => ul.append(h("li", "", t)));
    return ul;
  }

  const section = (title) => h("p", "sk-sec mono", title);
  const fict = () => h("p", "sk-note", "Dinheiro fictício: é um laboratório de estudo, nenhuma ordem real é enviada.");

  /* ---------- ações ---------- */
  async function research(query) {
    const view = showAgent(AGENT, `Pesquisa na web · Horácio → Asafe → Miquéias`);
    view.el.classList.add("research");
    try {
      const r = await link.request(AGENT, "research.run", { query }, { timeout: 180000, onProgress: (p) => p && p.delta && view.append(p.delta) });
      view.set(r.reply || "(sem texto)");
      const srcs = (r.sources || []).filter((s) => s && /^https?:\/\//i.test(s.url || ""));
      if (srcs.length) {
        const box = h("div", "sk-sources");
        box.append(h("p", "sk-sec mono", `Fontes · ${srcs.length}`));
        const ol = h("ol");
        srcs.slice(0, 12).forEach((s) => {
          const a = h("a", "", s.title || s.url);
          a.href = s.url; a.target = "_blank"; a.rel = "noopener noreferrer";
          const host = h("span", "host mono", (() => { try { return new URL(s.url).hostname.replace(/^www\./, ""); } catch (e) { return ""; } })());
          const li = h("li"); li.append(a, host); ol.append(li);
        });
        box.append(ol);
        view.el.querySelector(".body").append(box);
      } else if (r.model === "demo") {
        view.el.querySelector(".body").append(h("p", "sk-note", "Modo demonstração: sem busca na web real. Configure a chave da API no Miquéias."));
      }
      scrollDown();
    } catch (e) {
      view.fail(`Não consegui pesquisar: ${e.message}`);
    }
  }

  async function status() {
    const c = card("Laboratório de Trade · situação");
    c.state("consultando", true);
    try {
      const s = await link.request(AGENT, "trade.status", {}, { timeout: 20000 });
      c.state("atualizado");
      const pos = s.position ? `${SYM_NAME[s.position.symbol] || s.position.symbol}` : "nenhuma";
      const posSub = s.position ? `${Number(s.position.qty).toLocaleString("pt-BR", { maximumFractionDigits: 8 })} @ ${money(s.position.entry)}` : "em caixa";
      const ap = s.autopilot || {};
      c.body.append(stats([
        ["Patrimônio", money(s.equity), `início ${money(s.start)}`],
        ["Retorno", pct(s.returnPct)],
        ["Caixa", money(s.cash)],
        ["Operações", String(s.trades ?? 0), "fechadas"],
        ["Posição", pos, posSub],
        ["Piloto", ap.on ? "ligado" : "desligado", ap.on ? `${STRAT_NAME[ap.strategy] || ap.strategy} · ${SYM_NAME[ap.symbol] || ap.symbol || ""} · ${MODE_NAME[ap.mode] || ap.mode || ""}` : ""],
      ]));
      if (s.lastStudy) {
        c.body.append(section(`Último estudo · ${new Date(s.lastStudy.at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })} · ${SOURCE_NAME[s.lastStudy.source] || s.lastStudy.source}`));
        c.body.append(ranking(s.lastStudy.ranking || []));
      }
      if (s.journal && s.journal.length) {
        c.body.append(section("Diário · últimas entradas"));
        c.body.append(list(s.journal, "sk-journal"));
      }
      c.body.append(fict());
      scrollDown();
    } catch (e) {
      c.fail(`Não consegui ver o trade: ${e.message}`);
    }
  }

  async function study() {
    const c = card("Laboratório de Trade · estudo");
    c.state("estudando", true);
    c.body.append(h("p", "sk-wait", "O Miquéias está testando 3 estratégias em BTC, ETH e SOL, nos tempos de 1h e 4h. Leva de 10 a 60 segundos…"));
    try {
      const r = await link.request(AGENT, "trade.study", {}, { timeout: 120000 });
      c.state("concluído");
      c.body.replaceChildren();
      c.body.append(section(`Ranking · ${SOURCE_NAME[r.source] || r.source || ""}`));
      c.body.append(ranking(r.ranking || []));
      if (r.insights && r.insights.length) {
        c.body.append(section("Aprendizados"));
        c.body.append(list(Array.isArray(r.insights) ? r.insights : [String(r.insights)], "sk-insights"));
      }
      c.body.append(fict());
      scrollDown();
    } catch (e) {
      c.fail(`O estudo não terminou: ${e.message}`);
    }
  }

  function confirmBox(c, text) {
    return new Promise((resolve) => {
      const box = h("div", "op-confirm sk-confirm");
      box.innerHTML = `<p></p><div><button type="button" class="yes">Confirmar</button><button type="button" class="no">Cancelar</button></div>`;
      box.querySelector("p").textContent = text;
      c.body.append(box);
      scrollDown();
      box.querySelector(".yes").onclick = () => { box.remove(); resolve(true); };
      box.querySelector(".no").onclick = () => { box.remove(); resolve(false); };
    });
  }

  async function pilot(payload) {
    const on = payload.on !== false;
    const c = card(`Piloto automático · ${on ? "ligar" : "desligar"}`);
    if (on) {
      const desc = [
        `Estratégia: ${STRAT_NAME[payload.strategy] || "a atual do Miquéias"}`,
        `Ativo: ${SYM_NAME[payload.symbol] || "o atual do Miquéias"}`,
        `Modo: ${MODE_NAME[payload.mode] || "o atual do Miquéias"}`,
      ];
      c.state("aguardando sua confirmação");
      c.body.append(list(desc, "sk-plan"));
      c.body.append(fict());
      const ok = await confirmBox(c, "Ligar o piloto automático do Miquéias com estas opções?");
      if (!ok) { c.state("cancelado"); c.el.classList.add("cancelled"); return; }
    }
    c.state(on ? "ligando" : "desligando", true);
    try {
      const r = await link.request(AGENT, "trade.autopilot", payload, { timeout: 30000 });
      c.state(r.on ? "ligado" : "desligado");
      c.body.replaceChildren();
      if (r.on) {
        c.body.append(stats([
          ["Estratégia", STRAT_NAME[r.strategy] || r.strategy],
          ["Ativo", SYM_NAME[r.symbol] || r.symbol],
          ["Modo", MODE_NAME[r.mode] || r.mode],
          ["Dados", SOURCE_NAME[r.source] || r.source || "—"],
        ]));
        c.body.append(fict());
      } else {
        c.body.append(h("p", "sk-ok", "Piloto automático desligado no Miquéias."));
      }
      scrollDown();
    } catch (e) {
      c.fail(`Não consegui ${on ? "ligar" : "desligar"} o piloto: ${e.message}`);
    }
  }

  /* ---------- liga no fluxo de mensagens ---------- */
  const prev = H.handle;
  H.handle = function (text) {
    const cmd = parse(text);
    if (!cmd) return prev(text);
    addUser(text);
    if (cmd.kind === "research") research(cmd.query);
    else if (cmd.kind === "status") status();
    else if (cmd.kind === "study") study();
    else if (cmd.kind === "autopilot") pilot(cmd.payload);
    return true;
  };
  H.habilidades = { parse };
})();
