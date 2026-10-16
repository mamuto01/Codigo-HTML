# Amigo Secreto do Zero 🎁

Site responsivo para até 10 participantes, com um único link, códigos pessoais e resultados persistentes.

## Importante sobre privacidade

A interface não oferece uma lista de pares e cada participante precisa de um código individual. Porém, nesta versão, os pares sorteados são enviados ao banco de dados em texto simples. O proprietário/admin do projeto Supabase tem capacidade técnica para consultar os dados. Portanto, ela evita exposição casual entre participantes, mas **não garante que nem o administrador consiga saber os pares**. Para uma garantia criptográfica mais forte, o fluxo precisa ser redesenhado com criptografia por participante e gestão de chaves separada.

## Arquivos

- `index.html`: interface do site.
- `app.js`: lógica do navegador.
- `supabase/schema.sql`: tabelas e permissões.
- `supabase/functions/amigo-secreto/index.ts`: função segura que cria e consulta os resultados.

## Publicar com Supabase + Netlify

### 1. Criar o projeto Supabase
1. Acesse https://supabase.com e crie uma conta/projeto.
2. No painel, abra **SQL Editor**.
3. Cole o conteúdo de `supabase/schema.sql` e execute.
4. Em **Project Settings → API**, copie a **Project URL** e a chave pública **anon** (não use a `service_role` no navegador).

### 2. Configurar o site
Abra `app.js` e substitua:
- `COLE_AQUI_A_URL_DO_SEU_PROJETO` pela Project URL.
- `COLE_AQUI_A_CHAVE_PUBLICA_ANON` pela chave pública anon.

A chave anon pode estar no frontend; a chave `service_role` nunca pode ser colocada no frontend.

### 3. Publicar a Edge Function
A maneira recomendada é usar o Supabase CLI:
1. Instale o Supabase CLI: https://supabase.com/docs/guides/cli
2. Entre na pasta do projeto e faça login: `supabase login`
3. Vincule o projeto: `supabase link --project-ref SEU_PROJECT_REF`
4. Faça deploy da função: `supabase functions deploy amigo-secreto`
5. A função usa automaticamente `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` no ambiente Supabase. Se o projeto solicitar configuração manual, defina-as como secrets no painel/CLI; nunca as publique no código do navegador.

### 4. Publicar o site no Netlify
1. Acesse https://app.netlify.com/drop ou crie um site novo no Netlify.
2. Envie os arquivos `index.html` e `app.js` (na mesma pasta). Se fizer deploy pelo Git, conecte o repositório que contém esses arquivos.
3. Copie o endereço público gerado pelo Netlify e envie esse único link para todos.

## Como usar
1. Abra a aba **Organizador**.
2. Defina uma chave forte com pelo menos 12 caracteres.
3. Cole de 3 a 10 nomes únicos, um por linha.
4. Clique em **Criar sorteio e gerar códigos**.
5. Entregue cada código em particular para a pessoa indicada. Não envie a lista inteira no grupo.
6. Cada participante abre o mesmo link, informa o nome e seu código e revela o resultado.

## Limitações da primeira versão
- O sorteio é criado uma única vez por projeto. Para fazer outro sorteio, crie um novo projeto Supabase/banco ou peça a um desenvolvedor para adicionar uma função de reset protegida por chave do organizador.
- O navegador gera o pareamento antes de enviar à função. A tela do organizador não exibe os pares, mas uma pessoa tecnicamente experiente com acesso ao dispositivo durante a criação poderia inspecionar o navegador.
- Para maior segurança em uso real, recomendo adicionar limitação de tentativas, logs mínimos e um fluxo criptográfico em que o servidor nunca armazene os pares em texto simples.
