// Cole aqui a URL do App da Web do Apps Script (termina em /exec). Veja o README.
const APPS_SCRIPT_URL = "COLE_AQUI_A_URL_DO_APPS_SCRIPT";
let latestCodes = [];

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
  if (!APPS_SCRIPT_URL.startsWith("https://script.google.com/")) {
    throw new Error("O site ainda não está conectado à planilha. Siga o README para configurar o Apps Script.");
  }
  let res;
  try {
    // Sem cabeçalhos personalizados: o corpo vai como text/plain e o navegador
    // não faz a checagem prévia de CORS, que o Apps Script não aceita.
    res = await fetch(APPS_SCRIPT_URL, { method: "POST", body: JSON.stringify(payload) });
  } catch (_) {
    throw new Error("Falha ao comunicar com o serviço. Verifique sua internet e tente de novo.");
  }
  let data;
  try { data = await res.json(); } catch (_) {
    throw new Error("O serviço respondeu de forma inesperada. Confira se a implantação do Apps Script permite acesso a \"Qualquer pessoa\".");
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
async function createDraw() {
  hideNotice("organizerNotice");
  document.getElementById("codesArea").classList.add("hidden");
  const key = document.getElementById("organizerKey").value;
  const names = document.getElementById("names").value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (!key) return notice("organizerNotice", "Digite a chave do organizador.", "error");
  if (names.length < 3) return notice("organizerNotice", "Adicione pelo menos 3 participantes para fazer o sorteio.", "error");
  if (names.length > 10) return notice("organizerNotice", "Este site está configurado para até 10 participantes.", "error");
  const normalized = names.map(n => n.replace(/\s+/g, " ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR"));
  if (new Set(normalized).size !== names.length) return notice("organizerNotice", "Há nomes repetidos. Deixe cada participante com um nome único.", "error");
  if (names.some(n => n.length > 80)) return notice("organizerNotice", "Cada nome deve ter até 80 caracteres.", "error");

  const btn = document.getElementById("createBtn");
  btn.disabled = true; btn.textContent = "Preparando o sorteio...";
  try {
    // O sorteio é feito no Apps Script: o navegador só recebe os códigos, nunca os pares.
    const data = await callFunction({ action:"create", organizer_key:key, names });
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
