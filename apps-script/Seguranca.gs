/**
 * Sorteio, códigos pessoais, hash e cifra.
 * A aleatoriedade vem de Utilities.getUuid() (UUID v4, gerado com SecureRandom pelo Google).
 */

// ---------- nomes ----------

/** Tira espaços das pontas e espaços repetidos: "  Ana   Silva " → "Ana Silva". */
function limparNome_(nome) {
  return String(nome || "").trim().replace(/\s+/g, " ");
}

/** Chave de busca: ignora maiúsculas, acentos e espaços extras ("  JOAO " == "João"). */
function normalizarNome_(nome) {
  return limparNome_(nome).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

// ---------- aleatoriedade ----------

function aleatorio32_() {
  return parseInt(Utilities.getUuid().replace(/-/g, "").slice(0, 8), 16);
}

/** Inteiro uniforme em [0, n), sem viés de módulo. */
function aleatorioAte_(n) {
  var max = 0x100000000;
  var limite = max - (max % n);
  var x;
  do { x = aleatorio32_(); } while (x >= limite);
  return x % n;
}

function gerarPin_() {
  return String(100000 + aleatorioAte_(900000));
}

function gerarSalt_() {
  return Utilities.getUuid().replace(/-/g, "");
}

/** Chave legível, sem caracteres que se confundem (0/O, 1/l/I). */
function gerarChave_(tamanho) {
  var letras = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  var chave = "";
  for (var i = 0; i < tamanho; i++) chave += letras.charAt(aleatorioAte_(letras.length));
  return chave;
}

// ---------- sorteio ----------

function embaralhar_(lista) {
  var a = lista.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = aleatorioAte_(i + 1);
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

/** Embaralha até ninguém tirar a si mesmo (todos os sorteios válidos têm a mesma chance). */
function sortearSemRepetir_(nomes) {
  for (var tentativa = 0; tentativa < 10000; tentativa++) {
    var r = embaralhar_(nomes);
    if (nomes.every(function (n, i) { return n !== r[i]; })) return r;
  }
  throw erroUsuario_("Não foi possível concluir o sorteio. Tente novamente.");
}

// ---------- hash ----------

function sha256Bytes_(texto) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, texto, Utilities.Charset.UTF_8);
}

function sha256Hex_(texto) {
  return sha256Bytes_(texto).map(function (b) { return ((b + 256) % 256).toString(16).padStart(2, "0"); }).join("");
}

function igualSeguro_(a, b) {
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ---------- cifra do amigo secreto ----------
// Quem abre a planilha vê só um texto embaralhado na coluna amigo_cifrado.
// A chave fica na propriedade SEGREDO_INTERNO: não apague essa propriedade.

function segredoInterno_() {
  var segredo = PropertiesService.getScriptProperties().getProperty("SEGREDO_INTERNO");
  if (!segredo) throw erroUsuario_("O projeto ainda não foi configurado. Execute a função configurar no Apps Script.");
  return segredo;
}

/** XOR com um fluxo de SHA-256(segredo | salt | bloco): cifrar e decifrar são a mesma operação. */
function xorFluxo_(bytes, salt) {
  var segredo = segredoInterno_();
  var saida = [];
  var bloco = [];
  for (var i = 0; i < bytes.length; i++) {
    if (i % 32 === 0) bloco = sha256Bytes_("amigo|" + segredo + "|" + salt + "|" + (i / 32));
    saida.push(((bytes[i] ^ bloco[i % 32]) << 24) >> 24);
  }
  return saida;
}

function cifrar_(texto, salt) {
  var bytes = Utilities.newBlob("").setDataFromString(texto, "UTF-8").getBytes();
  return Utilities.base64Encode(xorFluxo_(bytes, salt));
}

function decifrar_(cifrado, salt) {
  return Utilities.newBlob(xorFluxo_(Utilities.base64Decode(cifrado), salt)).getDataAsString("UTF-8");
}
