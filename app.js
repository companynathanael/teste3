// HORÁCIO — Etapa 1: apenas interface.
// A "resposta" abaixo é um marcador visual; a inteligência entra nas próximas etapas.

const $ = (s) => document.querySelector(s);
const input = $("#input");
const send = $("#send");
const form = $("#composer");
const welcome = $("#welcome");
const thread = $("#thread");
const stage = $("#stage");

/* Saudação, data e relógio */
function updateTime() {
  const now = new Date();
  const h = now.getHours();
  $("#greet").textContent = h < 5 ? "Boa noite" : h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  $("#dateLine").textContent = now.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  $("#clock").textContent = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
updateTime();
setInterval(updateTime, 15000);

/* Caixa de texto que cresce */
input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = input.scrollHeight + "px";
  send.disabled = !input.value.trim();
});
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
});

/* Mensagens */
const time = () => new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const scrollDown = () => stage.scrollTo({ top: stage.scrollHeight, behavior: "smooth" });

function addUser(text) {
  const el = document.createElement("div");
  el.className = "msg user";
  const b = document.createElement("div");
  b.className = "bubble";
  b.textContent = text;
  el.append(b);
  thread.append(el);
}

function addAi() {
  const el = document.createElement("div");
  el.className = "msg ai";
  el.innerHTML = `
    <div class="avatar"><img src="assets/mark.svg" alt="" /></div>
    <div class="body">
      <div class="name">HORÁCIO<span>${time()}</span></div>
      <div class="text"><span class="typing"><i></i><i></i><i></i></span></div>
    </div>`;
  thread.append(el);
  scrollDown();
  setTimeout(() => {
    el.querySelector(".text").textContent =
      "Entendido, Sr. Nathanael. Meu núcleo ainda está sendo construído — por enquanto, esta é apenas a interface.";
    scrollDown();
  }, 1400);
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  welcome.hidden = true;
  thread.hidden = false;
  addUser(text);
  addAi();
  input.value = "";
  input.style.height = "auto";
  send.disabled = true;
});

/* Nova conversa */
function reset() {
  thread.innerHTML = "";
  thread.hidden = true;
  welcome.hidden = false;
  input.focus();
}
$("#newChat").addEventListener("click", reset);
document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); reset(); }
});

/* Menu no celular */
const toggleMenu = (open) => document.body.classList.toggle("menu-open", open);
$("#openSidebar").addEventListener("click", () => toggleMenu(true));
$("#closeSidebar").addEventListener("click", () => toggleMenu(false));
$("#scrim").addEventListener("click", () => toggleMenu(false));
