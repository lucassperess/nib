export type Language = 'pt-BR' | 'en'

const strings: Record<Language, Record<string, string>> = {
  en: {
    home: 'Home', downloads: 'Downloads', history: 'History', settings: 'Settings',
    link: 'Media link', video: 'Video', audio: 'Audio', download: 'Download with Nib ↗',
    privacyNote: 'Your queue and history stay here. Nib contacts the linked site to fetch media.', supported: 'Supported',
    queueCount: '{count} in your queue', convert: 'Convert a file ↗', all: 'All', downloading: 'Downloading', processing: 'Processing', needsHelp: 'Needs help',
    emptyQueue: 'Nothing in the queue yet.', emptyQueueHint: 'Paste a link on Home and I’ll get started.',
    historySubtitle: 'Everything Nib finished for you', clearHistory: 'Clear history', search: 'Search', videos: 'Videos', audios: 'Audios', images: 'Images', name: 'Name', type: 'Type', size: 'Size', date: 'Date', open: 'Open', folder: 'Folder', more: 'Load more', emptyHistory: 'No finished files here yet.',
    makeYours: 'Make Nib yours', saving: 'Saving', filesGoTo: 'Files go to', videoQuality: 'Video quality', audioFormat: 'Audio format', bestAvailable: 'Best available', originalWhenPossible: 'Original when possible', language: 'Language', systemLanguage: 'System language', portuguese: 'Português', english: 'English', nib: 'Nib', reduceMotion: 'Reduce motion',
    privateSessions: 'Private sessions', sessionHelp: 'Import an account cookie only when a site requires it. It is protected on this computer and may expire.', import: 'Import', remove: 'Remove', pasteCookie: 'Paste cookie string',
    help: 'Help', replayTour: 'Replay the tour', versions: 'View versions on GitHub ↗', diagnostics: 'Export diagnostics', diagnosticsNote: 'The report contains app and task states only. It excludes links, cookies, keys and file paths.', version: 'Version {version}',
    helpFlowQ: 'How do I save a link?', helpFlowA: 'Paste or drop a media link on Home, choose video or audio, and start. Follow its progress in Downloads.',
    helpFilesQ: 'Where are my files?', helpFilesA: 'Completed files go to your chosen folder. Open History and use Open or Folder to find one.',
    helpPickerQ: 'What if a link has several items?', helpPickerA: 'Nib will show a picker. Select the items you want and confirm.',
    helpSessionQ: 'Why would I import a session?', helpSessionA: 'Some media requires an account you can access. Import a cookie in Settings only when needed; it may expire.',
    helpConvertQ: 'What does Convert a file do?', helpConvertA: 'It creates a separate file and keeps the original. Compatible formats can change container without re-encoding.',
    helpPrivacyQ: 'What stays on this computer?', helpPrivacyA: 'Your queue, history, settings, cookies and files are local. Nib contacts the media site to resolve and download a link.',
    helpTroubleQ: 'What if a download fails?', helpTroubleA: 'Read the task message. Retry network failures, check your session for restricted media, or choose a writable folder.',
    engineError: 'Nib’s local engine could not start.', retryEngine: 'Try starting it again', engineStarting: 'Starting the local engine…',
    tourTitle1: 'Start with a link', tourText1: 'Paste or drop a media link here. Nib will inspect it on your computer.',
    tourTitle2: 'Choose what to save', tourText2: 'Choose video or audio. The final format depends on what the site offers.',
    tourTitle3: 'Follow the journey', tourText3: 'Downloads shows active work and problems. History keeps only finished files.',
    tourNext: 'Next', tourBack: 'Back', tourSkip: 'Skip', tourDone: 'Done', tourProgress: '{step} of 3',
    statusQueued: 'Waiting', statusAnalyzing: 'Finding media', statusChoosing: 'Choose what to save', statusTransferring: 'Downloading', statusProcessing: 'Processing', statusFinalizing: 'Saving the file', statusPaused: 'Paused', statusCompleted: 'Ready to open', statusFailed: 'Needs help', statusCanceled: 'Canceled',
    speechIdle: 'Paste a link.\nNib the rest.', speechQueued: 'On my list!', speechAnalyzing: 'Let me look…', speechChoosing: 'Which ones?', speechTransferring: 'Nibbing away…', speechProcessing: 'Almost done!', speechFinalizing: 'Putting it away…', speechCompleted: 'All done!', speechPaused: 'Taking a breath.', speechFailed: 'I need a hand.', speechCanceled: 'Stopped for now.', speechStarting: 'Waking up…',
    errorLink: 'This link is not supported. Try a direct post or media link.', errorSession: 'This media may need account access. Check your session in Settings.', errorRegion: 'This media is restricted in your region.', errorRate: 'The site is slowing requests down. Try again later.', errorNetwork: 'The connection failed. Try again.', errorDisk: 'There is not enough free space in the destination folder.', errorPermission: 'Nib cannot write to this folder. Choose another one in Settings.', errorProcessing: 'Nib could not finish processing this file.', errorUnknown: 'Nib could not finish this task.', errorDetails: 'Technical details',
    retry: 'Retry', checkSession: 'Check session', chooseFolder: 'Choose folder', pause: 'Pause', resume: 'Resume', cancel: 'Cancel',
    pickTitle: 'Pick what Nib should save', pickDescription: 'This link has more than one item.', saveItems: 'Save {count} items',
    pasteFirst: 'Paste a link first.', sessionSaved: 'Session saved on this device.', converted: 'Converted your media: {path}', remuxed: 'Changed the container without re-encoding: {path}', exported: 'Diagnostics saved: {path}',
    videoMp4: 'Video · MP4', videoMkv: 'Video · MKV', audioMp3: 'Audio · MP3', audioWav: 'Audio · WAV',
    taskCount: '{count} tasks', dismiss: 'Dismiss Nib message'
  },
  'pt-BR': {
    home: 'Início', downloads: 'Downloads', history: 'Histórico', settings: 'Configurações',
    link: 'Link da mídia', video: 'Vídeo', audio: 'Áudio', download: 'Baixar com o Nib ↗',
    privacyNote: 'Sua fila e seu histórico ficam aqui. O Nib acessa o site do link para buscar a mídia.', supported: 'Compatível com',
    queueCount: '{count} na fila', convert: 'Converter arquivo ↗', all: 'Todos', downloading: 'Baixando', processing: 'Processando', needsHelp: 'Precisa de ajuda',
    emptyQueue: 'A fila está vazia.', emptyQueueHint: 'Cole um link no Início e eu começo.',
    historySubtitle: 'Tudo que o Nib concluiu para você', clearHistory: 'Limpar histórico', search: 'Buscar', videos: 'Vídeos', audios: 'Áudios', images: 'Imagens', name: 'Nome', type: 'Tipo', size: 'Tamanho', date: 'Data', open: 'Abrir', folder: 'Pasta', more: 'Carregar mais', emptyHistory: 'Ainda não há arquivos concluídos.',
    makeYours: 'Deixe o Nib do seu jeito', saving: 'Salvamento', filesGoTo: 'Os arquivos vão para', videoQuality: 'Qualidade do vídeo', audioFormat: 'Formato do áudio', bestAvailable: 'Melhor disponível', originalWhenPossible: 'Original quando possível', language: 'Idioma', systemLanguage: 'Idioma do sistema', portuguese: 'Português', english: 'English', nib: 'Nib', reduceMotion: 'Reduzir movimento',
    privateSessions: 'Sessões privadas', sessionHelp: 'Importe um cookie da sua conta apenas quando o site exigir. Ele fica protegido neste computador e pode expirar.', import: 'Importar', remove: 'Remover', pasteCookie: 'Cole o cookie',
    help: 'Ajuda', replayTour: 'Repetir tutorial', versions: 'Ver versões no GitHub ↗', diagnostics: 'Exportar diagnóstico', diagnosticsNote: 'O relatório contém apenas estados do app e das tarefas. Não inclui links, cookies, chaves nem caminhos dos arquivos.', version: 'Versão {version}',
    helpFlowQ: 'Como salvo um link?', helpFlowA: 'Cole ou arraste um link para o Início, escolha vídeo ou áudio e comece. Acompanhe em Downloads.',
    helpFilesQ: 'Onde estão meus arquivos?', helpFilesA: 'Arquivos concluídos vão para a pasta escolhida. No Histórico, use Abrir ou Pasta para encontrá-los.',
    helpPickerQ: 'E se o link tiver vários itens?', helpPickerA: 'O Nib mostrará uma seleção. Marque os itens desejados e confirme.',
    helpSessionQ: 'Por que importar uma sessão?', helpSessionA: 'Algumas mídias exigem acesso à sua conta. Importe um cookie em Configurações somente quando necessário; ele pode expirar.',
    helpConvertQ: 'O que faz Converter arquivo?', helpConvertA: 'Cria outro arquivo e preserva o original. Formatos compatíveis podem apenas trocar o contêiner, sem recodificar.',
    helpPrivacyQ: 'O que fica neste computador?', helpPrivacyA: 'Fila, histórico, configurações, cookies e arquivos são locais. O Nib acessa o site da mídia para resolver e baixar o link.',
    helpTroubleQ: 'E se um download falhar?', helpTroubleA: 'Leia a mensagem da tarefa. Tente novamente após falhas de rede, confira a sessão para mídia restrita ou escolha outra pasta.',
    engineError: 'O motor local do Nib não iniciou.', retryEngine: 'Tentar iniciar novamente', engineStarting: 'Iniciando o motor local…',
    tourTitle1: 'Comece com um link', tourText1: 'Cole ou arraste o link da mídia aqui. O Nib vai analisá-lo no seu computador.',
    tourTitle2: 'Escolha o que salvar', tourText2: 'Escolha vídeo ou áudio. O formato final depende do que o site oferece.',
    tourTitle3: 'Acompanhe a jornada', tourText3: 'Downloads mostra tarefas e problemas. O Histórico guarda apenas arquivos concluídos.',
    tourNext: 'Próximo', tourBack: 'Voltar', tourSkip: 'Pular', tourDone: 'Concluir', tourProgress: '{step} de 3',
    statusQueued: 'Aguardando', statusAnalyzing: 'Buscando mídia', statusChoosing: 'Escolha o que salvar', statusTransferring: 'Baixando', statusProcessing: 'Processando', statusFinalizing: 'Salvando arquivo', statusPaused: 'Pausado', statusCompleted: 'Pronto para abrir', statusFailed: 'Precisa de ajuda', statusCanceled: 'Cancelado',
    speechIdle: 'Cole um link.\nNib cuida do resto.', speechQueued: 'Já anotei!', speechAnalyzing: 'Deixa eu ver…', speechChoosing: 'Quais deles?', speechTransferring: 'Estou baixando…', speechProcessing: 'Quase pronto!', speechFinalizing: 'Guardando aqui…', speechCompleted: 'Prontinho!', speechPaused: 'Uma pausa.', speechFailed: 'Preciso de ajuda.', speechCanceled: 'Parei por aqui.', speechStarting: 'Acordando…',
    errorLink: 'Este link não é compatível. Tente o link direto do post ou da mídia.', errorSession: 'Esta mídia pode exigir acesso à conta. Confira sua sessão em Configurações.', errorRegion: 'Esta mídia está restrita na sua região.', errorRate: 'O site está limitando as solicitações. Tente mais tarde.', errorNetwork: 'A conexão falhou. Tente novamente.', errorDisk: 'Não há espaço livre suficiente na pasta de destino.', errorPermission: 'O Nib não consegue salvar nessa pasta. Escolha outra em Configurações.', errorProcessing: 'O Nib não conseguiu finalizar este arquivo.', errorUnknown: 'O Nib não conseguiu concluir esta tarefa.', errorDetails: 'Detalhes técnicos',
    retry: 'Tentar novamente', checkSession: 'Verificar sessão', chooseFolder: 'Escolher pasta', pause: 'Pausar', resume: 'Retomar', cancel: 'Cancelar',
    pickTitle: 'Escolha o que o Nib deve salvar', pickDescription: 'Este link tem mais de um item.', saveItems: 'Salvar {count} itens',
    pasteFirst: 'Cole um link primeiro.', sessionSaved: 'Sessão salva neste computador.', converted: 'Mídia convertida: {path}', remuxed: 'Contêiner trocado sem recodificação: {path}', exported: 'Diagnóstico salvo: {path}',
    videoMp4: 'Vídeo · MP4', videoMkv: 'Vídeo · MKV', audioMp3: 'Áudio · MP3', audioWav: 'Áudio · WAV',
    taskCount: '{count} tarefas', dismiss: 'Fechar mensagem do Nib'
  }
}

export function resolveLanguage(preference: 'system' | Language, system = navigator.language): Language {
  return preference === 'system' ? (system.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en') : preference
}
export function translate(language: Language, key: string, values: Record<string, string | number> = {}): string {
  const template = strings[language][key] || strings.en[key] || key
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? ''))
}
