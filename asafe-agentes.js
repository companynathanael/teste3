// HORÁCIO ⇄ ASAFE — ordens em português, manual e conversa entre núcleos.
// - agent.do  { goal, confirm? }: o agente executa o objetivo na própria tela
// - agent.manual {}: telas, ordens aceitas e dicas
// - agent.say { text }: mensagem ao núcleo do agente (painel Núcleo do Miquéias)
// - chat.say  { text, from } (ação do Horácio): outro agente fala com o Horácio
//   e o Sr. Nathanael responde. O Horácio ainda não tem núcleo de IA, então
//   nenhuma resposta é inventada.
// Especificação: docs/CONTROLE.md (seção "Ordens em português e conversa")

(function () {
  const H = window.horacioAsafe;
  if (!H) return;
  const { link, nameOf, norm, md, showAgent } = H;

  /* ---------- quem sabe o quê (pelo roster) ---------- */
  let roster = [];
  const acts = (id) => ((roster.find((a) => a.id === id) || {}).actions || []).map((a) => a.name || a);
  const has = (id, action) => acts(id).includes(action);
  async function refresh() {
    if (link.status !== "online") return;
    try { roster = await link.roster(); } catch (e) { /* Asafe fechado */ }
  }
  link.on("status", refresh);
  setInterval(refresh, 10000);

  /* ---------- entender o pedido ---------- */
  // Verbos de ordem que o próprio agente executa (agent.do). Os verbos de
  // controle preciso (clique, digite, role, espere, leia a tela, envie) continuam
  // indo para ui.*; pesquisa e trade continuam nas habilidades dedicadas.
  const GOAL_VERBS = /^(abra|abre|abrir|volte|volta|voltar|feche|fecha|fechar|compre|compra|comprar|venda|vende|vender|lembre|lembra|lembrar|esqueca|esquece|esquecer|avise|avisa|mostre|mostra|liste|lista|entre|entra|troque|troca|mude|muda|o que voce sabe|quem esta conectado|o que voce lembra)\b/;

  function addressed(text) {
    const raw = text.trim();
    const t = norm(raw);
    const m = t.match(/^(?:horacio[\s,]+)?(?:por favor[\s,]+)?(?:@([a-z0-9-]+)[\s,:]+|([a-z0-9-]+)\s*[,:]\s*)/);
    if (!m) return null;
    const to = m[1] || m[2];
    if (!H.knownIds().has(to)) return null;
    const rest = raw.slice(m[0].length).replace(/^por favor[\s,]+/i, "").trim();
    return rest ? { to, rest, nrest: norm(rest) } : null;
  }

  function parse(text) {
    const t = norm(text.trim());
    let m;
    if ((m = t.match(/^\/manual(?:\s+([a-z0-9-]+))?$/))) return { kind: "manual", to: m[1] || "miqueias" };
    if ((m = text.trim().match(/^\/fazer\s+([\s\S]+)$/i))) return { kind: "do", to: "miqueias", goal: m[1].trim() };
    // "diga/avise/conte ao Miquéias (que) …" → núcleo (agent.say)
    m = t.match(/^(?:horacio[\s,]+)?(?:diga|diz|avise|avisa|conte|conta|fale|fala)\s+(?:ao|a|para o|pro|pra)\s+([a-z0-9-]+)\s+(?:que\s+)?([\s\S]+)$/);
    if (m && H.knownIds().has(m[1])) return { kind: "say", to: m[1], text: text.trim().slice(text.trim().length - m[2].length).trim() };
    const a = addressed(text);
    if (!a) return null;
    if ((m = a.rest.match(/^(?:faça|faca|execute|executa)\s*:\s*([\s\S]+)$/i))) return { kind: "do", to: a.to, goal: m[1].trim() };
    if (/^n[uú]cleo\s*:/i.test(a.rest)) return { kind: "say", to: a.to, text: a.rest.replace(/^n[uú]cleo\s*:\s*/i, "") };
    // pesquisa e trade têm cartões próprios; controle preciso fica com ui.*
    if (H.habilidades && H.habilidades.parse(text)) return null;
    const ctl = H.controle && H.controle.parse(text);
    if (ctl && !/^(abra|abre|abrir)\b/.test(a.nrest)) return null; // "leia a tela", "clique em…", "digite…"
    if (GOAL_VERBS.test(a.nrest)) return { kind: "do", to: a.to, goal: a.rest, fallback: true };
    return null;
  }

  /* ---------- cartão de ordem ---------- */
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

  function goalCard(to, goal) {
    const el = document.createElement("div");
    el.className = "msg ai op goal";
    el.innerHTML = `
      <div class="avatar"><img src="assets/logo.svg" alt="" /></div>
      <div class="body">
        <div class="name">HORÁCIO<span class="via mono">ordem via Asafe</span><span class="t"></span></div>
        <div class="op-card">
          <div class="op-head"><span class="op-title"></span><span class="op-state mono">enviando</span></div>
          <p class="goal-text"></p>
          <ol class="op-steps"></ol>
          <div class="goal-out"></div>
        </div>
      </div>`;
    el.querySelector(".t").textContent = time();
    el.querySelector(".op-title").textContent = `Horácio → Asafe → ${nameOf(to)}`;
    el.querySelector(".goal-text").textContent = `“${goal}”`;
    thread.append(el);
    scrollDown();
    const state = el.querySelector(".op-state");
    const steps = el.querySelector(".op-steps");
    const out = el.querySelector(".goal-out");
    return {
      el,
      state: (s) => { state.textContent = s; },
      steps(list) {
        steps.replaceChildren();
        (list || []).forEach((s) => {
          const li = h("li", "op-step " + (s.ok ? "ok" : "err"));
          li.append(h("span", "ico mono", s.ok ? "✓" : "✕"), h("span", "lbl", (s.step || "").replace(/_/g, " ")), h("span", "det mono", s.detail || ""));
          steps.append(li);
        });
      },
      result(text) { const d = h("div", "text md"); d.innerHTML = md(String(text)); out.replaceChildren(d); scrollDown(); },
      confirm(message) {
        return new Promise((resolve) => {
          const box = h("div", "op-confirm");
          box.innerHTML = `<p></p><div><button type="button" class="yes">Confirmar</button><button type="button" class="no">Cancelar</button></div>`;
          box.querySelector("p").textContent = message;
          out.replaceChildren(box);
          scrollDown();
          box.querySelector(".yes").onclick = () => { box.remove(); resolve(true); };
          box.querySelector(".no").onclick = () => { box.remove(); resolve(false); };
        });
      },
      fail(msg) { el.classList.add("failed"); state.textContent = "falhou"; out.replaceChildren(h("p", "sk-err", msg)); scrollDown(); },
      remove() { el.remove(); },
    };
  }

  async function doGoal(to, goal, fallback) {
    if (!roster.length) await refresh();
    if (!has(to, "agent.do")) {
      // agente sem agent.do: vira pergunta comum
      if (fallback) return H.ask(to, goal);
      return H.horacioSays(`O ${nameOf(to)} não aceita ordens em português (agent.do). Tente "${nameOf(to)}, clique em …".`);
    }
    const c = goalCard(to, goal);
    const send = (confirm) => link.request(to, "agent.do", confirm ? { goal, confirm: true } : { goal }, { timeout: 120000 });
    try {
      let r;
      try {
        c.state("executando");
        r = await send(false);
      } catch (e) {
        if (e.code === "not_understood" && fallback) {
          // não era uma ordem: pergunta ao agente
          c.remove();
          return H.ask(to, goal);
        }
        if (e.code !== "needs_confirmation") throw e;
        c.state("aguardando sua confirmação");
        const ok = await c.confirm(e.message || "Esta ação é protegida. Confirma?");
        if (!ok) { c.state("cancelado"); c.el.classList.add("cancelled"); return; }
        c.state("executando");
        r = await send(true);
      }
      c.state(r && r.done ? "concluído" : "terminado");
      c.steps(r && r.steps);
      if (r && r.result) c.result(r.result);
    } catch (e) {
      c.fail(e.code === "not_understood" ? e.message : `Não consegui: ${e.message}`);
    }
  }

  /* ---------- manual ---------- */
  async function manual(to) {
    if (!roster.length) await refresh();
    const view = showAgent(to, `Manual · Horácio → Asafe → ${nameOf(to)}`);
    if (!has(to, "agent.manual")) return view.fail(`O ${nameOf(to)} não tem manual (agent.manual).`);
    try {
      const m = await link.request(to, "agent.manual", {}, { timeout: 20000 });
      const lines = [];
      if (m.intents && m.intents.length) {
        lines.push(`### O que o ${m.app || nameOf(to)} sabe fazer`);
        m.intents.forEach((i) => lines.push(`- **${i.desc}**${i.protected ? " *(pede confirmação)*" : ""}: \`${nameOf(to)}, ${i.example}\``));
      }
      if (m.screens && m.screens.length) {
        lines.push(`\n### Telas`);
        m.screens.forEach((s) => lines.push(`- **${s.id}**: ${s.desc}`));
      }
      if (m.tips && m.tips.length) {
        lines.push(`\n### Dicas`);
        m.tips.forEach((t) => lines.push(`- ${t}`));
      }
      view.set(lines.join("\n") || "(manual vazio)");
    } catch (e) {
      view.fail(`Não consegui ler o manual: ${e.message}`);
    }
  }

  /* ---------- conversa com o núcleo do agente ---------- */
  async function say(to, text) {
    if (!roster.length) await refresh();
    const view = showAgent(to, `Núcleo · Horácio → Asafe → ${nameOf(to)}`);
    view.el.classList.add("nucleo");
    if (!has(to, "agent.say")) {
      view.el.remove();
      return H.ask(to, text);
    }
    try {
      const r = await link.request(to, "agent.say", { text }, { timeout: 120000 });
      view.set(r && r.reply ? String(r.reply) : "(sem resposta)");
    } catch (e) {
      view.fail(`Não consegui falar com o núcleo do ${nameOf(to)}: ${e.message}`);
    }
  }

  /* ---------- chat.say: outro agente fala com o Horácio ---------- */
  const REPLY_WINDOW = 80000; // o Miquéias espera 90 s; respondemos antes disso

  function incoming(from, text) {
    const el = document.createElement("div");
    el.className = "msg ai agent incoming";
    el.innerHTML = `
      <div class="avatar agent-avatar mono"></div>
      <div class="body">
        <div class="name"><b></b><span class="via mono">via Asafe</span><span class="t"></span></div>
        <div class="route mono"></div>
        <div class="text md"></div>
        <form class="reply-box" autocomplete="off">
          <input type="text" placeholder="Responder ao agente…" />
          <button type="submit" class="mono">Responder</button>
        </form>
        <p class="reply-note mono"></p>
      </div>`;
    el.querySelector(".agent-avatar").textContent = nameOf(from).slice(0, 2).toUpperCase();
    el.querySelector(".name b").textContent = nameOf(from).toUpperCase();
    el.querySelector(".t").textContent = time();
    el.querySelector(".route").textContent = `${nameOf(from)} → Asafe → Horácio`;
    el.querySelector(".text").innerHTML = md(text);
    thread.append(el);
    // a conversa pode estar na tela inicial
    welcome.hidden = true;
    thread.hidden = false;
    scrollDown();
    return el;
  }

  link.handle("chat.say", (payload, ctx) => {
    const from = ctx.from;
    const text = String((payload && payload.text) || "").trim();
    if (!text) throw Object.assign(new Error("Mensagem vazia."), { code: "bad_request" });
    const el = incoming(from, text);
    const form = el.querySelector(".reply-box");
    const input = form.querySelector("input");
    const note = el.querySelector(".reply-note");
    note.textContent = "O Horácio ainda não tem núcleo de IA: a resposta é do senhor.";
    return new Promise((resolve) => {
      let open = true;
      const timer = setTimeout(() => {
        open = false;
        note.textContent = "Sem resposta a tempo. Se responder agora, vai para o núcleo do agente.";
        resolve({ reply: null, note: "O Sr. Nathanael ainda não respondeu pelo Horácio." });
      }, REPLY_WINDOW);
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const reply = input.value.trim();
        if (!reply) return;
        input.value = "";
        const mine = document.createElement("p");
        mine.className = "reply-mine";
        mine.textContent = `Sr. Nathanael: ${reply}`;
        el.querySelector(".body").insertBefore(mine, form);
        if (open) {
          open = false;
          clearTimeout(timer);
          note.textContent = "Resposta enviada.";
          form.remove();
          resolve({ reply, from: "Sr. Nathanael (pelo Horácio)" });
        } else {
          note.textContent = "Enviando ao núcleo do agente…";
          form.remove();
          link.request(from, "agent.say", { text: reply }, { timeout: 120000 })
            .then((r) => { note.textContent = "Enviado ao núcleo."; if (r && r.reply) { const v = showAgent(from, `Núcleo · resposta`); v.set(String(r.reply)); } })
            .catch((err) => { note.textContent = `Não consegui enviar: ${err.message}`; });
        }
      });
      setTimeout(() => input.focus(), 50);
    });
  }, "Conversa com o Horácio: a mensagem aparece para o Sr. Nathanael, que responde. payload: { text, from }");

  /* ---------- liga no fluxo de mensagens ---------- */
  const prev = H.handle;
  H.handle = function (text) {
    const cmd = parse(text);
    if (!cmd) return prev(text);
    addUser(text);
    if (cmd.kind === "do") doGoal(cmd.to, cmd.goal, cmd.fallback);
    else if (cmd.kind === "manual") manual(cmd.to);
    else if (cmd.kind === "say") say(cmd.to, cmd.text);
    return true;
  };
  H.agentes = { parse, doGoal, manual, say };
})();
