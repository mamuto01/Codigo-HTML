# Amigo Secreto do Zero 🎁

Site responsivo para até 10 participantes, com um único link, códigos pessoais e resultados persistentes.
O site fica no Netlify e os dados ficam numa **planilha Google**, acessada por um **Google Apps Script**.

## Arquivos

- `index.html`: interface do site.
- `app.js`: lógica do navegador (só envia pedidos ao Apps Script).
- `apps-script/Codigo.gs`: backend que faz o sorteio, guarda os dados na planilha e revela os resultados.

## Segurança e privacidade

- **O sorteio é feito no servidor** (Apps Script). O navegador do organizador recebe só a lista de códigos, nunca os pares.
- **Os códigos pessoais não ficam na planilha.** Cada código é guardado como hash SHA-256 com um salt aleatório por pessoa.
- **Tentativas limitadas:** depois de 10 códigos errados para o mesmo nome, aquele nome fica bloqueado. Assim ninguém consegue testar códigos até acertar o de outra pessoa.
- **A chave do organizador fica no Apps Script** (propriedade `ORGANIZER_KEY`), não no site. Só quem a conhece cria o sorteio.
- **Limitação:** o dono da planilha consegue ver os pares abrindo a aba `Participantes`. Se o organizador também vai participar, peça para outra pessoa criar e guardar a planilha, ou combine de não abrir essa aba.

## Configuração

### 1. Criar a planilha e o Apps Script
1. Acesse https://sheets.new e crie uma planilha (ex.: "Amigo Secreto").
2. No menu, abra **Extensões → Apps Script**.
3. Apague o conteúdo do arquivo `Código.gs` e cole todo o conteúdo de `apps-script/Codigo.gs`. Salve.
4. No seletor de funções no topo, escolha **`configurar`** e clique em **Executar**. Autorize o acesso quando o Google pedir (é o seu próprio script acessando a sua planilha). As abas `Sorteio` e `Participantes` serão criadas.

### 2. Definir a chave do organizador
1. No Apps Script, clique em **Configurações do projeto** (ícone de engrenagem).
2. Em **Propriedades do script**, adicione:
   - Propriedade: `ORGANIZER_KEY`
   - Valor: uma chave forte com pelo menos 12 caracteres.
3. Salve.

### 3. Publicar o Apps Script como App da Web
1. Clique em **Implantar → Nova implantação**.
2. Em "Selecionar tipo", escolha **App da Web**.
3. **Executar como:** Eu. **Quem pode acessar:** Qualquer pessoa.
4. Clique em **Implantar** e copie a **URL do app da Web** (termina em `/exec`).

> Se depois você alterar o `Codigo.gs`, use **Implantar → Gerenciar implantações → editar (lápis) → Versão: Nova versão** para manter a mesma URL.

### 4. Configurar e publicar o site
1. Abra `app.js` e troque `COLE_AQUI_A_URL_DO_APPS_SCRIPT` pela URL copiada.
2. Publique `index.html` e `app.js` (na mesma pasta) no Netlify: arraste os dois em https://app.netlify.com/drop, ou conecte este repositório.
3. Envie o link do Netlify para todos.

## Como usar
1. Abra a aba **Organizador**.
2. Digite a chave definida em `ORGANIZER_KEY`.
3. Cole de 3 a 10 nomes únicos, um por linha.
4. Clique em **Criar sorteio e gerar códigos**.
5. Entregue cada código em particular para a pessoa indicada. Não envie a lista inteira no grupo.
6. Cada participante abre o mesmo link, informa o nome e o código e revela o resultado. Maiúsculas, acentos e espaços extras no nome não atrapalham.

## Manutenção pela planilha
- **Liberar um nome bloqueado:** na aba `Participantes`, troque o valor da coluna `tentativas_erradas` daquela pessoa para `0`.
- **Fazer um novo sorteio:** apague as linhas das abas `Sorteio` e `Participantes`, mantendo a primeira linha (cabeçalho). Depois crie o sorteio de novo pelo site.
- **Pessoa perdeu o código:** não é possível recuperá-lo, pois ele não fica guardado. Será preciso fazer um novo sorteio.
