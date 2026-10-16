// Configure estes dois valores no painel Supabase antes de publicar.
const SUPABASE_URL = "COLE_AQUI_A_URL_DO_SEU_PROJETO";
const SUPABASE_ANON_KEY = "COLE_AQUI_A_CHAVE_PUBLICA_ANON";
let sb = null;
let latestCodes = [];

function client() {
  if (!SUPABASE_URL.startsWith("https://") || SUPABASE_ANON_KEY.startsWith("COLE_AQUI")) {
    throw new Error("O site ainda não está conectado ao banco de dados. Siga o README para configurar o Supabase.");
  }
  if (!sb) sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return sb;
}
function showTab(which) {
  document.getElementById("participar").classList.toggle("hidden", which !== "participar");
  document.getElementById("organizar").classList.toggle("hidden", which !== "organizar");
  document.getElementById("tab-participar").classList.toggle("active", which === "participar");
  document.getElementById("tab-organizar").classList.toggle("active", which === "organizar");
}
function notice(id, message, type="info") {
  const el = document.getElementById(id);
  el.textContent = message;
  el.className = `notice show ${type}`;
}
function hideNotice(id) {
  const el = document.getElementById(id);
  el.className = "notice";
  el.textContent = "";
}
async function callFunction(payload) {
  const { data, error } = await client().functions.invoke("amigo-secreto", { body: payload });
  if (error) {
    let detail = error.message || "Falha ao comunicar com o serviço.";
    try { if (error.context) { const j = await error.context.json(); if (j.error) detail = j.error; } } catch (_) {}
    throw new Error(detail);
  }
  if (data && data.error) throw new Error(data.error);
  return data;
}
async function reveal() {
  hideNotice("participantNotice");
  document.getElementById("result").classList.add("hidden");
  const name = document.getElementById("participantName").value.trim();
  const pin = document.getElementById("participantPin").value.trim();
  if (!name || !pin) return notice("participantNotice", "Preencha seu nome e seu código pessoal.", "error");
  const btn = document.getElementById("revealBtn");
  btn.disabled = true; btn.textContent = "Consultando seu resultado...";
  try {
    const data = await callFunction({ action:"reveal", name, pin });
    document.getElementById("resultName").textContent = data.assigned_name;
    document.getElementById("result").classList.remove("hidden");
    notice("participantNotice", "Pronto! Este é seu resultado registrado. Não conte para ninguém 🤫");
  } catch (e) {
    notice("participantNotice", e.message || "Não foi possível consultar o resultado.", "error");
  } finally {
    btn.disabled = false; btn.textContent = "Revelar meu amigo secreto ✨";
  }
}
function randomPin() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return String(100000 + (a[0] % 900000));
}
function secureShuffle(array) {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const rand = new Uint32Array(1);
    const max = 0x100000000;
    const limit = max - (max % (i + 1));
    let x;
    do { crypto.getRandomValues(rand); x = rand[0]; } while (x >= limit);
    const j = x % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function makeDerangement(names) {
  // Fisher-Yates até encontrar uma permutação sem ninguém tirar a si mesmo.
  // Para até 10 pessoas, isto é rápido; limite de tentativas como proteção.
  for (let attempt = 0; attempt < 100000; attempt++) {
    const shuffled = secureShuffle(names);
    if (names.every((n, i) => n !== shuffled[i])) return shuffled;
  }
  throw new Error("Não foi possível concluir o sorteio. Tente novamente.");
}
async function createDraw() {
  hideNotice("organizerNotice");
  document.getElementById("codesArea").classList.add("hidden");
  const key = document.getElementById("organizerKey").value;
  const names = document.getElementById("names").value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (key.length < 12) return notice("organizerNotice", "Use uma chave do organizador com pelo menos 12 caracteres.", "error");
  if (names.length < 3) return notice("organizerNotice", "Adicione pelo menos 3 participantes para fazer o sorteio.", "error");
  if (names.length > 10) return notice("organizerNotice", "Este site está configurado para até 10 participantes.", "error");
  const normalized = names.map(n => n.toLocaleLowerCase("pt-BR"));
  if (new Set(normalized).size !== names.length) return notice("organizerNotice", "Há nomes repetidos. Deixe cada participante com um nome único.", "error");
  if (names.some(n => n.length > 80)) return notice("organizerNotice", "Cada nome deve ter até 80 caracteres.", "error");

  const btn = document.getElementById("createBtn");
  btn.disabled = true; btn.textContent = "Preparando o sorteio...";
  try {
    // Os pares são enviados para a função protegida; a interface do organizador não os exibe.
    const targets = makeDerangement(names);
    const participants = names.map((name, i) => ({ name, pin: randomPin(), assigned_name: targets[i] }));
    const data = await callFunction({ action:"create", organizer_key:key, participants });
    latestCodes = data.codes || [];
    const area = document.getElementById("codesList");
    area.innerHTML = "";
    latestCodes.forEach((p) => {
      const row = document.createElement("div");
      row.className = "participant-row";
      const n = document.createElement("input"); n.readOnly = true; n.value = p.name; n.setAttribute("aria-label","Nome do participante");
      const c = document.createElement("input"); c.readOnly = true; c.value = p.pin; c.setAttribute("aria-label","Código pessoal");
      row.append(n,c); area.appendChild(row);
    });
    document.getElementById("codesArea").classList.remove("hidden");
    notice("organizerNotice", "Sorteio criado! Agora entregue cada código individualmente. Não é possível criar outro sorteio por cima deste.", "info");
  } catch (e) {
    notice("organizerNotice", e.message || "Não foi possível criar o sorteio.", "error");
  } finally {
    btn.disabled = false; btn.textContent = "Criar sorteio e gerar códigos";
  }
}
async function copyCodes() {
  const text = latestCodes.map(p => `${p.name}: ${p.pin}`).join("\n");
  try {
    await navigator.clipboard.writeText(text);
    notice("organizerNotice", "Lista de códigos copiada. Envie cada código em particular.", "info");
  } catch (_) {
    notice("organizerNotice", "Seu navegador não permitiu copiar automaticamente. Selecione e copie os códigos manualmente.", "error");
  }
}
