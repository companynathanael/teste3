// HoV 1.0 — voz do Horácio.
// - Microfone (caixa de mensagem): dita uma mensagem (reconhecimento de fala do navegador, pt-BR).
// - Modo voz (botão de ondas no topo): conversa falada contínua — ouve, envia, responde em voz
//   alta e volta a ouvir. Diga "parar modo voz" ou toque no botão para sair.
// - Fala: voz masculina em português, escolhida automaticamente ou nas Configurações.

(function () {
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  const synth = window.speechSynthesis;
  const input = document.querySelector("#input");
  const form = document.querySelector("#composer");
  const mic = document.querySelector('#composer [aria-label="Falar"]');
  const modoBtn = document.querySelector('.topbar-actions [aria-label="Modo voz"]');

  /* ---------- vozes ---------- */
  const MASC = /(daniel|ant[oô]nio|ricardo|felipe|duarte|f[aá]bio|thiago|tiago|paulo|jo[aã]o|cristiano|helio|h[eé]lio|male|mascul|homem|\bman\b)/i;
  const FEM = /(maria|luciana|francisca|helena|vit[oó]ria|joana|raquel|fernanda|leila|yara|female|femin|mulher|camila|thalita|brenda|elza|giovanna|leticia|let[ií]cia|manuela)/i;
  const vozes = () => (synth ? synth.getVoices().filter((v) => /^pt/i.test(v.lang)) : []);
  function escolherVoz(nome) {
    const vs = vozes();
    if (nome) { const v = vs.find((x) => x.name === nome); if (v) return { voz: v, tom: 1 }; }
    const br = vs.filter((v) => /pt-BR/i.test(v.lang));
    const masc = br.find((v) => MASC.test(v.name)) || vs.find((v) => MASC.test(v.name));
    if (masc) return { voz: masc, tom: 0.95 };
    // sem voz masculina instalada: usa uma voz em português não feminina, com tom mais grave
    const neutra = br.find((v) => !FEM.test(v.name)) || vs.find((v) => !FEM.test(v.name)) || br[0] || vs[0];
    return { voz: neutra || null, tom: 0.7 };
  }
  if (synth && synth.onvoiceschanged !== undefined) synth.onvoiceschanged = () => {};

  const limparTexto = (t) => String(t || "")
    .replace(/```[\s\S]*?```/g, " (código na tela) ")
    .replace(/\|.*\|/g, " ")
    .replace(/[#*_`>|]/g, "")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();

  function falar(texto, nomeVoz) {
    return new Promise((resolve) => {
      if (!synth) return resolve();
      synth.cancel();
      const t = limparTexto(texto).slice(0, 1400);
      if (!t) return resolve();
      const cfg = (window.HoV && window.HoV.config) || {};
      const { voz, tom } = escolherVoz(nomeVoz !== undefined ? nomeVoz : cfg.voz);
      // divide em frases para o navegador não cortar falas longas
      const partes = t.match(/[^.!?…]+[.!?…]*/g) || [t];
      let i = 0;
      const prox = () => {
        if (i >= partes.length) { document.body.classList.remove("hov-falando"); return resolve(); }
        const u = new SpeechSynthesisUtterance(partes[i++].trim());
        u.lang = (voz && voz.lang) || "pt-BR"; if (voz) u.voice = voz;
        u.pitch = tom; u.rate = 1.02;
        u.onend = prox; u.onerror = prox;
        synth.speak(u);
      };
      document.body.classList.add("hov-falando");
      prox();
    });
  }
  const calar = () => { if (synth) synth.cancel(); document.body.classList.remove("hov-falando"); };

  /* ---------- ouvir ---------- */
  let rec = null, ouvindo = false;
  function ouvir({ enviar = true } = {}) {
    return new Promise((resolve) => {
      if (!Rec) { alert("Este navegador não tem reconhecimento de fala. Use o Google Chrome."); return resolve(""); }
      calar();
      rec = new Rec();
      rec.lang = "pt-BR"; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
      let final = "";
      const antes = input.value && !enviar ? input.value + " " : "";
      rec.onresult = (e) => {
        let parcial = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) final += r[0].transcript; else parcial += r[0].transcript;
        }
        input.value = (antes + final + parcial).trim();
        input.dispatchEvent(new Event("input"));
      };
      rec.onerror = (e) => { if (e.error === "not-allowed") alert("O Chrome bloqueou o microfone. Permita o microfone para esta página."); };
      rec.onend = () => {
        ouvindo = false; document.body.classList.remove("hov-ouvindo");
        const texto = (antes + final).trim();
        if (enviar && final.trim()) form.requestSubmit();
        resolve(final.trim());
      };
      ouvindo = true; document.body.classList.add("hov-ouvindo");
      try { rec.start(); } catch (e) { ouvindo = false; document.body.classList.remove("hov-ouvindo"); resolve(""); }
    });
  }
  const pararOuvir = () => { if (rec && ouvindo) try { rec.stop(); } catch (e) { /* ignora */ } };

  if (mic) mic.addEventListener("click", () => (ouvindo ? pararOuvir() : ouvir({ enviar: false })));

  /* ---------- modo voz (conversa falada) ---------- */
  let modo = false;
  const esperarResposta = () => new Promise((resolve) => {
    const fn = (e) => { window.removeEventListener("hov:resposta", fn); resolve(e.detail && e.detail.texto); };
    window.addEventListener("hov:resposta", fn);
  });
  async function cicloVoz() {
    while (modo) {
      const dito = await ouvir({ enviar: false });
      if (!modo) break;
      if (!dito) continue;
      if (/^(parar|sair do|desligar o|encerrar o)\s*(modo )?voz\b/i.test(dito.trim()) || /^(obrigado|valeu),? (horácio|horacio)[.!]?$/i.test(dito.trim())) { await falar("Até logo, Sr. Nathanael."); setModo(false); break; }
      const prom = esperarResposta();
      form.requestSubmit();
      const resposta = await Promise.race([prom, new Promise((r) => setTimeout(() => r(null), 180000))]);
      if (!modo) break;
      if (resposta) await falar(resposta);
    }
  }
  function setModo(on) {
    modo = on;
    document.body.classList.toggle("hov-modo-voz", on);
    if (modoBtn) { modoBtn.classList.toggle("on", on); modoBtn.title = on ? "Sair do modo voz" : "Modo voz"; }
    if (on) { falar("Pode falar, Sr. Nathanael.").then(() => modo && cicloVoz()); }
    else { pararOuvir(); calar(); }
  }
  if (modoBtn) modoBtn.addEventListener("click", () => setModo(!modo));

  /* ---------- ler respostas em voz alta (fora do modo voz) ---------- */
  window.addEventListener("hov:resposta", (e) => {
    const cfg = (window.HoV && window.HoV.config) || {};
    if (!modo && cfg.lerRespostas && e.detail && e.detail.texto) falar(e.detail.texto);
  });

  window.HoVVoz = { falar, calar, ouvir, vozes, escolherVoz, setModo, get modo() { return modo; } };
})();
