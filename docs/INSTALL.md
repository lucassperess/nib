# Como baixar e usar o Nib

O Nib é um aplicativo para **Windows x64**. Você só precisa do instalador; não precisa usar o terminal, instalar Node.js ou configurar uma VPS.

## 1. Baixe o aplicativo

1. Acesse [github.com/lucassperess/nib/releases/latest](https://github.com/lucassperess/nib/releases/latest).
2. Role até **Assets** e clique no arquivo do Nib que termina em **.exe**. O arquivo começa a baixar.
3. Se você vir opções chamadas **Source code (zip)** ou **Source code (tar.gz)**, ignore-as: elas são para quem quer estudar o código, não para instalar o app.

## 2. Instale

1. Abra o instalador **.exe** do Nib na pasta Downloads do Windows.
2. Escolha a pasta de instalação, se quiser, e conclua o assistente.
3. Abra **Nib** pelo menu Iniciar. Se o Windows mostrar um aviso de segurança, confirme o nome e a origem do arquivo antes de continuar. Se não tiver certeza, pare e confira o link da release.

O Nib guarda suas preferências e o Histórico no seu perfil do Windows. Instalar uma versão mais nova não exige configurar tudo de novo. Seus arquivos baixados ficam na pasta escolhida em **Configurações**.

## 3. Faça o primeiro download

1. Acompanhe o tutorial de seis passos do Nib. Ele mostra também como instalar a extensão para sessões privadas; essa parte é opcional. Você pode pulá-lo e repeti-lo em **Configurações → Ajuda → Repetir tutorial**.
2. Na **Home**, cole um link de mídia. Escolha **Vídeo** ou **Áudio** e clique em **Baixar com Nib**.
3. Em **Downloads**, veja o andamento em bytes, pause ou cancele se precisar. Quando o site fornecer o tamanho total, o Nib mostrará também o total e a porcentagem.
4. Abra **Histórico** para encontrar o arquivo concluído e abrir o arquivo ou sua pasta.

![Home do Nib: campo para colar o link e escolha entre vídeo e áudio](screenshots/home.png)

![Downloads do Nib: aqui aparecem as tarefas em andamento](screenshots/downloads.png)

![Histórico do Nib: somente arquivos concluídos aparecem aqui](screenshots/history.png)

Para converter um arquivo que já está no computador, use **Converter arquivo** na Home, escolha o formato e acompanhe a tarefa em Downloads. O original é preservado. O tutorial também mostra onde importar uma sessão privada quando um site exigir acesso à sua conta; isso é opcional para links públicos.

### Se o site pedir uma sessão da sua conta

1. Em **Configurações → Sessões privadas**, clique em **Abrir pasta da extensão**.
2. No Brave, abra `brave://extensions`; no Chrome, abra `chrome://extensions`. Ative **Modo do desenvolvedor**, escolha **Carregar sem compactação** e selecione a pasta que o Nib abriu. Confirme que **Nib — sessões privadas** aparece na lista. Se já estava instalado, use **Recarregar** no cartão da extensão.
3. Clique no **quebra-cabeça** da barra do navegador, encontre o Nib e clique no **alfinete** para deixar o ícone roxo do mascote visível. O quebra-cabeça é o menu de extensões do navegador.
4. No Nib, escolha o site e clique em **Gerar código de conexão**.
5. Abra esse site no navegador e clique no ícone do Nib. A extensão seleciona automaticamente X, Instagram ou YouTube conforme a aba aberta. Em outra página, selecione o site manualmente. Digite o código e clique em **Enviar sessão ao Nib**. Permita o acesso aos cookies do site selecionado quando o navegador solicitar.
6. Confira a confirmação **“Sessão do [site] conectada neste computador”** no Nib. Se necessário, gere um código novo: ele expira em cinco minutos.

A extensão começa em português; use **EN** para inglês e **PT** para voltar. Ela é opcional, não está publicada em loja e não guarda cópias dos cookies. A importação manual continua disponível.

Ao atualizar o Nib, use **Recarregar** na página de extensões do navegador para aplicar a nova versão da extensão. Não é preciso instalá-la novamente.

## Se algo não funcionar

| Situação | Faça isto |
| --- | --- |
| O link não abre ou o site mudou | Tente um link direto. Depois, em Configurações, use **Atualizar extrator** e tente novamente. |
| O download falhou | Em Downloads, leia a mensagem e use **Tentar novamente**. Não é necessário reinstalar o Nib. |
| O site pede login | Use somente uma sessão da sua própria conta em Configurações → Sessões privadas. |
| Não sabe onde o arquivo foi salvo | Abra o item em Histórico e clique em **Abrir pasta**. |
| Não quer mais uma tarefa com erro | Clique em **Remover** na tarefa em Downloads. Isso não apaga arquivos já concluídos. |

O Nib não contorna DRM. A disponibilidade de cada mídia depende do serviço de origem e das permissões da sua conta.

---

# Download and use Nib

Nib runs on **Windows x64**. No terminal, Node.js, or VPS is needed.

1. Open the [latest GitHub release](https://github.com/lucassperess/nib/releases/latest). Under **Assets**, download the Nib **.exe** installer, not the Source code archive.
2. Run the installer and open **Nib** from the Start menu. If Windows shows a security warning, verify the file name and release source before proceeding.
3. Follow or skip the six-step tour, which includes optional extension installation. You can replay it under **Settings → Help → Replay the tour**.
4. On Home, paste a media link, choose **Video** or **Audio**, and click **Download with Nib**. Follow the task in Downloads and open completed files from History.
5. **Convert a file** on Home works with a local file and preserves the original. Private sessions are optional and only needed when a site requires access to your account.

For a private session, open **Settings → Private sessions → Open extension folder**. Open `chrome://extensions` in Chrome or `brave://extensions` in Brave, enable **Developer mode**, and **Load unpacked** with that folder. If already installed, click **Reload** on its card. Click the browser's **puzzle piece**, find Nib, and **pin** it to show the purple mascot icon in the toolbar. Choose a service in Nib and generate a connection code. Open the service's site in a browser tab, click Nib's icon, and check that the correct service was selected automatically. Enter the code and send the session. Confirm **“[site] session connected on this computer”** in Nib. The code expires after five minutes. The popup starts in Portuguese; **EN** switches to English and **PT** switches back. The extension is optional and is not yet published in a store.

After updating Nib, use **Reload** on the browser's extensions page to apply extension changes. You do not need to install it again.

For errors, read the message in Downloads and use **Retry**. Updating Nib preserves its local preferences and History. The [README](../README.md) includes troubleshooting and development details.
