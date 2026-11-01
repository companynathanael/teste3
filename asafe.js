// HORÁCIO ⇄ ASAFE — linha de servidor até os outros agentes.
// O Horácio entende pedidos como "peça ao Miquéias que …" ou "@miqueias …",
// envia pelo Asafe e mostra a resposta do agente aqui na conversa.
// Protocolo: companynathanael/Asafe (protocol/PROTOCOLO.md)

(function () {
  if (!window.AsafeLink) return;

  const KNOWN = { miqueias: "Miquéias", asafe: "Asafe" };
  let roster = [];
  const nameOf = (id) => (roster.find((a) => a.id === id) || {}).name || KNOWN[id] || id.charAt(0).toUpperCase() + id.slice(1);
  const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const knownIds = () => new Set([...Object.keys(KNOWN), ...roster.map((a) => a.id)].filter((id) => id !== "asafe" && id !== "horacio"));

  const link = AsafeLink.connect({
    id: "horacio", name: "Horácio", role: "Agente principal", kind: "principal",
    actions: {
      ping: { desc: "Mostra se o Horácio está ativo", handler: () => ({ ready: true }) },
      notify: {
        desc: "Mostra uma mensagem de outro agente na conversa do Horácio. payload: { text }",
        handler: ({ text }, ctx) => { showAgent(ctx.from).set(String(text || "")); return { shown: true }; },
      },
    },
  });

  /* ---------- status no cartão do sistema ---------- */
  const title = document.querySelector(".system-title");
  const pulse = document.querySelector(".system-card .pulse");
  function paintStatus() {
    const online = roster.filter((a) => a.online && a.id !== "horacio").length;
    const s = link.status;
    title.textContent = s === "online" ? `Asafe conectado · ${online} agente${online === 1 ? "" : "s"}` : s === "waiting" ? "Aguardando o Asafe" : "Asafe desconectado";
    pulse.classList.toggle("off", s !== "online");
  }
  async function refreshRoster() {
    if (link.status !== "online") return paintStatus();
    try { roster = await link.roster(); } catch (e) { /* Asafe fechado */ }
    paintStatus();
  }
  link.on("status", refreshRoster);
  setInterval(refreshRoster, 10000);

  /* ---------- entender o pedido ---------- */
  function parse(text) {
    const t = norm(text.trim());
    if (/^\/(agentes|asafe)$/.test(t)) return { roster: true };
    const ids = knownIds();
    const pick = (id, prompt) => (ids.has(id) && prompt.trim() ? { to: id, prompt: text.trim().slice(text.trim().length - prompt.length).trim() } : null);
    let m = t.match(/^@([a-z0-9-]+)[\s,:]+([\s\S]+)$/);
    if (m) return pick(m[1], m[2]);
    m = t.match(/^([a-z0-9-]+)\s*[,:]\s*([\s\S]+)$/);
    if (m) return pick(m[1], m[2]);
    m = t.match(/^(?:horacio[\s,]+)?(?:por favor[\s,]+)?(?:peca|pede|pedir|pergunte|pergunta|perguntar|diga|diz|fale|fala|mande|manda|solicite|solicita)\s+(?:ao|a|para o|para a|pro|pra|para)\s+([a-z0-9-]+)\s+(?:que\s+|para\s+|pra\s+|se\s+)?([\s\S]+)$/);
    if (m) return pick(m[1], m[2]);
    return null;
  }


  /* ---------- Markdown seguro (escapa o HTML antes de formatar) ---------- */
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const inline = (s) => esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
  function md(src) {
    const lines = src.replace(/\r/g, "").split("\n");
    const out = [];
    let i = 0;
    while (i < lines.length) {
      const l = lines[i];
      if (/^```/.test(l)) {
        const code = []; i++;
        while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
        i++; out.push(`<pre><code>${esc(code.join("\n"))}</code></pre>`); continue;
      }
      let m = l.match(/^(#{1,6})\s+(.*)$/);
      if (m) { const n = Math.min(m[1].length + 2, 6); out.push(`<h${n}>${inline(m[2])}</h${n}>`); i++; continue; }
      if (/^\s*([-*_])\s*\1\s*\1[\s\1]*$/.test(l)) { out.push("<hr>"); i++; continue; }
      if (/^\s*\|.*\|\s*$/.test(l) && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]) && lines[i + 1].includes("-")) {
        const cells = (r) => r.trim().replace(/^\||\|$/g, "").split("|").map((c) => inline(c.trim()));
        const head = cells(l); i += 2; const rows = [];
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(cells(lines[i++]));
        out.push(`<div class="md-table"><table><thead><tr>${head.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
        continue;
      }
      if (/^\s*([-*+]|\d+[.)])\s+/.test(l)) {
        const ordered = /^\s*\d/.test(l); const items = [];
        while (i < lines.length && /^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) items.push(inline(lines[i++].replace(/^\s*([-*+]|\d+[.)])\s+/, "")));
        const tag = ordered ? "ol" : "ul";
        out.push(`<${tag}>${items.map((x) => `<li>${x}</li>`).join("")}</${tag}>`); continue;
      }
      if (/^>\s?/.test(l)) {
        const q = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) q.push(inline(lines[i++].replace(/^>\s?/, "")));
        out.push(`<blockquote>${q.join("<br>")}</blockquote>`); continue;
      }
      if (!l.trim()) { i++; continue; }
      const p = [];
      while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|```|>|\s*([-*+]|\d+[.)])\s+|\s*\|.*\|\s*$)/.test(lines[i])) p.push(inline(lines[i++]));
      if (!p.length) p.push(inline(lines[i++]));
      out.push(`<p>${p.join("<br>")}</p>`);
    }
    return out.join("");
  }

  /* ---------- mensagens na conversa ---------- */
  function showAgent(agentId, note) {
    const el = document.createElement("div");
    el.className = "msg ai agent";
    el.innerHTML = `
      <div class="avatar agent-avatar mono"></div>
      <div class="body">
        <div class="name"><b></b><span class="via mono">via Asafe</span><span>${time()}</span></div>
        <div class="route mono"></div>
        <div class="text"><span class="typing"><i></i><i></i><i></i></span></div>
      </div>`;
    el.querySelector(".agent-avatar").textContent = nameOf(agentId).slice(0, 2).toUpperCase();
    el.querySelector(".name b").textContent = nameOf(agentId).toUpperCase();
    el.querySelector(".route").textContent = note || "";
    thread.append(el);
    scrollDown();
    const txt = el.querySelector(".text");
    let buf = "";
    return {
      el,
      append(d) { buf += d; txt.classList.add("md"); txt.innerHTML = md(buf); scrollDown(); },
      set(s) { buf = s; txt.classList.add("md"); txt.innerHTML = md(s); scrollDown(); },
      fail(msg) { el.classList.add("failed"); txt.classList.remove("md"); txt.textContent = msg; scrollDown(); },
      note(s) { el.querySelector(".route").textContent = s; },
    };
  }

  function horacioSays(textContent) {
    const el = document.createElement("div");
    el.className = "msg ai";
    el.innerHTML = `
      <div class="avatar"><img src="assets/logo.svg" alt="" /></div>
      <div class="body"><div class="name">HORÁCIO<span>${time()}</span></div><div class="text"></div></div>`;
    el.querySelector(".text").textContent = textContent;
    thread.append(el);
    scrollDown();
  }

  async function ask(to, prompt) {
    const view = showAgent(to, `Horácio → Asafe → ${nameOf(to)}`);
    try {
      const r = await link.request(to, "chat.ask", { prompt }, { onProgress: (p) => p && p.delta && view.append(p.delta) });
      view.set(r.reply || "(sem texto)");
    } catch (e) {
      view.fail(`Não consegui falar com ${nameOf(to)}: ${e.message}`);
    }
  }

  async function showRoster() {
    try {
      roster = await link.roster();
      paintStatus();
      const lines = roster.filter((a) => a.id !== "horacio").map((a) =>
        `• ${a.name}: ${a.online ? "conectado" : "desconectado"}${a.route ? "" : " (sem linha até o Asafe)"}${a.actions.length ? " · ações: " + a.actions.map((x) => x.name).join(", ") : ""}`);
      horacioSays(lines.length ? `Agentes no Asafe:\n${lines.join("\n")}` : "Nenhum outro agente cadastrado no Asafe.");
    } catch (e) {
      horacioSays(`O Asafe não respondeu: ${e.message}`);
    }
  }

  /** Chamado pelo app.js. Devolve true se o pedido foi para o Asafe. */
  function handle(text) {
    const cmd = parse(text);
    if (!cmd) return false;
    addUser(text);
    if (cmd.roster) showRoster();
    else ask(cmd.to, cmd.prompt);
    return true;
  }

  window.horacioAsafe = { link, handle, parse, nameOf, knownIds, norm, md, horacioSays };
})();
