/**
 * Acesso à planilha. Cada participante é uma linha da aba "Participantes".
 * O amigo secreto fica cifrado e o código pessoal fica só como hash.
 */

var ABA_PARTICIPANTES = "Participantes";
var COLUNAS = ["nome", "nome_normalizado", "salt", "pin_hash", "amigo_cifrado", "tentativas_erradas", "revelado_em", "criado_em"];
var CAMPOS = ["nome", "norm", "salt", "hash", "amigo", "tentativas", "revelado", "criado"];

/** Usa a planilha onde o script está (se foi criado por Extensões → Apps Script) ou a criada por configurar. */
function planilha_() {
  var ativa = SpreadsheetApp.getActiveSpreadsheet();
  if (ativa) return ativa;
  var id = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
  if (!id) throw erroUsuario_("O projeto ainda não foi configurado. Execute a função configurar no Apps Script.");
  return SpreadsheetApp.openById(id);
}

function abaParticipantes_() {
  var ss = planilha_();
  var aba = ss.getSheetByName(ABA_PARTICIPANTES);
  if (aba) return aba;

  // Numa planilha nova, reaproveita a primeira aba vazia em vez de criar outra.
  var abas = ss.getSheets();
  if (abas.length === 1 && abas[0].getLastRow() === 0) {
    aba = abas[0].setName(ABA_PARTICIPANTES);
  } else {
    aba = ss.insertSheet(ABA_PARTICIPANTES);
  }
  aba.getRange(1, 1, 1, COLUNAS.length).setValues([COLUNAS]).setFontWeight("bold");
  aba.setFrozenRows(1);
  return aba;
}

function lerParticipantes_() {
  var aba = abaParticipantes_();
  var total = aba.getLastRow() - 1;
  if (total < 1) return [];
  return aba.getRange(2, 1, total, COLUNAS.length).getValues()
    .map(function (linha, i) {
      var p = { linha: i + 2 };
      CAMPOS.forEach(function (campo, c) { p[campo] = String(linha[c]); });
      p.tentativas = Number(p.tentativas) || 0;
      return p;
    })
    .filter(function (p) { return p.norm; });
}

function buscarParticipante_(nome) {
  var alvo = normalizarNome_(nome);
  return lerParticipantes_().filter(function (p) { return p.norm === alvo; })[0] || null;
}

function gravarParticipantes_(registros) {
  var valores = registros.map(function (r) {
    return CAMPOS.map(function (campo) { return r[campo]; });
  });
  var intervalo = abaParticipantes_().getRange(2, 1, valores.length, COLUNAS.length);
  intervalo.setNumberFormat("@"); // tudo como texto: nomes só com números e hashes não viram número
  intervalo.setValues(valores);
}

function atualizarParticipante_(p, campos) {
  var aba = abaParticipantes_();
  Object.keys(campos).forEach(function (campo) {
    aba.getRange(p.linha, CAMPOS.indexOf(campo) + 1).setValue(campos[campo]);
    p[campo] = campos[campo];
  });
}

function apagarParticipantes_() {
  var aba = abaParticipantes_();
  var total = aba.getLastRow() - 1;
  if (total > 0) aba.getRange(2, 1, total, COLUNAS.length).clearContent();
}
