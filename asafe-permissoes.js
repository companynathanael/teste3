// HORÁCIO ⇄ ASAFE — permissões.
// Antes de usar o núcleo de outra IA, o Horácio pede permissão ao Asafe
// (permission.request). Sem permissão, nada sai do núcleo do Horácio.
// Também controla a chave "Operar o Miquéias". Especificação: docs/PERMISSOES.md

(function () {
  const H = window.horacioAsafe;
  if (!H) return;
  const { link, nameOf, norm } = H;
  const CORE = "asafe";
  const ASK_TIMEOUT = 120000;

  /* ---------- escopos ---------- */
  const SCOPES = {
    conversa: "conversar com",
    pesquisa: "pesquisar na web pelo",
    "trade.leitura": "ver e estudar o trade do",
    "trade.piloto": "ligar ou desligar o piloto automático do",
    controle: "operar a tela do",
    configuracao: "mudar as configurações do",
    outros: "usar outras funções do",
  };
  const SCOPE_LABEL = { conversa: "conversa", pesquisa: "pesquisa", "trade.leitura": "trade (leitura)", "trade.piloto": "piloto automático", controle: "controle de tela", configuracao: "configurações", outros: "outras funções" };

  function scopeOf(action) {
    if (/^chat\./.test(action)) return "conversa";
    if (action === "research.run") return "pesquisa";
    if (action === "trade.status" || action === "trade.study") return "trade.leitura";
    if (action === "trade.autopilot") return "trade.piloto";
    if (/^ui\./.test(action)) return "controle";
    if (/^settings\./.test(action)) return "configuracao";
    return "outros";
  }
  const exempt = (to, action, payload) =>
    to === CORE || action === "ping" || (action === "ui.control" && payload && payload.on === false);

  /* ---------- estado ---------- */
  const grants = new Map(); // "to:scope" -> { grantId, expiresAt }
  const inflight = new Map(); // "to:scope" -> Promise
  const key = (to, scope) => `${to}:${scope}`;
  const valid = (g) => g && (!g.expiresAt || g.expiresAt > Date.now());

  const OFF_KEY = "horacio.controle.desligado";
  let controlOff = new Set();
  try { controlOff = new Set(JSON.parse(localStorage.getItem(OFF_KEY) || "[]")); } catch (e) { /* sem armazenamento */ }
  const saveOff = () => { try { localStorage.setItem(OFF_KEY, JSON.stringify([...controlOff])); } catch (e) { /* ignora */ } };

  const fail = (code, message) => Object.assign(new Error(message), { code });

  /* ---------- cartão do pedido de permissão ---------- */
  function permCard(to, scope, reason) {
    const el = document.createElement("div");
    el.className = "msg ai perm";
    el.innerHTML = `
      <div class="avatar"><img src="assets/logo.svg" alt="" /></div>
      <div class="body">
        <div class="perm-line">
          <span class="perm-ico mono">◌</span>
          <span class="perm-txt"></span>
          <span class="perm-state mono">aguardando o Asafe</span>
        </div>
        <div class="perm-why mono"></div>
      </div>`;
    el.querySelector(".perm-txt").textContent = `Pedido de permissão ao Asafe: ${SCOPES[scope]} ${nameOf(to)}`;
    el.querySelector(".perm-why").textContent = reason ? `pedido: “${reason}”` : "";
    // logo abaixo da ordem do Sr. Nathanael, antes da resposta
    const lastUser = [...thread.querySelectorAll(".msg.user")].pop();
    if (lastUser) lastUser.after(el); else thread.append(el);
    scrollDown();
    const set = (state, label, detail) => {
      el.className = "msg ai perm " + state;
      el.querySelector(".perm-ico").textContent = state === "ok" ? "✓" : state === "no" ? "✕" : "◌";
      el.querySelector(".perm-state").textContent = label;
      if (detail) el.querySelector(".perm-why").textContent = detail;
      scrollDown();
    };
    return { set };
  }

  /* ---------- pedir permissão ---------- */
  let lastReason = "";
  const baseRequest = link.request.bind(link);

  function ensure(to, scope, action) {
    const k = key(to, scope);
    if (valid(grants.get(k))) return Promise.resolve(grants.get(k));
    if (inflight.has(k)) return inflight.get(k);
    const card = permCard(to, scope, lastReason);
    const p = baseRequest(CORE, "permission.request", { to, scope, actions: [action], reason: lastReason }, { timeout: ASK_TIMEOUT })
      .then((r) => {
        if (!r || r.granted !== true) throw fail("denied", (r && r.message) || "O Asafe não concedeu a permissão.");
        const g = { grantId: r.grantId || null, expiresAt: r.expiresAt || null };
        grants.set(k, g);
        card.set("ok", "concedida");
        paint();
        return g;
      })
      .catch((e) => {
        if (e.code === "unknown_action") {
          card.set("no", "sem sistema de permissões", "O Asafe ainda não tem o sistema de permissões. Por segurança, não executei o pedido.");
          throw fail("no_permission_system", "O Asafe ainda não tem o sistema de permissões; por segurança, o pedido não foi executado.");
        }
        if (e.code === "timeout") {
          card.set("no", "sem resposta", "O Asafe não respondeu ao pedido de permissão a tempo.");
          throw fail("denied", "O Asafe não respondeu ao pedido de permissão.");
        }
        card.set("no", "negada", e.message);
        throw fail(e.code === "denied" ? "denied" : e.code || "denied", `Permissão negada pelo Asafe: ${e.message}`);
      })
      .finally(() => inflight.delete(k));
    inflight.set(k, p);
    return p;
  }

  // Todo pedido a outra IA passa por aqui.
  link.request = function (to, action, payload = {}, opts = {}) {
    if (exempt(to, action, payload)) return baseRequest(to, action, payload, opts);
    if (/^ui\./.test(action) && controlOff.has(to)) {
      return Promise.reject(fail("control_off", `O controle do ${nameOf(to)} está desligado. Ligue em "Operar o ${nameOf(to)}" na barra lateral ou escreva "volte a operar no ${nameOf(to)}".`));
    }
    return ensure(to, scopeOf(action), action).then(() => baseRequest(to, action, payload, opts)).catch((e) => {
      // O Asafe retirou a permissão no meio do caminho: esquece e repassa o erro.
      if (e.code === "forbidden") { grants.delete(key(to, scopeOf(action))); paint(); }
      throw e;
    });
  };

  function forget(to, scope) {
    let n = 0;
    for (const k of [...grants.keys()]) if (k.startsWith(to + ":") && (!scope || k === key(to, scope))) { grants.delete(k); n++; }
    paint();
    return n;
  }

  async function release(to, scope) {
    forget(to, scope);
    try { await baseRequest(CORE, "permission.release", scope ? { to, scope } : { to }, { timeout: 5000 }); } catch (e) { /* Asafe antigo ou fechado */ }
  }

  link.on("event", (env) => {
    if (env.from !== CORE || env.action !== "permission.revoked") return;
    const { to, scope } = env.payload || {};
    if (!to) return;
    forget(to, scope);
    if (!scope || scope === "controle") {
      H.controle && H.controle.stopAll(`O Asafe retirou a permissão de operar o ${nameOf(to)}.`, to);
      baseRequest(to, "ui.control", { on: false, by: "horacio" }, { timeout: 5000 }).catch(() => {});
    }
    H.horacioSays(`O Asafe retirou a permissão de ${scope ? SCOPES[scope] || scope : "usar o núcleo do"} ${nameOf(to)}.`);
  });

  /* ---------- chave "Operar o …" ---------- */
  async function setControl(to, on, silent) {
    if (on) controlOff.delete(to); else controlOff.add(to);
    saveOff();
    paint();
    if (!on) {
      H.controle && H.controle.stopAll(`Controle do ${nameOf(to)} desligado pelo senhor.`, to);
      baseRequest(to, "ui.control", { on: false, by: "horacio" }, { timeout: 5000 }).catch(() => {});
      await release(to, "controle");
    }
    if (!silent) H.horacioSays(on
      ? `Pronto, Sr. Nathanael. Posso voltar a operar o ${nameOf(to)}; vou pedir permissão ao Asafe na próxima ordem.`
      : `Parei de operar o ${nameOf(to)}, Sr. Nathanael. Desliguei o aviso na tela dele e devolvi a permissão ao Asafe.`);
  }

  /* ---------- cartão "Núcleos externos" na barra lateral ---------- */
  const card = document.createElement("div");
  card.className = "ext-card";
  card.innerHTML = `<p class="group-label mono">Núcleos externos</p><div class="ext-list"></div>`;
  const sys = document.querySelector(".system-card");
  sys.parentNode.insertBefore(card, sys);
  const listEl = card.querySelector(".ext-list");
  let roster = [];

  function paint() {
    listEl.replaceChildren();
    const agents = roster.filter((a) => a.id !== "horacio" && a.id !== CORE);
    if (!agents.length) {
      const p = document.createElement("p");
      p.className = "ext-empty mono";
      p.textContent = link.status === "online" ? "Nenhuma IA conectada" : "Asafe desconectado";
      listEl.append(p);
      return;
    }
    for (const a of agents) {
      const row = document.createElement("div");
      row.className = "ext-row" + (a.online ? "" : " off");
      const head = document.createElement("div");
      head.className = "ext-head";
      const dot = document.createElement("span"); dot.className = "ext-dot";
      const nm = document.createElement("span"); nm.className = "ext-name"; nm.textContent = a.name || nameOf(a.id);
      head.append(dot, nm);
      const hasUi = (a.actions || []).some((x) => /^ui\./.test(x.name));
      if (hasUi) {
        const sw = document.createElement("button");
        sw.type = "button";
        sw.className = "ext-switch";
        const on = !controlOff.has(a.id);
        sw.setAttribute("role", "switch");
        sw.setAttribute("aria-checked", String(on));
        sw.title = on ? `Parar de operar o ${a.name}` : `Permitir operar o ${a.name}`;
        sw.innerHTML = `<span class="lbl mono"></span><i></i>`;
        sw.querySelector(".lbl").textContent = on ? "operar" : "parado";
        sw.onclick = () => setControl(a.id, controlOff.has(a.id));
        head.append(sw);
      }
      row.append(head);
      const mine = [...grants.entries()].filter(([k, g]) => k.startsWith(a.id + ":") && valid(g));
      if (mine.length) {
        const chips = document.createElement("div");
        chips.className = "ext-chips";
        for (const [k] of mine) {
          const scope = k.slice(a.id.length + 1);
          const chip = document.createElement("button");
          chip.type = "button";
          chip.className = "ext-chip mono";
          chip.title = "Devolver esta permissão ao Asafe";
          chip.textContent = `${SCOPE_LABEL[scope] || scope} ×`;
          chip.onclick = () => release(a.id, scope);
          chips.append(chip);
        }
        row.append(chips);
      }
      listEl.append(row);
    }
  }

  async function refresh() {
    if (link.status !== "online") { roster = []; paint(); return; }
    try { roster = await link.roster(); } catch (e) { /* Asafe fechado */ }
    for (const [k, g] of grants) if (!valid(g)) grants.delete(k);
    paint();
  }
  link.on("status", refresh);
  setInterval(refresh, 10000);
  paint();

  /* ---------- comandos ---------- */
  function agentIn(t) {
    const ids = H.knownIds();
    const m = t.match(/(?:no|na|o|a|do|da)?\s*@?([a-z0-9-]+)\s*[.!]?$/);
    return m && ids.has(m[1]) ? m[1] : null;
  }

  function parse(text) {
    const t = norm(text.trim()).replace(/^horacio[\s,]+/, "").replace(/^por favor[\s,]+/, "");
    let m;
    if (/^\/parar$/.test(t)) return { cmd: "stop", to: H.controle && H.controle.running ? H.controle.running : "miqueias" };
    if ((m = t.match(/^\/operar\s+([a-z0-9-]+)$/))) return { cmd: "start", to: m[1] };
    if (/^\/permiss(oes|ao)$/.test(t)) return { cmd: "list" };
    if ((m = t.match(/^\/soltar\s+([a-z0-9-]+)$/))) return { cmd: "release", to: m[1] };
    if (/^(pare|para|parar|deixe|deixa)\s+de\s+(operar|mexer|controlar)\b/.test(t)) { const to = agentIn(t) || "miqueias"; return { cmd: "stop", to }; }
    if (/^(volte|volta|voltar|pode\s+voltar)\s+a\s+(operar|mexer|controlar)\b/.test(t)) { const to = agentIn(t) || "miqueias"; return { cmd: "start", to }; }
    return null;
  }

  function listGrants() {
    const items = [...grants.entries()].filter(([, g]) => valid(g));
    const lines = items.map(([k]) => { const [to, ...s] = k.split(":"); const scope = s.join(":"); return `• ${nameOf(to)}: ${SCOPE_LABEL[scope] || scope}`; });
    const offs = [...controlOff].map((id) => `• Controle do ${nameOf(id)}: desligado`);
    H.horacioSays(lines.length || offs.length
      ? [lines.length ? `Permissões ativas no Asafe:\n${lines.join("\n")}` : "Nenhuma permissão ativa no Asafe.", ...offs].join("\n")
      : "Nenhuma permissão ativa no Asafe. Vou pedir quando precisar usar o núcleo de outra IA.");
  }

  const prev = H.handle;
  H.handle = function (text) {
    lastReason = text.trim().slice(0, 300);
    const c = parse(text);
    if (!c) return prev(text);
    addUser(text);
    if (c.cmd === "stop") setControl(c.to, false);
    else if (c.cmd === "start") setControl(c.to, true);
    else if (c.cmd === "list") listGrants();
    else if (c.cmd === "release") { release(c.to); H.horacioSays(`Devolvi ao Asafe todas as permissões do ${nameOf(c.to)}.`); }
    return true;
  };

  H.permissoes = { ensure, release, setControl, scopeOf, parse, get grants() { return new Map(grants); }, get controlOff() { return new Set(controlOff); } };
})();
