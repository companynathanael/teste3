// HoV 1.0 — ferramentas do núcleo do Horácio.
// Cada ferramenta tem a definição para o Claude (input_schema) e um executor local.
// Tudo roda no navegador do Sr. Nathanael: nada é enviado a servidores além da API
// do Claude e, para as ferramentas do Miquéias, do Asafe (com as permissões dele).

(function () {
  /* =========================================================
     Armazenamento local (localStorage, com proteção)
     ========================================================= */
  const PREFIX = "hov.";
  const store = {
    get(k, d) { try { const v = localStorage.getItem(PREFIX + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(PREFIX + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  };
  const uid = (p) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const nowISO = () => new Date().toISOString();

  /* ---------- memória (o que o Horácio sabe sobre o Sr. Nathanael) ---------- */
  const memoria = {
    list: () => store.get("memoria", []),
    add(texto) { const m = memoria.list(); const item = { id: uid("m"), texto: String(texto).slice(0, 500), criada: nowISO() }; m.push(item); store.set("memoria", m.slice(-200)); return item; },
    remove(trecho) {
      const t = norm(trecho); const m = memoria.list();
      const keep = m.filter((x) => !norm(x.texto).includes(t));
      store.set("memoria", keep); return m.length - keep.length;
    },
    clear() { store.set("memoria", []); },
  };

  /* ---------- tarefas ---------- */
  const tarefas = {
    list: () => store.get("tarefas", []),
    save(l) { store.set("tarefas", l); window.dispatchEvent(new Event("hov:tarefas")); },
    add({ titulo, detalhes, prazo }) { const l = tarefas.list(); const t = { id: uid("t"), titulo: String(titulo).slice(0, 200), detalhes: detalhes ? String(detalhes).slice(0, 1000) : "", prazo: prazo || "", feita: false, criada: nowISO() }; l.push(t); tarefas.save(l); return t; },
    find(q) { const l = tarefas.list(); const n = norm(q); return l.find((t) => t.id === q) || l.find((t) => norm(t.titulo) === n) || l.find((t) => norm(t.titulo).includes(n)); },
    complete(q) { const l = tarefas.list(); const t = tarefas.find(q); if (!t) return null; const it = l.find((x) => x.id === t.id); it.feita = true; it.concluida = nowISO(); tarefas.save(l); return it; },
    toggle(id) { const l = tarefas.list(); const it = l.find((x) => x.id === id); if (it) { it.feita = !it.feita; it.concluida = it.feita ? nowISO() : null; tarefas.save(l); } },
    remove(id) { tarefas.save(tarefas.list().filter((x) => x.id !== id)); },
  };

  /* ---------- biblioteca (documentos, planilhas, imagens, vídeos, estudos) ---------- */
  const biblioteca = {
    list: () => store.get("biblioteca", []),
    add(item) {
      const l = biblioteca.list();
      const it = Object.assign({ id: uid("b"), criado: nowISO() }, item);
      l.unshift(it);
      // mantém dentro do limite do navegador: tira os mais antigos se não couber
      let lista = l.slice(0, 300);
      while (!store.set("biblioteca", lista) && lista.length > 1) lista = lista.slice(0, Math.floor(lista.length * 0.8));
      window.dispatchEvent(new Event("hov:biblioteca"));
      return it;
    },
    get: (id) => biblioteca.list().find((x) => x.id === id),
    remove(id) { store.set("biblioteca", biblioteca.list().filter((x) => x.id !== id)); window.dispatchEvent(new Event("hov:biblioteca")); },
  };

  function norm(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim(); }

  /* =========================================================
     Download de arquivos
     ========================================================= */
  function baixar(nome, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = nome;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "horacio";

  /* =========================================================
     Planilha .xlsx (Office Open XML, zip sem compressão)
     ========================================================= */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

  function zip(files) {
    const enc = new TextEncoder();
    const parts = []; const central = []; let offset = 0;
    for (const f of files) {
      const name = enc.encode(f.name); const data = typeof f.data === "string" ? enc.encode(f.data) : f.data;
      const crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true);
      parts.push(new Uint8Array(lh.buffer), name, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
      ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true);
      ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + data.length;
    }
    const csize = central.reduce((s, p) => s + p.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, csize, true); end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: "application/zip" });
  }

  const xmlEsc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
  const colName = (i) => { let s = ""; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };

  function cellXml(v, ref, header) {
    const st = header ? ' s="1"' : "";
    if (v === null || v === undefined || v === "") return `<c r="${ref}"${st}/>`;
    if (typeof v === "number" && isFinite(v)) return `<c r="${ref}"${st}><v>${v}</v></c>`;
    const s = String(v);
    if (!header && /^=/.test(s) && s.length > 1) return `<c r="${ref}"${st}><f>${xmlEsc(s.slice(1))}</f></c>`;
    if (!header && /^-?\d+([.,]\d+)?$/.test(s.trim()) && s.trim().length < 16) return `<c r="${ref}"${st}><v>${s.trim().replace(",", ".")}</v></c>`;
    return `<c r="${ref}" t="inlineStr"${st}><is><t xml:space="preserve">${xmlEsc(s)}</t></is></c>`;
  }

  function xlsx(abas) {
    const sheets = abas.map((a, i) => {
      const rows = [a.colunas || [], ...(a.linhas || [])];
      const widths = (a.colunas || []).map((c, ci) => Math.min(60, Math.max(10, ...rows.map((r) => String(r[ci] ?? "").length + 2))));
      const cols = widths.length ? `<cols>${widths.map((w, ci) => `<col min="${ci + 1}" max="${ci + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>` : "";
      const data = rows.map((r, ri) => `<row r="${ri + 1}">${(r || []).map((v, ci) => cellXml(v, colName(ci) + (ri + 1), ri === 0)).join("")}</row>`).join("");
      return {
        name: `xl/worksheets/sheet${i + 1}.xml`,
        data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${cols}<sheetData>${data}</sheetData></worksheet>`,
      };
    });
    const safeName = (n, i) => (String(n || `Aba ${i + 1}`).replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || `Aba ${i + 1}`);
    return zip([
      { name: "[Content_Types].xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${abas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>` },
      { name: "_rels/.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
      { name: "xl/workbook.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${abas.map((a, i) => `<sheet name="${xmlEsc(safeName(a.nome, i))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>` },
      { name: "xl/_rels/workbook.xml.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${abas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${abas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
      { name: "xl/styles.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF111111"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>` },
      ...sheets,
    ]);
  }

  function csv(aba) {
    const q = (v) => { const s = String(v ?? ""); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const rows = [aba.colunas || [], ...(aba.linhas || [])].map((r) => (r || []).map(q).join(";"));
    return new Blob(["﻿" + rows.join("\r\n")], { type: "text/csv;charset=utf-8" });
  }

  /* =========================================================
     Imagem SVG (com limpeza de segurança)
     ========================================================= */
  const SVG_BLOCK = new Set(["script", "foreignobject", "iframe", "object", "embed", "audio", "video", "canvas", "handler", "listener"]);
  function limparSvg(src) {
    const doc = new DOMParser().parseFromString(String(src), "image/svg+xml");
    const root = doc.documentElement;
    if (!root || root.nodeName.toLowerCase() !== "svg" || doc.getElementsByTagName("parsererror").length) throw new Error("SVG inválido.");
    const walk = (el) => {
      for (const ch of [...el.children]) {
        if (SVG_BLOCK.has(ch.localName.toLowerCase())) { ch.remove(); continue; }
        walk(ch);
      }
      for (const at of [...el.attributes]) {
        const n = at.name.toLowerCase(); const v = at.value.trim().toLowerCase();
        if (n.startsWith("on")) el.removeAttribute(at.name);
        else if ((n === "href" || n === "xlink:href") && !(v.startsWith("#") || v.startsWith("data:image/png") || v.startsWith("data:image/jpeg"))) el.removeAttribute(at.name);
        else if (/url\(\s*['"]?\s*(https?:|javascript:|\/\/)/i.test(at.value)) el.removeAttribute(at.name);
      }
      if (el.localName === "style") el.textContent = el.textContent.replace(/@import[^;]+;?/gi, "").replace(/url\(\s*['"]?\s*(https?:|javascript:|\/\/)[^)]*\)/gi, "none");
    };
    walk(root);
    if (!root.getAttribute("xmlns")) root.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    if (!root.getAttribute("viewBox") && root.getAttribute("width") && root.getAttribute("height")) root.setAttribute("viewBox", `0 0 ${parseFloat(root.getAttribute("width"))} ${parseFloat(root.getAttribute("height"))}`);
    return new XMLSerializer().serializeToString(root);
  }
  const svgUrl = (svg) => "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);

  function svgParaPng(svg, largura = 1600) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const ratio = img.naturalHeight && img.naturalWidth ? img.naturalHeight / img.naturalWidth : 1;
        const c = document.createElement("canvas"); c.width = largura; c.height = Math.round(largura * ratio);
        const ctx = c.getContext("2d"); ctx.drawImage(img, 0, 0, c.width, c.height);
        c.toBlob((b) => (b ? resolve(b) : reject(new Error("Falha ao gerar PNG."))), "image/png");
      };
      img.onerror = () => reject(new Error("Não consegui desenhar o SVG."));
      img.src = svgUrl(svg);
    });
  }

  /* =========================================================
     Vídeo (cena animada desenhada em canvas, gravada em WebM)
     ========================================================= */
  const EASE = { linear: (t) => t, suave: (t) => t * t * (3 - 2 * t), entrada: (t) => t * t, saida: (t) => 1 - (1 - t) * (1 - t) };
  const lerp = (a, b, t) => a + (b - a) * t;
  function hexRgb(c) { const m = /^#?([0-9a-f]{6})$/i.exec(String(c || "")); return m ? [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4), 16)] : null; }

  function prop(el, nome, t) {
    const qs = (el.quadros || []).filter((q) => q[nome] !== undefined).sort((a, b) => a.t - b.t);
    const base = el[nome];
    if (!qs.length) return base;
    if (t <= qs[0].t) return qs[0].t > 0 && base !== undefined ? base : qs[0][nome];
    for (let i = 0; i < qs.length - 1; i++) {
      const a = qs[i], b = qs[i + 1];
      if (t >= a.t && t <= b.t) {
        const k = (EASE[b.suavizar] || EASE.suave)((t - a.t) / Math.max(0.0001, b.t - a.t));
        if (typeof a[nome] === "number") return lerp(a[nome], b[nome], k);
        const ca = hexRgb(a[nome]), cb = hexRgb(b[nome]);
        if (ca && cb) return `rgb(${ca.map((v, j) => Math.round(lerp(v, cb[j], k))).join(",")})`;
        return k < 0.5 ? a[nome] : b[nome];
      }
    }
    return qs[qs.length - 1][nome];
  }

  function desenharCena(ctx, cena, t) {
    const W = cena.largura, H = cena.altura;
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = cena.fundo || "#000"; ctx.fillRect(0, 0, W, H);
    for (const el of cena.elementos || []) {
      const ini = el.inicio ?? 0, fim = el.fim ?? cena.duracao;
      if (t < ini || t > fim) continue;
      const lt = t - ini;
      const g = (n, d) => { const v = prop(el, n, lt); return v === undefined ? d : v; };
      const x = g("x", W / 2), y = g("y", H / 2), op = g("opacidade", 1), esc = g("escala", 1), rot = g("rotacao", 0);
      const cor = g("cor", "#ffffff");
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, op));
      ctx.translate(x, y); ctx.rotate((rot * Math.PI) / 180); ctx.scale(esc, esc);
      ctx.fillStyle = cor; ctx.strokeStyle = g("contorno", cor); ctx.lineWidth = g("espessura", 2);
      const w = g("largura", 100), h = g("altura", 100);
      switch (el.tipo) {
        case "texto": {
          const tam = g("tamanho", 48);
          ctx.font = `${el.peso || 600} ${tam}px ${el.fonte || "'Space Grotesk', Inter, sans-serif"}`;
          ctx.textAlign = el.alinhamento || "center"; ctx.textBaseline = "middle";
          const linhas = String(el.texto || "").split("\n");
          linhas.forEach((l, i) => ctx.fillText(l, 0, (i - (linhas.length - 1) / 2) * tam * 1.2));
          break;
        }
        case "retangulo": {
          const r = Math.min(g("raio", 0), w / 2, h / 2);
          ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-w / 2, -h / 2, w, h, r) : ctx.rect(-w / 2, -h / 2, w, h);
          el.vazado ? ctx.stroke() : ctx.fill(); break;
        }
        case "circulo": { ctx.beginPath(); ctx.arc(0, 0, g("raio", 50), 0, Math.PI * 2); el.vazado ? ctx.stroke() : ctx.fill(); break; }
        case "linha": { ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(w / 2, 0); ctx.stroke(); break; }
        case "anel": { ctx.beginPath(); ctx.arc(0, 0, g("raio", 50), 0, (Math.PI * 2 * g("progresso", 1))); ctx.stroke(); break; }
      }
      ctx.restore();
    }
    ctx.restore();
  }

  function normalizarCena(c) {
    const cena = Object.assign({ largura: 1280, altura: 720, duracao: 6, fps: 30, fundo: "#000000", elementos: [] }, c || {});
    cena.largura = Math.max(160, Math.min(1920, Math.round(+cena.largura || 1280)));
    cena.altura = Math.max(160, Math.min(1080, Math.round(+cena.altura || 720)));
    cena.duracao = Math.max(1, Math.min(30, +cena.duracao || 6));
    cena.fps = Math.max(10, Math.min(60, +cena.fps || 30));
    cena.elementos = (Array.isArray(cena.elementos) ? cena.elementos : []).slice(0, 80);
    return cena;
  }

  function playerVideo(cena) {
    const canvas = document.createElement("canvas");
    canvas.width = cena.largura; canvas.height = cena.altura;
    const ctx = canvas.getContext("2d");
    let raf = 0, start = 0;
    const frame = (ts) => {
      if (!start) start = ts;
      const t = ((ts - start) / 1000) % cena.duracao;
      desenharCena(ctx, cena, t);
      raf = requestAnimationFrame(frame);
    };
    desenharCena(ctx, cena, 0);
    return {
      canvas,
      play() { cancelAnimationFrame(raf); start = 0; raf = requestAnimationFrame(frame); },
      stop() { cancelAnimationFrame(raf); },
      gravar() {
        return new Promise((resolve, reject) => {
          if (!canvas.captureStream || typeof MediaRecorder === "undefined") return reject(new Error("Este navegador não grava vídeo do canvas."));
          const tipo = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m));
          if (!tipo) return reject(new Error("Este navegador não grava WebM."));
          cancelAnimationFrame(raf);
          const stream = canvas.captureStream(cena.fps);
          const rec = new MediaRecorder(stream, { mimeType: tipo, videoBitsPerSecond: 6_000_000 });
          const chunks = [];
          rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
          rec.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
          const t0 = performance.now();
          const tick = () => {
            const t = (performance.now() - t0) / 1000;
            desenharCena(ctx, cena, Math.min(t, cena.duracao));
            if (t < cena.duracao) raf = requestAnimationFrame(tick);
            else rec.stop();
          };
          rec.start(250);
          raf = requestAnimationFrame(tick);
        });
      },
    };
  }

  /* =========================================================
     JavaScript isolado (Web Worker sem rede, com tempo limite)
     ========================================================= */
  function executarJs(codigo, limite = 6000) {
    const prelude = `
      self.fetch = undefined; self.XMLHttpRequest = undefined; self.WebSocket = undefined;
      self.EventSource = undefined; self.importScripts = undefined; self.indexedDB = undefined;
      const __logs = [];
      const __fmt = (v) => { try { return typeof v === "string" ? v : JSON.stringify(v, (k, x) => typeof x === "bigint" ? x.toString() + "n" : x); } catch (e) { return String(v); } };
      self.console = { log: (...a) => __logs.push(a.map(__fmt).join(" ")), error: (...a) => __logs.push("ERRO: " + a.map(__fmt).join(" ")), warn: (...a) => __logs.push("AVISO: " + a.map(__fmt).join(" ")), table: (v) => __logs.push(__fmt(v)) };
      self.onmessage = async (e) => {
        try {
          const fn = new (Object.getPrototypeOf(async function () {}).constructor)(e.data);
          const r = await fn();
          self.postMessage({ ok: true, logs: __logs, result: r === undefined ? undefined : __fmt(r) });
        } catch (err) { self.postMessage({ ok: false, logs: __logs, error: String(err && err.stack || err) }); }
      };`;
    return new Promise((resolve) => {
      const url = URL.createObjectURL(new Blob([prelude], { type: "text/javascript" }));
      const w = new Worker(url);
      const done = (r) => { clearTimeout(timer); w.terminate(); URL.revokeObjectURL(url); resolve(r); };
      const timer = setTimeout(() => done({ ok: false, logs: [], error: `Tempo esgotado (${limite / 1000}s).` }), limite);
      w.onmessage = (e) => done(e.data);
      w.onerror = (e) => { e.preventDefault(); done({ ok: false, logs: [], error: e.message }); };
      w.postMessage(String(codigo));
    });
  }

  /* =========================================================
     Asafe / Miquéias
     ========================================================= */
  const asafe = () => window.horacioAsafe;
  async function pedirAgente(to, action, payload, opts = {}) {
    const H = asafe();
    if (!H || !H.link) throw new Error("O Horácio não está ligado ao Asafe.");
    if (H.link.status !== "online") throw new Error("O Asafe não está conectado. Abra o Asafe no mesmo navegador.");
    return H.link.request(to, action, payload, Object.assign({ timeout: 120000 }, opts));
  }

  /* =========================================================
     Definições para o Claude
     ========================================================= */
  const S = (props, required) => ({ type: "object", properties: props, required: required || Object.keys(props), additionalProperties: false });
  const str = (d) => ({ type: "string", description: d });

  const definicoes = [
    { name: "memoria_salvar", description: "Guarda um fato duradouro sobre o Sr. Nathanael ou suas preferências (ex.: 'prefere respostas curtas'). Use só para o que vale lembrar em conversas futuras.", input_schema: S({ fato: str("O fato, em uma frase.") }) },
    { name: "memoria_esquecer", description: "Apaga da memória os fatos que contêm o trecho dado.", input_schema: S({ trecho: str("Trecho do fato a esquecer.") }) },
    { name: "tarefa_criar", description: "Cria uma tarefa na lista do Sr. Nathanael.", input_schema: S({ titulo: str("Título curto."), detalhes: str("Detalhes (pode ser vazio)."), prazo: str("Prazo em texto livre ou AAAA-MM-DD (pode ser vazio).") }, ["titulo"]) },
    { name: "tarefa_listar", description: "Lista as tarefas (abertas e concluídas).", input_schema: S({}, []) },
    { name: "tarefa_concluir", description: "Marca uma tarefa como concluída, pelo id ou pelo título.", input_schema: S({ tarefa: str("Id ou título da tarefa.") }) },
    { name: "criar_documento", description: "Cria um documento na Biblioteca do Horácio: plano, projeto, relatório, dados, anotação ou estudo. O conteúdo é Markdown completo, bem estruturado, com títulos. O Sr. Nathanael pode abrir e baixar.", input_schema: S({ titulo: str("Título do documento."), tipo: { type: "string", enum: ["plano", "projeto", "relatorio", "dados", "anotacao", "estudo"] }, area: str("Área do estudo/projeto (ex.: matemática, física, governo, política, exercício físico, python, javascript). Pode ser vazio."), conteudo_markdown: str("Conteúdo completo em Markdown.") }, ["titulo", "tipo", "conteudo_markdown"]) },
    { name: "criar_planilha", description: "Cria uma planilha Excel (.xlsx) com uma ou mais abas. Valores que começam com '=' viram fórmulas do Excel, escritas com nomes em inglês (ex.: '=SUM(B2:B10)', '=AVERAGE(C2:C9)'). Números vão como número, não como texto.", input_schema: S({ titulo: str("Título da planilha."), abas: { type: "array", minItems: 1, items: S({ nome: str("Nome da aba (até 31 caracteres)."), colunas: { type: "array", items: { type: "string" } }, linhas: { type: "array", items: { type: "array", items: { type: ["string", "number", "null"] } } } }) } }) },
    { name: "gerar_imagem", description: "Gera uma imagem como SVG (ilustração vetorial, diagrama, logo, gráfico, cartaz). Escreva um SVG completo e bonito, com viewBox, sem scripts e sem imagens externas. Não gera fotos realistas.", input_schema: S({ titulo: str("Título da imagem."), svg: str("O código SVG completo.") }) },
    { name: "gerar_video", description: "Gera um vídeo animado (motion graphics) a partir de uma cena descrita em JSON: textos e formas que se movem. O Sr. Nathanael pode assistir e baixar em WebM. Não gera filmagem realista. Coordenadas em pixels; 'quadros' são keyframes com t em segundos (relativo ao início do elemento) e as propriedades animadas (x, y, opacidade, escala, rotacao em graus, cor '#rrggbb', largura, altura, raio, tamanho, progresso 0..1).", input_schema: S({ titulo: str("Título do vídeo."), cena: { type: "object", description: "{ largura, altura, duracao (1-30 s), fps, fundo '#rrggbb', elementos: [{ tipo: 'texto'|'retangulo'|'circulo'|'linha'|'anel', texto?, tamanho?, peso?, cor?, x?, y?, largura?, altura?, raio?, vazado?, espessura?, opacidade?, escala?, rotacao?, inicio?, fim?, quadros?: [{ t, ...props, suavizar?: 'linear'|'suave'|'entrada'|'saida' }] }] }" } }) },
    { name: "executar_javascript", description: "Executa JavaScript num ambiente isolado, sem rede, por até 6 s, para cálculos (matemática, física, estatística) ou para demonstrar código. Use console.log e/ou 'return' do resultado final.", input_schema: S({ codigo: str("Código JavaScript (corpo de função assíncrona).") }) },
    { name: "asafe_agentes", description: "Lista as IAs conectadas ao Asafe (o centro dos agentes da Nathanael Industries) e o que cada uma sabe fazer.", input_schema: S({}, []) },
    { name: "miqueias_pesquisar", description: "Pede ao Miquéias, pelo Asafe, uma pesquisa na web com fontes. Use quando o Sr. Nathanael pedir para pesquisar 'com o Miquéias' ou 'pelo Asafe'.", input_schema: S({ consulta: str("O que pesquisar.") }) },
    { name: "miqueias_perguntar", description: "Faz uma pergunta ao Miquéias (IA auxiliar) pelo Asafe e devolve a resposta dele.", input_schema: S({ pergunta: str("A pergunta.") }) },
    { name: "miqueias_executar", description: "Pede ao Miquéias que execute um objetivo na tela dele, em português (ex.: 'abra o laboratório de trade', 'ligue o piloto em ETH com RSI'). Ações protegidas pedem confirmação do Sr. Nathanael.", input_schema: S({ objetivo: str("O objetivo em português.") }) },
    { name: "miqueias_trade", description: "Consulta o Laboratório de Trade do Miquéias (dinheiro fictício): 'situacao' devolve conta, posição e diário; 'estudo' testa as estratégias (leva até 60 s).", input_schema: S({ acao: { type: "string", enum: ["situacao", "estudo"] } }) },
  ].map((d) => Object.assign({ eager_input_streaming: true }, d));

  /* ---------- validação das entradas (o servidor não valida com streaming antecipado) ---------- */
  function validar(schema, v, caminho = "entrada") {
    const tipos = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
    const tipoDe = (x) => (x === null ? "null" : Array.isArray(x) ? "array" : typeof x === "number" ? "number" : typeof x);
    if (tipos.length && !tipos.includes(tipoDe(v)) && !(tipos.includes("integer") && Number.isInteger(v))) throw new Error(`${caminho}: tipo inválido (esperado ${tipos.join("/")}).`);
    if (schema.enum && !schema.enum.includes(v)) throw new Error(`${caminho}: valor fora da lista (${schema.enum.join(", ")}).`);
    if (tipoDe(v) === "object" && schema.properties) {
      for (const r of schema.required || []) if (!(r in v)) throw new Error(`${caminho}: falta "${r}".`);
      for (const [k, sub] of Object.entries(schema.properties)) if (k in v && v[k] !== undefined) validar(sub, v[k], `${caminho}.${k}`);
    }
    if (tipoDe(v) === "array") {
      if (schema.minItems && v.length < schema.minItems) throw new Error(`${caminho}: lista vazia.`);
      if (schema.items) v.forEach((x, i) => validar(schema.items, x, `${caminho}[${i}]`));
    }
  }

  /* =========================================================
     Executores. Devolvem { texto, cartao? } — texto vai ao Claude.
     ui.confirmar(msg) → Promise<boolean> pede confirmação ao Sr. Nathanael.
     ========================================================= */
  const executores = {
    memoria_salvar: ({ fato }) => { const m = memoria.add(fato); return { texto: `Guardado na memória: "${m.texto}"`, chip: "memória atualizada" }; },
    memoria_esquecer: ({ trecho }) => { const n = memoria.remove(trecho); return { texto: n ? `${n} fato(s) esquecido(s).` : "Nada na memória com esse trecho.", chip: "memória atualizada" }; },
    tarefa_criar: (p) => { const t = tarefas.add(p); return { texto: `Tarefa criada (id ${t.id}): ${t.titulo}`, chip: `tarefa: ${t.titulo}` }; },
    tarefa_listar: () => { const l = tarefas.list(); return { texto: l.length ? l.map((t) => `${t.feita ? "[x]" : "[ ]"} ${t.titulo}${t.prazo ? ` (prazo: ${t.prazo})` : ""} — id ${t.id}`).join("\n") : "Nenhuma tarefa.", chip: "tarefas consultadas" }; },
    tarefa_concluir: ({ tarefa }) => { const t = tarefas.complete(tarefa); return { texto: t ? `Concluída: ${t.titulo}` : `Não encontrei a tarefa "${tarefa}".`, chip: t ? `concluída: ${t.titulo}` : "tarefa não encontrada" }; },
    criar_documento: (p) => { const it = biblioteca.add({ tipo: p.tipo === "estudo" ? "estudo" : "documento", subtipo: p.tipo, titulo: p.titulo, area: p.area || "", dados: { markdown: p.conteudo_markdown } }); return { texto: `Documento salvo na Biblioteca (id ${it.id}).`, cartao: { tipo: "documento", item: it } }; },
    criar_planilha: (p) => { const it = biblioteca.add({ tipo: "planilha", titulo: p.titulo, dados: { abas: p.abas } }); const n = p.abas.reduce((s, a) => s + (a.linhas || []).length, 0); return { texto: `Planilha criada com ${p.abas.length} aba(s) e ${n} linha(s) (id ${it.id}).`, cartao: { tipo: "planilha", item: it } }; },
    gerar_imagem: (p) => { const svg = limparSvg(p.svg); const it = biblioteca.add({ tipo: "imagem", titulo: p.titulo, dados: { svg } }); return { texto: `Imagem gerada e mostrada ao Sr. Nathanael (id ${it.id}).`, cartao: { tipo: "imagem", item: it } }; },
    gerar_video: (p) => { const cena = normalizarCena(p.cena); if (!cena.elementos.length) throw new Error("A cena não tem elementos."); const it = biblioteca.add({ tipo: "video", titulo: p.titulo, dados: { cena } }); return { texto: `Vídeo de ${cena.duracao}s pronto para assistir e baixar (id ${it.id}).`, cartao: { tipo: "video", item: it } }; },
    executar_javascript: async ({ codigo }) => {
      const r = await executarJs(codigo);
      const saida = [...(r.logs || []), r.ok ? (r.result !== undefined ? `→ ${r.result}` : "") : `ERRO: ${r.error}`].filter(Boolean).join("\n").slice(0, 8000);
      return { texto: saida || "(sem saída)", cartao: { tipo: "codigo", codigo, saida: saida || "(sem saída)", ok: r.ok } };
    },
    asafe_agentes: async () => {
      const H = asafe();
      if (!H || H.link.status !== "online") return { texto: "O Asafe não está conectado agora.", chip: "Asafe desconectado" };
      const r = await H.link.roster();
      return { texto: r.filter((a) => a.id !== "horacio").map((a) => `${a.name} (${a.id}): ${a.online ? "online" : "offline"}; ações: ${(a.actions || []).map((x) => x.name || x).join(", ")}`).join("\n") || "Nenhuma outra IA.", chip: "agentes consultados" };
    },
    miqueias_pesquisar: async ({ consulta }) => { const r = await pedirAgente("miqueias", "research.run", { query: consulta }, { timeout: 180000 }); const fontes = (r.sources || []).map((s, i) => `[${i + 1}] ${s.title || ""} ${s.url || ""}`).join("\n"); return { texto: `${r.reply || ""}${fontes ? `\n\nFontes:\n${fontes}` : ""}`.slice(0, 20000), chip: "pesquisa pelo Miquéias" }; },
    miqueias_perguntar: async ({ pergunta }) => { const r = await pedirAgente("miqueias", "chat.ask", { prompt: pergunta }); return { texto: String(r.reply || "(sem resposta)").slice(0, 20000), chip: "resposta do Miquéias" }; },
    miqueias_executar: async ({ objetivo }, ui) => {
      try {
        const r = await pedirAgente("miqueias", "agent.do", { goal: objetivo });
        return { texto: JSON.stringify({ feito: r.done, passos: r.steps, resultado: r.result }).slice(0, 8000), chip: `Miquéias: ${objetivo}` };
      } catch (e) {
        if (e.code !== "needs_confirmation") throw e;
        const ok = await ui.confirmar(`O Miquéias pede confirmação: ${e.message}`);
        if (!ok) return { texto: "O Sr. Nathanael não confirmou. Nada foi feito.", chip: "cancelado pelo senhor" };
        const r = await pedirAgente("miqueias", "agent.do", { goal: objetivo, confirm: true });
        return { texto: JSON.stringify({ feito: r.done, passos: r.steps, resultado: r.result }).slice(0, 8000), chip: `Miquéias: ${objetivo}` };
      }
    },
    miqueias_trade: async ({ acao }) => { const r = await pedirAgente("miqueias", acao === "estudo" ? "trade.study" : "trade.status", {}, { timeout: 120000 }); return { texto: JSON.stringify(r).slice(0, 12000), chip: acao === "estudo" ? "estudo de trade" : "situação do trade" }; },
  };

  async function executar(nome, entrada, ui) {
    const def = definicoes.find((d) => d.name === nome);
    if (!def) throw new Error(`Ferramenta desconhecida: ${nome}`);
    validar(def.input_schema, entrada || {});
    return executores[nome](entrada || {}, ui);
  }

  /* =========================================================
     Cartões (artefatos na conversa)
     ========================================================= */
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  const botao = (rotulo, fn) => { const b = h("button", "hov-btn mono", rotulo); b.type = "button"; b.onclick = fn; return b; };
  const md = (s) => (window.horacioAsafe && window.horacioAsafe.md ? window.horacioAsafe.md(s) : String(s).replace(/</g, "&lt;"));

  function htmlDoc(titulo, markdown) {
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${xmlEsc(titulo)}</title><style>body{font:16px/1.6 Georgia,serif;max-width:760px;margin:40px auto;padding:0 20px;color:#111}h1,h2,h3,h4{font-family:Helvetica,Arial,sans-serif}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:6px 10px}code{background:#f2f2f2;padding:1px 4px;border-radius:4px}pre{background:#f2f2f2;padding:12px;overflow:auto}</style></head><body><h1>${xmlEsc(titulo)}</h1>${md(markdown)}<hr><p style="color:#888;font-size:12px">Gerado pelo Horácio · HoV 1.0</p></body></html>`;
  }

  function abrirLeitor(titulo, markdown) {
    const box = h("div", "hov-reader");
    box.innerHTML = `<div class="hov-reader-card"><div class="hov-reader-head"><b></b><button type="button" class="hov-btn mono">Fechar</button></div><div class="hov-reader-body text md"></div></div>`;
    box.querySelector("b").textContent = titulo;
    box.querySelector(".hov-reader-body").innerHTML = md(markdown);
    box.querySelector("button").onclick = () => box.remove();
    box.addEventListener("click", (e) => { if (e.target === box) box.remove(); });
    document.body.append(box);
  }

  function cartao(c) {
    const it = c.item;
    const el = h("div", `hov-card hov-card-${c.tipo}`);
    const head = h("div", "hov-card-head");
    const rot = { documento: it && it.subtipo ? it.subtipo : "documento", estudo: "estudo", planilha: "planilha", imagem: "imagem", video: "vídeo", codigo: "javascript" }[c.tipo === "documento" && it && it.tipo === "estudo" ? "estudo" : c.tipo];
    head.append(h("span", "hov-card-tag mono", rot), h("span", "hov-card-title", it ? it.titulo : "Código"));
    if (it && it.area) head.append(h("span", "hov-card-area mono", it.area));
    el.append(head);
    const body = h("div", "hov-card-body"); const acts = h("div", "hov-card-acts");
    if (c.tipo === "documento") {
      const prev = h("div", "hov-doc-prev text md"); prev.innerHTML = md(it.dados.markdown.split("\n").slice(0, 14).join("\n"));
      body.append(prev);
      acts.append(botao("Abrir", () => abrirLeitor(it.titulo, it.dados.markdown)),
        botao("Baixar .md", () => baixar(`${slug(it.titulo)}.md`, new Blob([it.dados.markdown], { type: "text/markdown;charset=utf-8" }))),
        botao("Baixar .html", () => baixar(`${slug(it.titulo)}.html`, new Blob([htmlDoc(it.titulo, it.dados.markdown)], { type: "text/html;charset=utf-8" }))));
    } else if (c.tipo === "planilha") {
      const aba = it.dados.abas[0];
      const wrap = h("div", "md-table"); const table = h("table");
      const tr = h("tr"); (aba.colunas || []).forEach((col) => tr.append(h("th", "", col))); const thead = h("thead"); thead.append(tr); table.append(thead);
      const tb = h("tbody"); (aba.linhas || []).slice(0, 8).forEach((r) => { const row = h("tr"); (r || []).forEach((v) => row.append(h("td", "", v === null ? "" : String(v)))); tb.append(row); }); table.append(tb);
      wrap.append(table); body.append(wrap);
      const extra = it.dados.abas.length > 1 ? ` · ${it.dados.abas.length} abas` : "";
      if ((aba.linhas || []).length > 8 || extra) body.append(h("p", "hov-note mono", `${(aba.linhas || []).length} linhas na primeira aba${extra}`));
      acts.append(botao("Baixar .xlsx", () => baixar(`${slug(it.titulo)}.xlsx`, new Blob([xlsx(it.dados.abas)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }))),
        botao("Baixar .csv", () => baixar(`${slug(it.titulo)}.csv`, csv(aba))));
    } else if (c.tipo === "imagem") {
      const img = h("img", "hov-img"); img.alt = it.titulo; img.src = svgUrl(it.dados.svg); body.append(img);
      acts.append(botao("Baixar .svg", () => baixar(`${slug(it.titulo)}.svg`, new Blob([it.dados.svg], { type: "image/svg+xml" }))),
        botao("Baixar .png", async () => { try { baixar(`${slug(it.titulo)}.png`, await svgParaPng(it.dados.svg)); } catch (e) { alert(e.message); } }));
    } else if (c.tipo === "video") {
      const p = playerVideo(it.dados.cena); p.canvas.className = "hov-video"; body.append(p.canvas); p.play();
      const gravar = botao("Baixar .webm", async () => {
        gravar.disabled = true; const old = gravar.textContent; gravar.textContent = `Gravando ${it.dados.cena.duracao}s…`;
        try { baixar(`${slug(it.titulo)}.webm`, await p.gravar()); } catch (e) { alert(e.message); }
        gravar.textContent = old; gravar.disabled = false; p.play();
      });
      acts.append(botao("Reiniciar", () => p.play()), gravar);
    } else if (c.tipo === "codigo") {
      const pre = h("pre"); pre.append(h("code", "", c.codigo)); body.append(pre);
      body.append(h("pre", "hov-out" + (c.ok ? "" : " err"), c.saida));
    }
    el.append(body);
    if (acts.children.length) el.append(acts);
    return el;
  }

  window.HoVFerramentas = {
    definicoes, executar, cartao, abrirLeitor, baixar, slug, htmlDoc, xlsx, csv, svgUrl, svgParaPng, playerVideo, limparSvg, executarJs, normalizarCena,
    memoria, tarefas, biblioteca, store, norm,
  };
})();
