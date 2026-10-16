/**
 * Amigo Secreto — projeto Google Apps Script.
 *
 * O site é servido pelo próprio Apps Script (App da Web) e os dados ficam
 * numa planilha Google. Arquivos do projeto:
 *   Codigo.gs     página e funções chamadas pelo site
 *   Planilha.gs   leitura e gravação na planilha
 *   Seguranca.gs  sorteio, códigos, hash e cifra
 *   Index.html, Estilos.html, Script.html  interface
 *
 * Funções terminadas em "_" são privadas: o site não consegue chamá-las.
 */

var MIN_PARTICIPANTES = 3;
var MAX_PARTICIPANTES = 10;
var MAX_TENTATIVAS = 10;     // códigos errados por nome antes de bloquear
var MAX_FALHAS_CHAVE = 20;   // chaves de organizador erradas a cada 15 minutos

function doGet() {
  return HtmlService.createTemplateFromFile("Index")
    .evaluate()
    .setTitle("Amigo Secreto")
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}

function incluir_(arquivo) {
  return HtmlService.createHtmlOutputFromFile(arquivo).getContent();
}

/**
 * Execute uma vez pelo editor (botão Executar). Cria a planilha de dados,
 * a chave do organizador e o segredo interno, e mostra tudo no registro.
 */
function configurar() {
  var props = PropertiesService.getScriptProperties();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    var id = props.getProperty("SPREADSHEET_ID");
    ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.create("Amigo Secreto — dados");
    props.setProperty("SPREADSHEET_ID", ss.getId());
  }
  abaParticipantes_();
  if (!props.getProperty("SEGREDO_INTERNO")) props.setProperty("SEGREDO_INTERNO", gerarChave_(40));
  if (!props.getProperty("ORGANIZER_KEY")) props.setProperty("ORGANIZER_KEY", gerarChave_(16));

  console.log("Planilha de dados: " + ss.getUrl());
  console.log("Chave do organizador: " + props.getProperty("ORGANIZER_KEY"));
  console.log("Pronto! Agora publique em Implantar → Nova implantação → App da Web.");
}

// ---------- funções chamadas pelo site ----------

function revelarAmigo(nome, pin) {
  return executar_(function () {
    nome = String(nome || "");
    pin = String(pin || "").trim();
    if (!nome.trim() || !pin) throw erroUsuario_("Preencha seu nome e seu código pessoal.");

    var todos = lerParticipantes_();
    if (!todos.length) throw erroUsuario_("O sorteio ainda não foi feito. Aguarde o organizador.");
    var alvo = normalizarNome_(nome);
    var p = todos.filter(function (x) { return x.norm === alvo; })[0];
    var incorreto = "Nome ou código incorreto. Confira e tente novamente.";
    if (!p) throw erroUsuario_(incorreto);
    if (p.tentativas >= MAX_TENTATIVAS) {
      throw erroUsuario_("Muitas tentativas erradas para este nome. Peça ao organizador para liberar seu acesso.");
    }
    if (!igualSeguro_(sha256Hex_(p.salt + pin), p.hash)) {
      atualizarParticipante_(p, { tentativas: p.tentativas + 1 });
      throw erroUsuario_(incorreto);
    }
    if (!p.revelado) atualizarParticipante_(p, { revelado: agora_() });
    return { nome: p.nome, amigo: decifrar_(p.amigo, p.salt) };
  });
}

function entrarOrganizador(chave) {
  return executar_(function () {
    exigirChave_(chave);
    return { situacao: situacao_() };
  });
}

function criarSorteio(chave, nomes) {
  return executar_(function () {
    exigirChave_(chave);
    var lista = validarNomes_(nomes);
    if (lerParticipantes_().length) {
      throw erroUsuario_("Já existe um sorteio. Para fazer outro, apague o atual primeiro.");
    }

    // O sorteio acontece aqui no servidor: o site recebe só os códigos.
    var amigos = sortearSemRepetir_(lista);
    var criado = agora_();
    var codigos = [];
    var registros = lista.map(function (nome, i) {
      var pin = gerarPin_();
      var salt = gerarSalt_();
      codigos.push({ nome: nome, pin: pin });
      return {
        nome: nome,
        norm: normalizarNome_(nome),
        salt: salt,
        hash: sha256Hex_(salt + pin),
        amigo: cifrar_(amigos[i], salt),
        tentativas: 0,
        revelado: "",
        criado: criado,
      };
    });
    gravarParticipantes_(registros);
    return { codigos: codigos, situacao: situacao_() };
  });
}

function desbloquearParticipante(chave, nome) {
  return executar_(function () {
    exigirChave_(chave);
    atualizarParticipante_(participanteDoSorteio_(nome), { tentativas: 0 });
    return { situacao: situacao_() };
  });
}

/** Para quem perdeu o código: troca o código e mantém o mesmo amigo secreto. */
function gerarNovoCodigo(chave, nome) {
  return executar_(function () {
    exigirChave_(chave);
    var p = participanteDoSorteio_(nome);
    var amigo = decifrar_(p.amigo, p.salt);
    var pin = gerarPin_();
    var salt = gerarSalt_();
    atualizarParticipante_(p, { salt: salt, hash: sha256Hex_(salt + pin), amigo: cifrar_(amigo, salt), tentativas: 0 });
    return { codigos: [{ nome: p.nome, pin: pin }], situacao: situacao_() };
  });
}

function apagarSorteio(chave) {
  return executar_(function () {
    exigirChave_(chave);
    apagarParticipantes_();
    return { situacao: situacao_() };
  });
}

// ---------- regras internas ----------

/** Executa uma ação com trava (uma por vez) e esconde erros técnicos do site. */
function executar_(acao) {
  var trava = LockService.getScriptLock();
  if (!trava.tryLock(15000)) throw new Error("O sistema está ocupado. Tente de novo em alguns segundos.");
  try {
    return acao();
  } catch (e) {
    if (e && e.usuario) throw e;
    console.error(e);
    throw new Error("Ocorreu um erro inesperado. Tente novamente.");
  } finally {
    trava.releaseLock();
  }
}

function erroUsuario_(mensagem) {
  var e = new Error(mensagem);
  e.usuario = true;
  return e;
}

function exigirChave_(chave) {
  var cache = CacheService.getScriptCache();
  var falhas = Number(cache.get("falhas_chave")) || 0;
  if (falhas >= MAX_FALHAS_CHAVE) {
    throw erroUsuario_("Muitas tentativas com a chave errada. Aguarde 15 minutos e tente de novo.");
  }
  var correta = PropertiesService.getScriptProperties().getProperty("ORGANIZER_KEY") || "";
  if (correta.length < 12) {
    throw erroUsuario_("A chave do organizador não está configurada. Execute a função configurar no Apps Script.");
  }
  // Compara os hashes para o tempo da comparação não depender do tamanho da chave digitada.
  if (!igualSeguro_(sha256Hex_(String(chave || "")), sha256Hex_(correta))) {
    cache.put("falhas_chave", String(falhas + 1), 15 * 60);
    throw erroUsuario_("Chave do organizador incorreta.");
  }
}

function validarNomes_(nomes) {
  if (!Array.isArray(nomes)) throw erroUsuario_("Lista de participantes inválida.");
  var lista = nomes.map(limparNome_).filter(Boolean);
  if (lista.length < MIN_PARTICIPANTES || lista.length > MAX_PARTICIPANTES) {
    throw erroUsuario_("O sorteio precisa ter de " + MIN_PARTICIPANTES + " a " + MAX_PARTICIPANTES + " participantes.");
  }
  if (lista.some(function (n) { return n.length > 80; })) {
    throw erroUsuario_("Cada nome pode ter no máximo 80 caracteres.");
  }
  // Evita que a planilha interprete um nome como fórmula.
  if (lista.some(function (n) { return /^[=+\-@]/.test(n); })) {
    throw erroUsuario_("Os nomes não podem começar com =, +, - ou @.");
  }
  if (new Set(lista.map(normalizarNome_)).size !== lista.length) {
    throw erroUsuario_("Há nomes repetidos. Maiúsculas e acentos não contam como diferença: use sobrenomes para diferenciar.");
  }
  return lista;
}

function participanteDoSorteio_(nome) {
  var p = buscarParticipante_(String(nome || ""));
  if (!p) throw erroUsuario_("Participante não encontrado. Atualize a página e tente de novo.");
  return p;
}

/** Resumo para o organizador: quem já viu e quem está bloqueado. Nunca inclui os pares. */
function situacao_() {
  var lista = lerParticipantes_();
  return {
    existe: lista.length > 0,
    url: ScriptApp.getService().getUrl(),
    participantes: lista.map(function (p) {
      return { nome: p.nome, revelou: Boolean(p.revelado), bloqueado: p.tentativas >= MAX_TENTATIVAS };
    }),
  };
}

function agora_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");
}
