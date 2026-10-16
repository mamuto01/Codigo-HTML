/**
 * Amigo Secreto — backend em Google Apps Script usando a planilha como banco de dados.
 *
 * Configuração (detalhes no README):
 *  1. Crie uma planilha Google e abra Extensões → Apps Script.
 *  2. Cole este arquivo, salve e execute a função `configurar` uma vez.
 *  3. Em Configurações do projeto → Propriedades do script, crie ORGANIZER_KEY
 *     com uma chave de pelo menos 12 caracteres.
 *  4. Implantar → Nova implantação → App da Web, executar como "Eu",
 *     acesso "Qualquer pessoa". Copie a URL /exec para o app.js.
 */

var ABA_SORTEIO = "Sorteio";
var ABA_PARTICIPANTES = "Participantes";
var CABECALHO_PARTICIPANTES = ["nome", "nome_normalizado", "salt", "pin_hash", "amigo", "tentativas_erradas", "criado_em"];
var MIN_PARTICIPANTES = 3;
var MAX_PARTICIPANTES = 10;
var MAX_TENTATIVAS = 10;

// Colunas (base 0) da aba Participantes.
var COL = { nome: 0, norm: 1, salt: 2, hash: 3, amigo: 4, tentativas: 5 };

function configurar() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sorteio = ss.getSheetByName(ABA_SORTEIO) || ss.insertSheet(ABA_SORTEIO);
  if (sorteio.getLastRow() === 0) sorteio.appendRow(["criado_em"]);
  var participantes = ss.getSheetByName(ABA_PARTICIPANTES) || ss.insertSheet(ABA_PARTICIPANTES);
  if (participantes.getLastRow() === 0) participantes.appendRow(CABECALHO_PARTICIPANTES);
  return "Planilha pronta.";
}

function doGet() {
  return responder({ ok: true, servico: "amigo-secreto" });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (_) {
    return responder({ error: "O serviço está ocupado. Tente de novo em alguns segundos." });
  }
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    if (body.action === "create") return responder(criarSorteio(body));
    if (body.action === "reveal") return responder(revelar(body));
    return responder({ error: "Ação desconhecida." });
  } catch (err) {
    if (err && err.usuario) return responder({ error: err.message });
    console.error(err);
    return responder({ error: "Ocorreu um erro inesperado. Tente novamente." });
  } finally {
    lock.releaseLock();
  }
}

function criarSorteio(body) {
  var chaveCorreta = PropertiesService.getScriptProperties().getProperty("ORGANIZER_KEY") || "";
  if (chaveCorreta.length < 12) {
    throw erroUsuario("A chave do organizador ainda não foi configurada no Apps Script (ORGANIZER_KEY).");
  }
  if (!igualSeguro(String(body.organizer_key || ""), chaveCorreta)) {
    throw erroUsuario("Chave do organizador incorreta.");
  }

  var nomes = Array.isArray(body.names) ? body.names.map(function (n) { return String(n || "").trim().replace(/\s+/g, " "); }) : [];
  if (nomes.length < MIN_PARTICIPANTES || nomes.length > MAX_PARTICIPANTES) {
    throw erroUsuario("O sorteio precisa ter de " + MIN_PARTICIPANTES + " a " + MAX_PARTICIPANTES + " participantes.");
  }
  if (nomes.some(function (n) { return !n || n.length > 80; })) {
    throw erroUsuario("Confira os nomes: eles não podem estar vazios nem ter mais de 80 caracteres.");
  }
  // Evita que a planilha interprete um nome como fórmula.
  if (nomes.some(function (n) { return /^[=+\-@]/.test(n); })) {
    throw erroUsuario("Os nomes não podem começar com =, +, - ou @.");
  }
  var normalizados = nomes.map(normalizar);
  if (new Set(normalizados).size !== nomes.length) {
    throw erroUsuario("Os nomes precisam ser únicos (acentos e maiúsculas não contam como diferença).");
  }

  configurar();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var abaSorteio = ss.getSheetByName(ABA_SORTEIO);
  if (abaSorteio.getLastRow() > 1) {
    throw erroUsuario("Já existe um sorteio criado. Para fazer outro, apague as linhas das abas Sorteio e Participantes (mantendo o cabeçalho).");
  }

  // O sorteio acontece aqui no servidor: o navegador recebe só os códigos.
  var amigos = sortearSemRepetir(nomes);
  var agora = new Date();
  var codigos = [];
  var linhas = nomes.map(function (nome, i) {
    var pin = gerarPin();
    var salt = Utilities.getUuid();
    codigos.push({ name: nome, pin: pin });
    return [nome, normalizados[i], salt, sha256(salt + pin), amigos[i], 0, agora];
  });

  var abaParticipantes = ss.getSheetByName(ABA_PARTICIPANTES);
  var intervalo = abaParticipantes.getRange(2, 1, linhas.length, CABECALHO_PARTICIPANTES.length);
  intervalo.setNumberFormat("@"); // guarda tudo como texto (ex.: nomes só com números)
  intervalo.setValues(linhas);
  abaSorteio.appendRow([agora]);
  return { ok: true, codes: codigos };
}

function revelar(body) {
  var nome = String(body.name || "");
  var pin = String(body.pin || "").trim();
  var incorreto = "Nome ou código incorreto. Confira os dados e tente novamente.";
  if (!nome.trim() || !pin) throw erroUsuario("Informe o nome e o código pessoal.");

  var aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ABA_PARTICIPANTES);
  if (!aba || aba.getLastRow() < 2) throw erroUsuario("O sorteio ainda não foi criado.");
  var dados = aba.getRange(2, 1, aba.getLastRow() - 1, CABECALHO_PARTICIPANTES.length).getValues();

  var alvo = normalizar(nome);
  for (var i = 0; i < dados.length; i++) {
    var linha = dados[i];
    if (String(linha[COL.norm]) !== alvo) continue;

    var tentativas = Number(linha[COL.tentativas]) || 0;
    if (tentativas >= MAX_TENTATIVAS) {
      throw erroUsuario("Muitas tentativas erradas para este nome. Peça ao organizador para liberar o acesso.");
    }
    if (!igualSeguro(sha256(String(linha[COL.salt]) + pin), String(linha[COL.hash]))) {
      aba.getRange(i + 2, COL.tentativas + 1).setValue(tentativas + 1);
      throw erroUsuario(incorreto);
    }
    return { assigned_name: String(linha[COL.amigo]) };
  }
  throw erroUsuario(incorreto);
}

// ---------- utilidades ----------

function responder(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function erroUsuario(msg) {
  var e = new Error(msg);
  e.usuario = true;
  return e;
}

// Ignora maiúsculas, acentos e espaços repetidos: "  JOÃO  silva" == "joao silva".
function normalizar(s) {
  return String(s).trim().replace(/\s+/g, " ").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function sha256(texto) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, texto, Utilities.Charset.UTF_8);
  return bytes.map(function (b) { return ((b + 256) % 256).toString(16).padStart(2, "0"); }).join("");
}

function igualSeguro(a, b) {
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// 32 bits aleatórios a partir de um UUID v4 (gerado com SecureRandom pelo Google).
function aleatorio32() {
  return parseInt(Utilities.getUuid().replace(/-/g, "").slice(0, 8), 16);
}

// Inteiro uniforme em [0, n), sem viés de módulo.
function aleatorioAte(n) {
  var max = 0x100000000;
  var limite = max - (max % n);
  var x;
  do { x = aleatorio32(); } while (x >= limite);
  return x % n;
}

function gerarPin() {
  return String(100000 + aleatorioAte(900000));
}

function embaralhar(lista) {
  var a = lista.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = aleatorioAte(i + 1);
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

// Embaralha até ninguém tirar a si mesmo (uniforme entre os sorteios válidos).
function sortearSemRepetir(nomes) {
  for (var tentativa = 0; tentativa < 10000; tentativa++) {
    var r = embaralhar(nomes);
    if (nomes.every(function (n, i) { return n !== r[i]; })) return r;
  }
  throw erroUsuario("Não foi possível concluir o sorteio. Tente novamente.");
}
