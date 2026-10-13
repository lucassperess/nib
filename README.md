# Nib

**English documentation: [README.en.md](README.en.md).**

O Nib é um aplicativo desktop para **Windows x64** que ajuda a salvar mídias a partir de links. A interface, fila de downloads, gerenciamento de arquivos, Histórico e mascote animado são próprios. A extração de mídia acontece localmente com o [yt-dlp](https://github.com/yt-dlp/yt-dlp); o instalador também inclui Node.js para scripts de sites e [FFmpeg](https://ffmpeg.org/) para processar arquivos. Não é preciso usar VPS nem instalar essas ferramentas separadamente.

![Tela inicial do Nib, com campo de link, opções de vídeo e áudio e mascote](docs/screenshots/home.png)

[Veja as três telas principais antes de instalar](docs/SCREENS.md).

## Baixar e instalar — sem terminal

1. Abra a [versão mais recente do Nib](https://github.com/lucassperess/nib/releases/latest).
2. Em **Assets**, baixe o instalador do Nib que termina em **.exe**. As opções **Source code** são para quem quer estudar o código, não para instalar o aplicativo.
3. Execute o instalador e abra o **Nib** pelo menu Iniciar.
4. Siga o tutorial dentro do app. Na Home, cole um link, escolha **Vídeo** ou **Áudio** e clique em **Baixar com Nib**. Acompanhe em **Downloads** e abra o arquivo concluído em **Histórico**.
5. Se um site exigir sua conta, o tutorial também mostra como [instalar a extensão do Nib no Chrome ou Brave](#extensão-opcional-para-sessões-privadas). Esse passo é opcional para links públicos.

O [guia ilustrado de instalação e primeiro uso](docs/INSTALL.md) traz mais detalhes e ajuda para problemas comuns. O instalador não exige Node.js, pnpm ou FFmpeg no computador do usuário.

## Primeiro uso

1. Instale uma versão validada pela página de [Releases](https://github.com/lucassperess/nib/releases).
2. Acompanhe ou pule o tutorial de seis passos. Ele inclui conversão de arquivos locais, instalação da extensão e conexão de sessões privadas. É possível repeti-lo em **Configurações → Ajuda → Repetir tutorial**.
3. Cole ou arraste um link para a Home e escolha Vídeo ou Áudio. **Converter arquivo**, também na Home, inicia um fluxo separado para um arquivo do computador.
4. Acompanhe a tarefa em Downloads. Se um link contiver várias mídias, escolha os itens desejados.
5. Abra os arquivos concluídos pelo Histórico. Tarefas com falha ou canceladas continuam em Downloads até serem removidas; elas não entram no Histórico.

Em Configurações, você pode escolher a pasta de destino, qualidade de vídeo, formato de áudio, idioma, movimento reduzido e sessões de contas. A interface e a ajuda estão em português brasileiro e inglês. A opção **Idioma do sistema** usa português quando o Windows está em português e inglês nos outros casos.

Se um download falhar, use **Tentar novamente** ou **Remover** em Downloads. Uma falha isolada não exige reinstalação. Em **Configurações → Motor de download → Atualizar extrator**, você pode atualizar o suporte a sites sem trocar a interface nem o banco de dados do Nib; espere os downloads ativos terminarem antes de atualizar. Um novo instalador só é necessário para atualizações do próprio aplicativo. Arquivos baixados, preferências e Histórico permanecem após a atualização.

A disponibilidade de sites, qualidades e formatos depende da fonte. Sessões de contas podem ajudar com conteúdo acessível ao usuário, sem garantir todo conteúdo restrito. O Nib não contorna DRM. Spotify e downloads em lote de playlists não fazem parte da versão atual.

## Extensão opcional para sessões privadas

Quando um serviço exigir acesso à sua conta, o Nib pode receber a sessão de uma extensão para Chrome ou Brave. A extensão está na pasta `extension/` do projeto e também é incluída no instalador; **ela ainda não está publicada em lojas de extensões**.

1. No Nib, abra **Configurações → Sessões privadas → Abrir pasta da extensão**.
2. No **Brave**, abra `brave://extensions`; no **Chrome**, abra `chrome://extensions`. Ative **Modo do desenvolvedor**, clique em **Carregar sem compactação** e selecione a pasta aberta pelo Nib. Confirme que **Nib — sessões privadas** aparece na lista.
3. Para deixar o mascote visível na barra, clique no ícone de **quebra-cabeça** do navegador, encontre **Nib — sessões privadas** e clique no **alfinete** ao lado. O quebra-cabeça é o menu de extensões do navegador, não o ícone do Nib. Se a extensão já estava instalada antes de atualizar o Nib, clique em **Recarregar** no cartão dela em `brave://extensions` ou `chrome://extensions`.
4. No Nib, escolha YouTube, Instagram ou X e clique em **Gerar código de conexão**.
5. Abra o site da sua conta em uma aba e clique no ícone da extensão. Ela seleciona automaticamente o site dessa aba; se estiver em outra página, escolha o site manualmente. Digite o código mostrado no Nib e clique em **Enviar sessão ao Nib**. O navegador pedirá acesso aos cookies apenas do serviço selecionado.
6. Confirme a mensagem **“Sessão do X/Instagram/YouTube conectada neste computador”** no Nib. Se não aparecer, gere outro código e tente novamente.

O código vale por cinco minutos. A extensão começa em português brasileiro; use **EN** no popup para trocar para inglês e **PT** para voltar. Ela envia os cookies somente quando você clica, pela conexão local `127.0.0.1`, e não os armazena. A extensão guarda apenas a preferência de idioma. O Nib protege a sessão no perfil do Windows. Use apenas contas que você controla. A [política de privacidade da extensão](extension/PRIVACY.md) explica os dados e seus limites. A importação manual continua disponível.

Depois de instalar uma nova versão do Nib, clique em **Recarregar** na extensão em `brave://extensions` ou `chrome://extensions` para usar a versão atualizada do popup. Não é preciso adicionar a extensão de novo.

## Arquitetura

| Componente | Responsabilidade |
| --- | --- |
| Processo principal do Electron | Executa extração e downloads, controla arquivos, valida comandos da interface e guarda dados locais. |
| Interface Svelte isolada | Mostra Home, Downloads, Histórico, Configurações, tutorial, ajuda e o Nib animado, sem acesso direto aos arquivos. |
| Ponte preload | Expõe comandos tipados e eventos de tarefas à interface. |
| yt-dlp | Obtém informações e baixa mídias em processos separados por tarefa. Seu executável pode ser atualizado independentemente. |
| FFmpeg | Junta fluxos ou converte arquivos quando necessário. |
| SQLite | Guarda metadados das tarefas, Histórico, versão do tutorial e preferências no perfil do usuário. As mídias ficam na pasta escolhida. |

No máximo duas tarefas são executadas ao mesmo tempo. Cada uma usa uma pasta temporária e, ao final, o arquivo é copiado de forma assíncrona para um nome exclusivo; arquivos existentes nunca são sobrescritos. A conversão local preserva o original. O Histórico contém somente tarefas concluídas. Depois de reiniciar o app, tarefas interrompidas voltam à fila para uma nova tentativa. A interface recebe apenas alterações de tarefas, sem reconstruir todo o Histórico a cada avanço. Bytes recebidos e total aparecem quando o extrator fornece tamanhos confiáveis; caso contrário, o total é indicado como indisponível.

## Desenvolvimento e build

Para desenvolver em Windows x64, instale Node.js 24.14.0, pnpm 11 e Git:

```powershell
git clone https://github.com/lucassperess/nib.git
cd nib
pnpm install
pnpm prepare:tools
pnpm dev
```

Antes de empacotar, execute `pnpm typecheck`, `pnpm test` e `pnpm build`. O comando `pnpm dist:win` prepara as ferramentas fixadas e gera um instalador em `release/`. O preparo confere o SHA-256 do binário oficial do yt-dlp. Um teste do aplicativo empacotado verifica a ponte isolada da interface e downloads reais de vídeo e áudio. O fluxo manual do GitHub Actions também instala o pacote sem Node ou pnpm externos no `PATH`.

Não inclua no Git `.runtime/`, `.bundle/`, `release/`, bancos locais, arquivos de sessão ou mídias baixadas. Consulte o [guia de desenvolvimento](docs/DEVELOPMENT.md), a [direção de design](docs/DESIGN.md) e as [notas históricas](docs/archive/README.md).

## Privacidade e segurança

- Fila, Histórico, preferências e mídias permanecem no computador do usuário. O Nib acessa o serviço do link e, apenas quando solicitado, a fonte oficial de releases do yt-dlp para atualizar o extrator.
- Cookies importados são criptografados com a proteção do Windows em repouso. Para uma tarefa correspondente, o Nib cria um arquivo temporário de cookies no formato Netscape e o apaga depois. Importe sessões apenas de contas que você controla.
- A interface do Electron usa sandbox e isolamento de contexto. Navegação e novas janelas são bloqueadas; o link fixo para as releases abre no navegador externo.
- **Exportar diagnóstico** exige ação do usuário. O relatório contém versão do app e do Windows, estado do motor, tempo de abertura, contagens de tarefas e códigos de erro. Ele exclui URLs completas, cookies, títulos de mídia e caminhos pessoais. Revise o arquivo antes de compartilhá-lo.

## Solução de problemas

| Situação | O que fazer |
| --- | --- |
| O motor não inicia | Use **Tentar iniciar novamente**. Se persistir, confira se o antivírus colocou alguma ferramenta incluída em quarentena. |
| O link não é reconhecido | Tente um link direto para a publicação ou mídia. Alguns sites mudam suas regras; use **Atualizar extrator** em Configurações e tente de novo. |
| Uma sessão é necessária ou expirou | Importe uma sessão atual de uma conta com acesso e tente novamente. |
| O download falha ou trava | Tente novamente em Downloads e confira a conexão. Após reiniciar o app, a mídia é resolvida de novo. |
| O arquivo não pode ser salvo | Escolha uma pasta com permissão de escrita em Configurações e verifique o espaço livre. |
| A conversão falha | Tente outro formato. O arquivo original permanece intacto. |

O extrator instalado não é atualizado automaticamente. Serviços podem mudar com frequência, então uma versão fixada pode parar de funcionar até o usuário pedir a atualização. Uma tarefa pausada pode continuar na sessão atual; após reiniciar o app, uma tarefa interrompida recomeça do início.

## Créditos e licenças

O código original do Nib usa a [licença MIT](LICENSE). Fundos, logo, ícone, mascote e sprites do Nib têm [direitos reservados](ASSET_LICENSE.md). Ferramentas incluídas têm seus próprios termos e links de origem em [Avisos de terceiros](THIRD_PARTY_NOTICES.md). A pesquisa de design anterior está em `docs/archive/`; capturas de referências externas não integram a árvore de código atual.
