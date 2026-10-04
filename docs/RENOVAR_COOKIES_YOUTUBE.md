# Renovar os cookies do YouTube (para o download voltar a funcionar)

O servidor que baixa os vídeos (Fly.io, região `gru`) roda num datacenter. O YouTube bloqueia esse tipo de IP e
pede "confirme que você não é um robô". Os **cookies de uma conta Google** liberam o download. Eles **expiram**
com o tempo; quando isso acontece, é só repetir este passo a passo. Qualquer pessoa da equipe consegue fazer, em
cerca de 5 minutos, sem mexer em código nem em servidor.

## Quando precisa renovar

Faça isto se um projeto falhar na etapa de download, no site, com uma mensagem parecida com:

- `YouTubeBlockError: todos os métodos de download falharam`
- `Sign in to confirm you're not a bot` ou `exporting-youtube-cookies`

Se o erro for outro (por exemplo "Limite de 3 clipes gratuitos"), **não** é o YouTube: veja a tabela de problemas no fim.

## O que você precisa

- O Chrome.
- Uma **conta Google secundária** (não a principal). Servidor com cookies de login pode fazer o Google travar a
  conta; por isso use uma que você possa perder.
- Estar logado no Clipost (`https://clipost.clippost.workers.dev`).

## Passo a passo

### 1. Instale a extensão (só na primeira vez)

1. Abra: https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc
2. Clique em **Usar no Chrome** (ou *Add to Chrome*) e confirme.
3. Clique no ícone do quebra-cabeça 🧩 ao lado da barra de endereço e no alfinete ao lado de
   **Get cookies.txt LOCALLY**, para ele ficar fixo.
4. Abra `chrome://extensions`, clique em **Detalhes** na extensão e ligue **Permitir em anônimo**.

### 2. Exporte os cookies

1. Abra uma **janela anônima** do Chrome (`Ctrl + Shift + N`).
2. Entre no YouTube (`https://www.youtube.com`) com a **conta secundária**. Confira que o seu avatar aparece no canto
   superior direito.
3. Na **mesma janela**, abra `https://www.youtube.com/robots.txt`.
   Isso evita que o YouTube renove os cookies depois e os invalide. Esse endereço só mostra texto de configuração;
   **não copie esse texto**.
4. Clique no ícone da extensão **Get cookies.txt LOCALLY** e clique em **Export** (formato Netscape). Será baixado
   um arquivo `www.youtube.com_cookies.txt` na pasta Downloads.
5. **Feche a janela anônima.**

### 3. Confira o arquivo

Abra o arquivo com o Bloco de Notas. Ele deve começar assim:

```
# Netscape HTTP Cookie File
.youtube.com	TRUE	/	TRUE	17xxxxxxxx	VISITOR_INFO1_LIVE	...
.youtube.com	TRUE	/	TRUE	18xxxxxxxx	__Secure-1PSID	...
```

Tem de haver várias linhas com `.youtube.com` e, entre elas, `__Secure-1PSID` e `LOGIN_INFO`. Se faltarem, você não
estava logado no YouTube na hora de exportar: refaça o passo 2.

### 4. Cole no Clipost

1. Selecione tudo no Bloco de Notas (`Ctrl + A`) e copie (`Ctrl + C`).
2. No Clipost, abra **Ajustes** e ache **Download do YouTube**.
3. Clique no campo grande, cole (`Ctrl + V`) e clique em **Salvar**.
4. Deve aparecer: **"Pronto. Os próximos vídeos do YouTube já baixam com essa conta."**

O servidor passa a usar os cookies na hora, **sem reiniciar nada**.

### 5. Apague o arquivo

Apague `Downloads\www.youtube.com_cookies.txt`. Ele contém a sessão da conta secundária. Não envie por e-mail, chat
ou nuvem.

### 6. Teste

1. Em **Criar cortes**, cole um link de vídeo do YouTube (de preferência um com fala, de 3 a 15 minutos) e clique
   em **Criar cortes** (se o botão não reagir no primeiro clique, clique de novo).
2. Em 1 a 3 minutos o projeto deve passar de *Baixando* para *Transcrevendo* e depois *Criando cortes*.

## Problemas comuns

| O que aparece | Causa | O que fazer |
|---|---|---|
| O arquivo só tem `User-agent` e `Disallow` | Você copiou o texto do `robots.txt`, não os cookies | Use o ícone da extensão e **Export**; abra o arquivo baixado |
| O arquivo tem poucas linhas e não tem `LOGIN_INFO` | A conta não estava logada na janela | Entre no YouTube nessa janela e exporte de novo |
| Ao salvar: "Cole o conteúdo do arquivo cookies.txt…" | Faltou o `.youtube.com` ou as tabulações | Cole o arquivo inteiro, sem editar |
| Salvou, mas o download continua bloqueado | Cookies já invalidados (a conta foi usada em outro lugar) ou conta bloqueada | Exporte de **outra** conta secundária |
| Funcionou e depois de dias voltou a falhar | Os cookies expiraram | Repita este passo a passo |
| `Limite de 3 clipes gratuitos atingido` | Plano grátis esgotado no mês (não é o YouTube) | Veja o plano da conta; não adianta renovar cookies |

## Para quem administra

- Os cookies ficam em `/tmp/youtube_cookies.txt` no servidor e uma cópia no storage **privado** do Supabase
  (`config-privado/youtube_cookies.txt`), para sobreviver a reinícios.
- A rota é `POST /api/social/youtube-cookies` (o backend lê o campo `cookies`). Hoje **qualquer usuário logado**
  consegue chamá-la. Antes de abrir o cadastro ao público, restrinja a administradores (`ADMIN_EMAILS`), senão
  alguém pode sobrescrever os cookies e derrubar o download de todos.
- Cookies exportados de uma conta secundária duram semanas, mas não são permanentes. Para uma operação com muitos
  clientes, o caminho estável é um **proxy residencial** em `YTDLP_PROXY` (segredo na Fly), que dispensa os cookies.
- A primeira linha do arquivo precisa ser `# Netscape HTTP Cookie File`.
