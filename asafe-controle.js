// HORÁCIO ⇄ ASAFE — controle de interface (ui.*), etapa 1: "as mãos".
// O Sr. Nathanael dá ordens diretas ("Miquéias, clique em Nova conversa") e o
// Horácio opera a tela do agente pelo Asafe, mostrando cada passo aqui.
// Especificação: docs/CONTROLE.md

(function () {
  const H = window.horacioAsafe;
  if (!H) return;
  const { link, nameOf, knownIds, norm } = H;

  /* ---------- entender a ordem ---------- */
  const VERB = /^(?:por favor[\s,]+)?(clique|clica|clicar|aperte|aperta|apertar|abra|abre|abrir|digite|digita|digitar|envie|envia|enviar|pressione|pressiona|tecle|role|rola|rolar|espere|espera|aguarde|aguarda|leia|le|ler|mostre|mostra|ver|veja|descreva)\b/;

  /** Separa os passos por ";" ou "e depois"/"depois", respeitando texto entre aspas. */
  function splitSteps(s) {
    const out = []; let cur = ""; let q = null;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (q) { cur += c; if (c === q) q = null; continue; }
      if (c === '"' || c === "“" || c === "”") { q = c === "“" ? "”" : c; cur += c; continue; }
      if (c === ";") { out.push(cur); cur = ""; continue; }
      const rest = s.slice(i);
      const m = rest.match(/^,?\s+(?:e\s+)?depois\s+/i);
      if (m && cur.trim()) { out.push(cur); cur = ""; i += m[0].length - 1; continue; }
      cur += c;
    }
    out.push(cur);
    return out.map((x) => x.trim()).filter(Boolean);
  }

  const unquote = (s) => s.trim().replace(/^["“](.*)["”]$/s, "$1");
  const target = (s) => s.trim().replace(/^(?:em|no|na|o|a|os|as|sobre)\s+/i, "").replace(/^(?:botao|botão|aba|item|menu|campo|link)\s+/i, "").replace(/^["“](.*)["”]$/, "$1").trim();

  /** Converte um passo em português numa ação ui.*. */
  function parseStep(raw) {
    const s = raw.trim();
    const n = norm(s);
    let m;
    if (/^(leia|le|ler|mostre|mostra|ver|veja|descreva)\s+(?:a\s+|sua\s+)?tela\b/.test(n)) return { action: "ui.snapshot", payload: {}, label: "Ler a tela" };
    if (/^(envie|envia|enviar)(?:\s+a\s+mensagem)?\.?$/.test(n)) return { action: "ui.key", payload: { key: "Enter" }, label: "Enviar" };
    if ((m = n.match(/^(pressione|pressiona|tecle|aperte|aperta|apertar)\s+(?:a\s+tecla\s+)?(enter|esc|escape|tab|seta para cima|seta para baixo)$/))) {
      const key = { enter: "Enter", esc: "Escape", escape: "Escape", tab: "Tab", "seta para cima": "ArrowUp", "seta para baixo": "ArrowDown" }[m[2]];
      return { action: "ui.key", payload: { key }, label: `Tecla ${key}` };
    }
    if ((m = n.match(/^(role|rola|rolar)\s*(?:para\s+|pra\s+|ate\s+o\s+|ao\s+)?(cima|baixo|topo|inicio|fim|final)?/))) {
      const direction = { cima: "up", baixo: "down", topo: "top", inicio: "top", fim: "bottom", final: "bottom" }[m[2] || "baixo"];
      return { action: "ui.scroll", payload: { direction }, label: `Rolar para ${m[2] || "baixo"}` };
    }
    if (/^(espere|espera|aguarde|aguarda)\b/.test(n)) {
      const qm = s.match(/["“]([^"”]+)["”]/);
      if (qm) return { action: "ui.wait", payload: { text: qm[1] }, label: `Esperar “${qm[1]}”` };
      return { action: "ui.wait", payload: { idle: true }, label: "Esperar a resposta terminar" };
    }
    if (/^(digite|digita|digitar)\b/.test(n)) {
      const body = s.replace(/^\S+\s*/, "");
      const qm = body.match(/^["“]([\s\S]*?)["”]\s*(?:(?:no|na|em)\s+(?:campo\s+|caixa\s+)?(.+))?$/i);
      const text = qm ? qm[1] : unquote(body);
      const field = qm && qm[2] ? target(qm[2]) : null;
      if (!text) return { error: "Faltou o texto para digitar." };
      return { action: "ui.type", payload: field ? { name: field, text } : { text }, label: `Digitar “${text}”${field ? ` em ${field}` : ""}` };
    }
    if (/^(clique|clica|clicar|aperte|aperta|apertar|abra|abre|abrir)\b/.test(n)) {
      const name = target(s.replace(/^\S+\s*/, ""));
      if (!name) return { error: "Faltou dizer onde clicar." };
      return { action: "ui.click", payload: { name }, label: `${/^ab/.test(n) ? "Abrir" : "Clicar em"} “${name}”` };
    }
    return { error: `Não entendi o passo “${s}”.` };
  }

  /** Reconhece "Miquéias, <verbo> …", "@miqueias <verbo> …" e "/tela miqueias". */
  function parse(text) {
    const t = text.trim();
    const n = norm(t);
    const ids = knownIds();
    let m = n.match(/^\/tela\s+([a-z0-9-]+)$/);
    if (m && ids.has(m[1])) return { to: m[1], steps: [parseStep("leia a tela")] };
    m = n.match(/^(?:no\s+)?@?([a-z0-9-]+)\s*[,:]?\s+/);
    if (!m || !ids.has(m[1])) return null;
    const rest = t.slice(m[0].length).replace(/^por favor[\s,]+/i, "");
    if (!VERB.test(norm(rest))) return null;
    const steps = splitSteps(rest).map(parseStep);
    // Se nem o primeiro passo é uma ordem de tela, é uma pergunta comum (chat.ask).
    if (!steps.length || steps[0].error) return null;
    return { to: m[1], steps };
  }

  /* ---------- cartão de operação ---------- */
  const ICON = { wait: "○", run: "◌", ok: "✓", err: "✕", stop: "■" };

  function opCard(to) {
    const el = document.createElement("div");
    el.className = "msg ai op";
    el.innerHTML = `
      <div class="avatar"><img src="assets/logo.svg" alt="" /></div>
      <div class="body">
        <div class="name">HORÁCIO<span class="via mono">controle via Asafe</span><span class="t"></span></div>
        <div class="op-card">
          <div class="op-head">
            <span class="op-title"></span>
            <span class="op-state mono"></span>
            <button type="button" class="op-stop mono">Parar</button>
          </div>
          <ol class="op-steps"></ol>
          <div class="op-out"></div>
        </div>
      </div>`;
    el.querySelector(".t").textContent = time();
    el.querySelector(".op-title").textContent = `Horácio → Asafe → ${nameOf(to)}`;
    thread.append(el);
    scrollDown();
    return el;
  }

  function stepRow(card, label) {
    const li = document.createElement("li");
    li.className = "op-step wait";
    li.innerHTML = `<span class="ico mono"></span><span class="lbl"></span><span class="det mono"></span>`;
    li.querySelector(".ico").textContent = ICON.wait;
    li.querySelector(".lbl").textContent = label;
    card.querySelector(".op-steps").append(li);
    const set = (state, detail) => {
      li.className = "op-step " + state;
      li.querySelector(".ico").textContent = ICON[state];
      if (detail !== undefined) li.querySelector(".det").textContent = detail;
      scrollDown();
    };
    return { li, set };
  }

  function askConfirm(row, message) {
    return new Promise((resolve) => {
      const box = document.createElement("div");
      box.className = "op-confirm";
      box.innerHTML = `<p></p><div><button type="button" class="yes">Confirmar</button><button type="button" class="no">Cancelar</button></div>`;
      box.querySelector("p").textContent = message || "Esta ação é protegida. Confirma?";
      row.li.append(box);
      scrollDown();
      box.querySelector(".yes").onclick = () => { box.remove(); resolve(true); };
      box.querySelector(".no").onclick = () => { box.remove(); resolve(false); };
    });
  }

  function renderSnapshot(card, snap) {
    const out = card.querySelector(".op-out");
    const els = (snap && snap.elements) || [];
    const wrap = document.createElement("details");
    wrap.className = "op-snap";
    wrap.open = true;
    const sum = document.createElement("summary");
    sum.className = "mono";
    sum.textContent = `Tela de ${snap.app || "agente"}${snap.screen ? " · " + snap.screen : ""} · ${els.length} elementos`;
    wrap.append(sum);
    const list = document.createElement("ul");
    els.slice(0, 60).forEach((e) => {
      const li = document.createElement("li");
      const role = document.createElement("span"); role.className = "role mono"; role.textContent = e.role;
      const name = document.createElement("span"); name.className = "nm"; name.textContent = e.name || "(sem nome)";
      li.append(role, name);
      if (e.value) { const v = document.createElement("span"); v.className = "val mono"; v.textContent = `= ${String(e.value).slice(0, 60)}`; li.append(v); }
      if (e.protected) { const p = document.createElement("span"); p.className = "prot mono"; p.textContent = "protegido"; li.append(p); }
      if (e.state && e.state.length) { const st = document.createElement("span"); st.className = "st mono"; st.textContent = e.state.join(" · "); li.append(st); }
      list.append(li);
    });
    wrap.append(list);
    if (snap.text) { const p = document.createElement("p"); p.className = "op-text"; p.textContent = snap.text; wrap.append(p); }
    out.append(wrap);
    scrollDown();
  }

  /* ---------- execução ---------- */
  let current = null;

  link.on("event", (env) => {
    if (env.action === "ui.stopped" && current && current.to === env.from) current.stop(`Parado pelo senhor no ${nameOf(env.from)}.`);
  });

  async function run(to, steps) {
    const card = opCard(to);
    const state = card.querySelector(".op-state");
    const stopBtn = card.querySelector(".op-stop");
    const rows = steps.map((s) => stepRow(card, s.label || s.error));
    const bad = steps.findIndex((s) => s.error);
    if (bad >= 0) {
      rows[bad].set("err", steps[bad].error);
      state.textContent = "não iniciado";
      stopBtn.remove();
      card.classList.add("done");
      return;
    }

    let stopped = null;
    let activeRow = null;
    const op = { to, stop: (why) => {
      if (stopped) return;
      stopped = why || "Parado.";
      state.textContent = "parado";
      if (activeRow) activeRow.set("stop", stopped); // o passo em andamento muda na hora
      const btn = card.querySelector(".op-stop"); if (btn) btn.remove();
    } };
    if (current) current.stop("Substituído por uma nova operação.");
    current = op;
    stopBtn.onclick = () => { op.stop("Parado pelo senhor."); link.request(to, "ui.control", { on: false, by: "horacio" }, { timeout: 5000 }).catch(() => {}); };

    state.textContent = "conectando…";
    try {
      await link.request(to, "ui.control", { on: true, by: "horacio" }, { timeout: 8000 });
    } catch (e) {
      rows[0].set("err", e.message);
      state.textContent = "falhou";
      stopBtn.remove();
      if (current === op) current = null;
      return;
    }

    state.textContent = "operando";
    let failed = false;
    for (let i = 0; i < steps.length; i++) {
      const row = rows[i];
      activeRow = row;
      if (stopped) { rows.slice(i).forEach((r, k) => r.set("stop", k === 0 ? stopped : "")); break; }
      row.set("run", "");
      const { action, payload } = steps[i];
      const timeout = action === "ui.wait" ? (payload.timeout || 15000) + 5000 : 15000;
      try {
        let r;
        try {
          r = await link.request(to, action, payload, { timeout });
        } catch (e) {
          if (e.code !== "needs_confirmation") throw e;
          row.set("run", "aguardando sua confirmação");
          const ok = await askConfirm(row, e.message);
          if (!ok) { op.stop("Cancelado pelo senhor."); row.set("stop", "Cancelado pelo senhor."); continue; }
          if (stopped) { row.set("stop", ""); continue; }
          row.set("run", "");
          r = await link.request(to, action, Object.assign({}, payload, { confirm: true }), { timeout });
        }
        if (stopped) { row.set("stop", ""); continue; }
        row.set("ok", r && r.target ? (r.target.name || r.target.ref || "") : "");
        if (action === "ui.snapshot") renderSnapshot(card, r || {});
        // menus e janelas abrem com animação: dá tempo antes do próximo passo
        if (action === "ui.click" && i < steps.length - 1) await new Promise((z) => setTimeout(z, 350));
      } catch (e) {
        if (stopped) { row.set("stop", stopped); continue; }
        let msg = e.message;
        if (e.code === "ambiguous") msg += " Diga qual exatamente.";
        row.set("err", msg);
        rows.slice(i + 1).forEach((r2) => r2.set("stop", ""));
        failed = true;
        break;
      }
    }

    link.request(to, "ui.control", { on: false, by: "horacio" }, { timeout: 5000 }).catch(() => {});
    state.textContent = stopped ? "parado" : failed ? "parou com erro" : "concluído";
    stopBtn.remove();
    card.classList.add("done");
    if (current === op) current = null;
  }

  /* ---------- liga no fluxo de mensagens do Horácio ---------- */
  const baseHandle = H.handle;
  H.handle = function (text) {
    const cmd = parse(text);
    if (!cmd) return baseHandle(text);
    addUser(text);
    run(cmd.to, cmd.steps);
    return true;
  };
  /** Para a operação em andamento (se houver) com o motivo dado. */
  function stopAll(reason, to) {
    if (current && (!to || current.to === to)) { current.stop(reason || "Parado."); return true; }
    return false;
  }
  H.controle = { parse, parseStep, splitSteps, run, stopAll, get running() { return current ? current.to : null; } };
})();
