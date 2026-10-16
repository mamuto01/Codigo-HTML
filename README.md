# Amigo Secreto 🎁 — Google Apps Script

Site de amigo secreto feito **inteiramente no Google Apps Script**. O próprio Apps Script publica o site
(App da Web) e os dados ficam numa **planilha Google**. Não é preciso Netlify, Supabase nem hospedagem.

- Até 10 participantes, um único link para todos.
- Cada pessoa recebe um código pessoal de 6 números e vê **só o próprio resultado**.
- O organizador acompanha quem já viu, gera um código novo para quem perdeu o seu e libera quem ficou bloqueado. Ele nunca vê os pares.
- Botões para copiar a mensagem de cada pessoa ou enviá-la direto pelo WhatsApp.

## Arquivos (pasta `apps-script/`)

| Arquivo | O que faz |
|---|---|
| `Codigo.gs` | Abre a página, tem a função `configurar` e as funções chamadas pelo site |
| `Planilha.gs` | Lê e grava os participantes na planilha |
| `Seguranca.gs` | Sorteio, geração de códigos, hash e cifra |
| `Index.html` | Estrutura da página |
| `Estilos.html` | Visual (CSS) |
| `Script.html` | Comportamento da página (JavaScript) |
| `appsscript.json` | Manifesto do projeto: fuso horário e opções do App da Web |

## Como montar

### 1. Criar o projeto
Escolha **uma** das opções:
- **Com a planilha junto (recomendado):** crie uma planilha em https://sheets.new e abra **Extensões → Apps Script**.
- **Projeto independente:** crie em https://script.new. A função `configurar` cria a planilha de dados sozinha.

### 2. Copiar os arquivos
No editor do Apps Script:
1. Apague o conteúdo do arquivo `Código.gs` e cole o conteúdo de `Codigo.gs`.
2. Clique em **+ → Script** e crie `Planilha` e `Seguranca`. Cole o conteúdo de cada arquivo `.gs` correspondente.
3. Clique em **+ → HTML** e crie `Index`, `Estilos` e `Script`. Cole o conteúdo de cada arquivo `.html` correspondente.
   Os nomes precisam ser exatamente esses, porque o `Index` inclui os outros dois pelo nome.
4. (Opcional) Em **Configurações do projeto**, marque "Mostrar arquivo de manifesto appsscript.json" e cole o conteúdo de `appsscript.json`.
5. Salve (Ctrl+S).

> Quem usa o [clasp](https://github.com/google/clasp) pode configurar o `rootDir` como `apps-script` e enviar tudo com `clasp push`.

### 3. Configurar
1. No seletor de funções, no topo do editor, escolha **`configurar`** e clique em **Executar**.
2. Autorize quando o Google pedir. É o seu próprio script acessando a sua planilha.
   Se aparecer "O Google não verificou este app", clique em **Avançado → Acessar (não seguro)**. Isso é normal em scripts pessoais.
3. No **Registro de execução** aparecem o link da planilha e a **chave do organizador**. Guarde essa chave.

### 4. Publicar o site
1. Clique em **Implantar → Nova implantação**.
2. Em "Selecionar tipo" (engrenagem), escolha **App da Web**.
3. **Executar como:** Eu. **Quem pode acessar:** Qualquer pessoa.
4. Clique em **Implantar** e copie a **URL do app da Web**, que termina em `/exec`. Esse é o link do site.

> Ao alterar o código depois, use **Implantar → Gerenciar implantações → ✏️ → Versão: Nova versão**. Assim o link continua o mesmo.

## Como usar
1. Abra o link e vá na aba **Organizador**. Digite a chave do organizador.
2. Cole de 3 a 10 nomes, um por linha, e clique em **Fazer o sorteio e gerar códigos**.
3. Envie a mensagem de cada pessoa **em particular**, pelo botão **WhatsApp** ou **Copiar mensagem**.
   Os códigos não ficam guardados em lugar nenhum: envie antes de fechar a página.
4. Cada participante abre o mesmo link, digita o nome e o código e descobre quem tirou.
   Maiúsculas, acentos e espaços extras no nome não atrapalham.

Na área do organizador também dá para:
- **Acompanhar** quem já viu o resultado.
- **Gerar novo código** para quem perdeu o seu. O amigo secreto da pessoa continua o mesmo e o código antigo para de funcionar.
- **Desbloquear** quem errou o código 10 vezes.
- **Apagar o sorteio** e começar de novo.

## Segurança
- O **sorteio é feito no servidor**. O navegador recebe só os códigos, nunca os pares.
- Os **códigos não ficam na planilha**: só um hash SHA-256 com salt diferente para cada pessoa.
- O **amigo secreto fica cifrado** na planilha (coluna `amigo_cifrado`). Quem abre a planilha não vê os pares.
- **Tentativas limitadas:** 10 códigos errados bloqueiam aquele nome, e 20 chaves de organizador erradas travam a área do organizador por 15 minutos.
- A chave do organizador e o segredo da cifra ficam em **Configurações do projeto → Propriedades do script**
  (`ORGANIZER_KEY` e `SEGREDO_INTERNO`). Para trocar a chave do organizador, edite `ORGANIZER_KEY` (mínimo de 12 caracteres).
  **Não apague nem altere `SEGREDO_INTERNO`** com um sorteio em andamento, ou os resultados não poderão mais ser lidos.
- **Limitação:** o dono do projeto é quem tem acesso técnico total. Ele poderia escrever um código para decifrar os pares.
  A proteção impede que alguém veja os pares sem querer, mas não protege contra o próprio dono mal-intencionado.
