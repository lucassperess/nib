<script lang="ts">
  import { onMount, tick } from 'svelte'
  import type { AppSnapshot, ConversionFormat, MediaMode, NibApi, Scene, Task, SessionService } from '../../shared/types'
  import { resolveLanguage, translate, type Language } from './i18n'
  import homeBg from '../../../assets/backgrounds/home.png'
  import downloadsBg from '../../../assets/backgrounds/downloads.png'
  import historyBg from '../../../assets/backgrounds/history.png'
  import logo from '../../../assets/branding/nib-wordmark.png'
  import sprite from '../../../assets/sprites/nib-states-v1.png'
  import reactionSprite from '../../../assets/sprites/nib-reactions-v2.png'

  declare global { interface Window { nib: NibApi } }
  const TOUR_VERSION = 2
  const backgrounds = { home: homeBg, downloads: downloadsBg, history: historyBg, settings: historyBg }
  let data: AppSnapshot | null = null
  let scene: Scene = 'home'
  let blackout = false
  let input = ''
  let mode: MediaMode = 'video'
  let message = ''
  let search = ''
  let filter: 'all' | 'video' | 'audio' | 'image' = 'all'
  let historyItems: Task[] = []
  let historyOffset: number | null = null
  let historyRequest = 0
  let searchTimer: ReturnType<typeof setTimeout>
  let selected: number[] = []
  let cookieInput = ''
  let cookieService: SessionService = 'instagram'
  let conversionFormat: ConversionFormat = 'mp4'
  let conversionFile: { token: string; name: string } | null = null
  let spriteTick = 0
  let mascotHover = false
  let bubbleDismissed = false
  let tourStep = 0
  let tourOrigin: Scene = 'home'
  let tourAutoChecked = false
  let transientMascot: 'completed' | 'link' | 'conversion' | null = null
  let transientTimer: ReturnType<typeof setTimeout>

  $: lang = resolveLanguage(data?.preferences.locale || 'system')
  $: document.documentElement.lang = lang
  $: tr = (key: string, values: Record<string, string | number> = {}) => translate(lang, key, values)
  $: tasks = data?.tasks || []
  $: pickerTask = tasks.find(task => task.state === 'choosing')
  $: speakingTask = [...tasks].sort((a, b) => priority(b) - priority(a))[0]
  $: mascotState = transientMascot || speakingTask?.state || 'idle'
  $: speech = getSpeech(speakingTask, data, lang, tourStep, transientMascot, mascotHover)
  $: spritePose = getSpriteFrame(mascotState, spriteTick, mascotHover)
  $: spriteColumns = spritePose.sheet === 'reactions' ? 2 : 4
  $: spriteX = spritePose.frame % spriteColumns
  $: spriteY = Math.floor(spritePose.frame / spriteColumns)
  $: if (data?.engine === 'ready' && !tourAutoChecked) {
    tourAutoChecked = true
    if (data.preferences.tutorialSeenVersion < TOUR_VERSION) void startTour()
  }

  function priority(task: Task): number {
    const active = ({ choosing: 8, finalizing: 7, processing: 6, transferring: 5, analyzing: 4, queued: 3, paused: 2 } as Record<string, number>)[task.state]
    if (active) return active
    if (task.state === 'failed' && Date.now() - new Date(task.updatedAt).getTime() < 12_000) return 9
    return task.state === 'failed' ? 1 : 0
  }
  function getSpeech(task: Task | undefined, snapshot: AppSnapshot | null, language: Language, step: number, transient: 'completed' | 'link' | 'conversion' | null, hovered: boolean): string {
    const t = (key: string) => translate(language, key)
    if (snapshot?.engine === 'starting') return t('speechStarting')
    if (snapshot?.engine === 'error') return t('speechFailed')
    if (step && !task) return t(`tourTitle${step}`)
    if (transient === 'completed') return t('speechCompleted')
    if (transient === 'link') return t('speechLink')
    if (transient === 'conversion') return t('speechConversion')
    if (hovered && task?.state === 'transferring') return t('speechHoverTransferring')
    if (hovered && task?.state === 'processing') return t(task.kind === 'conversion' ? 'speechHoverConverting' : 'speechHoverProcessing')
    if (hovered && (!task || ['failed', 'canceled'].includes(task.state))) return t(task?.state === 'failed' ? 'speechHoverFailed' : 'speechHover')
    if (!task) return t(transient === 'completed' ? 'speechCompleted' : 'speechIdle')
    if (task.kind === 'conversion' && task.state === 'processing') return t('speechConverting')
    return t(`speech${task.state[0].toUpperCase()}${task.state.slice(1)}`)
  }
  function getSpriteFrame(state: string, tick: number, hovered: boolean): { sheet: 'base' | 'reactions'; frame: number } {
    if (hovered) return { sheet: 'reactions', frame: tick % 3 === 2 ? 3 : 1 }
    if (state === 'idle') return { sheet: 'reactions', frame: tick % 5 === 4 ? 3 : 0 }
    if (state === 'link' || state === 'conversion') return { sheet: 'reactions', frame: tick % 2 === 0 ? 3 : 2 }
    if (state === 'completed') return { sheet: 'reactions', frame: tick % 2 === 0 ? 2 : 0 }
    const pairs: Record<string, number[]> = {
      idle: [0, 1], queued: [1, 0], analyzing: [2, 1], choosing: [2, 0],
      transferring: [3, 2], processing: [4, 3], finalizing: [4, 5],
      completed: [5, 4], failed: [6, 2], paused: [7, 0], canceled: [7, 0]
    }
    return { sheet: 'base', frame: (pairs[state] || pairs.idle)[tick % 2] }
  }
  function notice(error: unknown): void {
    message = error instanceof Error ? error.message : String(error)
    setTimeout(() => message = '', 6500)
  }
  function sayFor(state: 'completed' | 'link' | 'conversion', duration = 4000): void {
    transientMascot = state
    bubbleDismissed = false
    clearTimeout(transientTimer)
    transientTimer = setTimeout(() => transientMascot = null, duration)
  }
  function applySnapshot(value: AppSnapshot): void {
    data = value
    if (!search && filter === 'all') historyItems = value.history
    else if (scene === 'history') void loadHistory(true)
  }
  onMount(() => {
    window.nib.snapshot().then(applySnapshot).catch(notice)
    const unsubscribe = window.nib.onSnapshot(applySnapshot)
    const unsubscribeTask = window.nib.onTask(task => {
      if (!data) return
      const previous = data.tasks.find(item => item.id === task.id)
      if (task.state === 'completed' && previous?.state !== 'completed') sayFor('completed')
      else if (previous?.state !== task.state && ['choosing', 'failed', 'processing', 'transferring'].includes(task.state)) bubbleDismissed = false
      const next = data.tasks.filter(item => item.id !== task.id)
      if (task.state !== 'completed') next.unshift(task)
      data = { ...data, tasks: next }
    })
    const timer = setInterval(() => { if (!data?.preferences.reducedMotion && !matchMedia('(prefers-reduced-motion: reduce)').matches) spriteTick++ }, 500)
    return () => { unsubscribe(); unsubscribeTask(); clearInterval(timer); clearTimeout(searchTimer); clearTimeout(transientTimer) }
  })
  async function navigate(target: Scene): Promise<void> {
    if (target === scene || blackout) return
    if (data?.preferences.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches) scene = target
    else {
      blackout = true
      await new Promise(resolve => setTimeout(resolve, 190))
      scene = target
      await new Promise(resolve => setTimeout(resolve, 160))
      blackout = false
    }
    if (target === 'history') await loadHistory(true)
  }
  async function startTour(): Promise<void> {
    tourOrigin = scene
    if (scene !== 'home') await navigate('home')
    tourStep = 1
    await tick()
    document.querySelector<HTMLElement>('.tour-card')?.focus()
  }
  async function finishTour(): Promise<void> {
    tourStep = 0
    if (data && data.preferences.tutorialSeenVersion < TOUR_VERSION) {
      try { await window.nib.setPreferences({ tutorialSeenVersion: TOUR_VERSION }) } catch (error) { notice(error) }
    }
    if (scene !== tourOrigin) await navigate(tourOrigin)
  }
  async function moveTour(delta: number): Promise<void> {
    const next = tourStep + delta
    if (next > 5) { await finishTour(); return }
    if (next === 5 && scene !== 'settings') await navigate('settings')
    else if (next < 5 && scene === 'settings') await navigate('home')
    tourStep = Math.max(1, next)
    await tick()
    if (tourStep === 5) document.querySelector<HTMLElement>('.session-settings')?.scrollIntoView({ block: 'center' })
    document.querySelector<HTMLElement>('.tour-card')?.focus()
  }
  function tourKey(event: KeyboardEvent): void {
    if (!tourStep) return
    if (event.key === 'Escape') { event.preventDefault(); void finishTour() }
    if (event.key === 'ArrowRight' || event.key === 'Enter') { event.preventDefault(); void moveTour(1) }
    if (event.key === 'ArrowLeft') { event.preventDefault(); void moveTour(-1) }
  }
  async function submit(): Promise<void> {
    try {
      if (!input.trim()) throw new Error(tr('pasteFirst'))
      await window.nib.submit(input, mode)
      sayFor('link')
      input = ''
      if (tourStep) await finishTour()
      await navigate('downloads')
    } catch (error) { notice(error) }
  }
  async function action(task: Task, kind: 'pause' | 'resume' | 'cancel' | 'retry' | 'remove'): Promise<void> {
    try { await window.nib.taskAction(task.id, kind) } catch (error) { notice(error) }
  }
  async function open(task: Task, folder: boolean): Promise<void> {
    try { if (task.outputPath) await window.nib.openPath(task.outputPath, folder) } catch (error) { notice(error) }
  }
  function toggleSelected(index: number): void { selected = selected.includes(index) ? selected.filter(i => i !== index) : [...selected, index] }
  async function confirmPicker(): Promise<void> {
    if (!pickerTask) return
    try { await window.nib.select(pickerTask.id, selected); selected = [] } catch (error) { notice(error) }
  }
  async function chooseDirectory(): Promise<void> {
    try { const path = await window.nib.chooseDirectory(); if (path) await window.nib.setPreferences({ downloadDirectory: path }) } catch (error) { notice(error) }
  }
  async function importSession(): Promise<void> {
    try { await window.nib.importSession(cookieService, cookieInput); cookieInput = ''; message = tr('sessionSaved') } catch (error) { notice(error) }
  }
  async function updateEngine(): Promise<void> {
    try {
      const version = await window.nib.updateEngine()
      message = tr('extractorUpdated', { version })
    } catch (error) { notice(error) }
  }
  async function chooseConversion(): Promise<void> {
    try { conversionFile = await window.nib.pickConversionFile() } catch (error) { notice(error) }
  }
  async function convertFile(): Promise<void> {
    if (!conversionFile) return
    try {
      await window.nib.convertFile(conversionFile.token, conversionFormat)
      conversionFile = null
      sayFor('conversion')
      if (tourStep) await finishTour()
      await navigate('downloads')
    } catch (error) { notice(error) }
  }
  async function loadHistory(reset: boolean): Promise<void> {
    if (reset) { historyOffset = 0; historyItems = [] }
    if (historyOffset === null) return
    const request = ++historyRequest
    try {
      const page = await window.nib.history({ search, mediaType: filter, offset: historyOffset, limit: 50 })
      if (request !== historyRequest) return
      historyItems = reset ? page.items : [...historyItems, ...page.items]
      historyOffset = page.nextOffset
    } catch (error) { notice(error) }
  }
  function searchChanged(): void { clearTimeout(searchTimer); searchTimer = setTimeout(() => void loadHistory(true), 180) }
  function status(task: Task): string {
    if (task.kind === 'conversion' && task.state === 'processing') return tr('statusConverting')
    return tr(`status${task.state[0].toUpperCase()}${task.state.slice(1)}`)
  }
  function errorText(task: Task): string {
    const code = task.errorCode || task.error || ''
    if (code.includes('unsupported') || code.includes('invalid')) return tr('errorLink')
    if (/private|login|age|session/.test(code)) return tr('errorSession')
    if (code === 'media.unavailable') return tr('errorUnavailable')
    if (code.includes('region')) return tr('errorRegion')
    if (code.includes('rate')) return tr('errorRate')
    if (code === 'disk.full') return tr('errorDisk')
    if (code === 'disk.permission') return tr('errorPermission')
    if (code === 'media.empty') return tr('errorEmptyMedia')
    if (code === 'processing.failed' || code === 'media.processing') return tr('errorProcessing')
    if (code === 'file.missing') return tr('errorMissingFile')
    if (code.startsWith('network.') || /fetch\.fail|timed_out|timeout|connection|network|HTTP 5\d\d/i.test(code)) return tr('errorNetwork')
    return tr('errorUnknown')
  }
  function formatBytes(value: number): string {
    const unit = value >= 1e9 ? 'GB' : value >= 1e6 ? 'MB' : 'KB'
    const divisor = unit === 'GB' ? 1e9 : unit === 'MB' ? 1e6 : 1e3
    return `${new Intl.NumberFormat(lang, { maximumFractionDigits: unit === 'KB' ? 0 : 1 }).format(value / divisor)} ${unit}`
  }
  function transferDetails(task: Task): string {
    if (task.bytesReceived <= 0) return tr('startingTransfer')
    if (task.bytesTotal && task.totalKind === 'exact') {
      return tr('transferExact', { received: formatBytes(task.bytesReceived), total: formatBytes(task.bytesTotal), percent: Math.round((task.progress || 0) * 100) })
    }
    if (task.bytesTotal && task.totalKind === 'estimated') {
      return tr('transferEstimated', { received: formatBytes(task.bytesReceived), total: formatBytes(task.bytesTotal) })
    }
    return tr('transferUnknown', { received: formatBytes(task.bytesReceived) })
  }
  function formatDate(value: string | null): string { return value ? new Intl.DateTimeFormat(lang).format(new Date(value)) : '' }
  async function exportDiagnostics(): Promise<void> {
    try { const path = await window.nib.exportDiagnostics(); if (path) message = tr('exported', { path }) } catch (error) { notice(error) }
  }
</script>

<svelte:window onkeydown={tourKey} />
<main class:reduce-motion={data?.preferences.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches} class="app" style:background-image={`url('${backgrounds[scene]}')`} ondragover={event => event.preventDefault()} ondrop={event => { event.preventDefault(); const url = event.dataTransfer?.getData('text/uri-list') || event.dataTransfer?.getData('text/plain'); if (url) { input = url; scene = 'home' } }}>
  <div class="scene-shade"></div><div class:visible={blackout} class="curtain"></div>
  <div class="top-brand"><img src={logo} alt="Nib" /></div>

  {#if scene === 'home'}
    <section class="home-content" aria-label={tr('home')}>
      <div class="hero-logo-frame"><img class="hero-logo" src={logo} alt="Nib" /></div>
      <form onsubmit={event => { event.preventDefault(); void submit() }}>
        <label class:tour-highlight={tourStep === 1} class="link-field"><span aria-hidden="true">↗</span><input aria-label={tr('link')} bind:value={input} placeholder="https://example.com" autocomplete="off" spellcheck="false" /></label>
        <div class:tour-highlight={tourStep === 2} class="home-actions">
          <button type="button" class:chosen={mode === 'video'} onclick={() => mode = 'video'}>▶ <span>{tr('video')}</span></button>
          <button type="button" class:chosen={mode === 'audio'} onclick={() => mode = 'audio'}>◀ <span>{tr('audio')}</span></button>
          <button class="primary" type="submit" disabled={data?.engine !== 'ready'}>{tr('download')}</button>
        </div>
      </form>
      <button class:tour-highlight={tourStep === 3} class="home-convert" onclick={chooseConversion}>{tr('convert')}</button>
      <p class="home-note">{tr('privacyNote')}</p>
    </section>
    <div class="supported"><small>{tr('supported')}</small><div><span>YouTube</span><span>Instagram</span><span>𝕏</span><span>TikTok</span></div></div>
  {:else if scene === 'downloads'}
    <section class="workspace downloads-workspace" aria-label={tr('downloads')}>
      <div class="workspace-head"><div><h1>{tr('downloads')}</h1><p>{tr('queueCount', { count: tasks.filter(t => t.state !== 'failed' && t.state !== 'canceled').length })}</p></div></div>
      <div class="status-line"><span>{tr('all')} · {tasks.length}</span><span>{tr('downloading')} · {tasks.filter(t => t.state === 'transferring').length}</span><span>{tr('processing')} · {tasks.filter(t => t.state === 'processing' || t.state === 'finalizing').length}</span><span>{tr('needsHelp')} · {tasks.filter(t => t.state === 'failed').length}</span></div>
      <div class="task-list">
        {#if tasks.length === 0}<div class="empty-state">{tr('emptyQueue')}<br /><small>{tr('emptyQueueHint')}</small></div>{/if}
        {#each tasks as task (task.id)}
          <article class="task-row"><div class="media-mark">{task.kind === 'conversion' ? '↻' : task.mediaType === 'audio' ? '♫' : task.mediaType === 'image' ? '▧' : '▶'}</div>
            <div class="task-info"><div class="task-title">{task.title}</div><div class="task-sub">{task.kind === 'conversion' ? tr('localFile') : task.service} · {task.mode === 'video' ? tr('video') : tr('audio')}</div>
              {#if task.state === 'transferring' || task.state === 'paused'}<div class="progress-track" role="progressbar" aria-label={tr('downloadProgress')} aria-valuemin="0" aria-valuemax="100" aria-valuenow={task.progress === null ? undefined : Math.round(task.progress * 100)} aria-valuetext={transferDetails(task)}><div style:width={task.progress === null ? '32%' : `${Math.round(task.progress * 100)}%`} class:indeterminate={task.progress === null}></div></div>{/if}
              <div class="task-bottom"><span>{task.state === 'failed' ? errorText(task) : status(task)}</span><span>{task.state === 'transferring' || task.state === 'paused' ? transferDetails(task) : task.state === 'completed' ? formatBytes(task.bytesReceived) : ''}</span></div>
              {#if task.state === 'failed'}<div class="failure-actions"><button onclick={() => action(task, 'retry')}>{tr('retry')}</button>{#if /private|login|age|session/.test(task.errorCode || '')}<button onclick={() => navigate('settings')}>{tr('checkSession')}</button>{/if}{#if task.errorCode === 'disk.permission' || task.errorCode === 'disk.full'}<button onclick={chooseDirectory}>{tr('chooseFolder')}</button>{/if}{#if task.error}<details><summary>{tr('errorDetails')}</summary><code>{task.error}</code></details>{/if}</div>{/if}
            </div>
            <div class="row-actions">{#if task.state === 'transferring'}<button aria-label={tr('pause')} title={tr('pause')} onclick={() => action(task, 'pause')}>Ⅱ</button>{/if}{#if task.state === 'paused'}<button aria-label={tr('resume')} title={tr('resume')} onclick={() => action(task, 'resume')}>▶</button>{/if}{#if task.state === 'canceled'}<button aria-label={tr('retry')} title={tr('retry')} onclick={() => action(task, 'retry')}>↻</button>{/if}{#if task.state === 'failed' || task.state === 'canceled'}<button class="remove-task" aria-label={tr('remove')} title={tr('remove')} onclick={() => action(task, 'remove')}>{tr('remove')}</button>{/if}{#if !['completed', 'canceled', 'failed'].includes(task.state)}<button aria-label={tr('cancel')} title={tr('cancel')} onclick={() => action(task, 'cancel')}>×</button>{/if}</div>
          </article>
        {/each}
      </div>
    </section>
  {:else if scene === 'history'}
    <section class="workspace history-workspace" aria-label={tr('history')}>
      <div class="workspace-head"><div><h1>{tr('history')}</h1><p>{tr('historySubtitle')}</p></div>{#if historyItems.length}<button class="text-button" onclick={async () => { try { await window.nib.clearHistory(); historyItems = []; historyOffset = null } catch (e) { notice(e) } }}>{tr('clearHistory')}</button>{/if}</div>
      <div class="history-tools"><label>⌕ <input aria-label={tr('search')} bind:value={search} oninput={searchChanged} placeholder={tr('search')} /></label><div class="filter-tabs">{#each ['all', 'video', 'audio', 'image'] as kind}<button class:active={filter === kind} onclick={() => { filter = kind as typeof filter; void loadHistory(true) }}>{tr(kind === 'all' ? 'all' : kind === 'video' ? 'videos' : kind === 'audio' ? 'audios' : 'images')}</button>{/each}</div></div>
      <div class="history-table"><div class="history-header"><span>{tr('name')}</span><span>{tr('type')}</span><span>{tr('size')}</span><span>{tr('date')}</span><span></span></div>
        {#if historyItems.length === 0}<div class="empty-state">{tr('emptyHistory')}</div>{/if}
        {#each historyItems as task (task.id)}<div class="history-row"><div class="history-name"><span class="media-mark small">{task.kind === 'conversion' ? '↻' : task.mediaType === 'audio' ? '♫' : task.mediaType === 'image' ? '▧' : '▶'}</span><div><strong>{task.title}</strong><small>{task.kind === 'conversion' ? tr('localFile') : task.service}</small></div></div><span>{tr(task.mediaType === 'video' ? 'video' : task.mediaType === 'audio' ? 'audio' : 'images')}</span><span>{formatBytes(task.bytesReceived)}</span><span>{formatDate(task.completedAt)}</span><span class="history-actions"><button onclick={() => open(task, false)}>{tr('open')}</button><button onclick={() => open(task, true)}>{tr('folder')}</button></span></div>{/each}
        {#if historyOffset !== null}<button class="load-more" onclick={() => loadHistory(false)}>{tr('more')}</button>{/if}
      </div>
    </section>
  {:else}
    <section class="workspace settings-workspace" aria-label={tr('settings')}>
      <div class="workspace-head"><div><h1>{tr('settings')}</h1><p>{tr('makeYours')}</p></div></div>
      <div class="settings-scroll"><div class="settings-block"><h2>{tr('saving')}</h2><p>{tr('filesGoTo')}</p><button class="path-button" onclick={chooseDirectory}>{data?.preferences.downloadDirectory || tr('folder')} ↗</button>
        <div class="setting-grid"><label>{tr('videoQuality')}<select value={data?.preferences.videoQuality || 'max'} onchange={event => window.nib.setPreferences({ videoQuality: event.currentTarget.value as any })}><option value="max">{tr('bestAvailable')}</option><option value="2160">2160p</option><option value="1440">1440p</option><option value="1080">1080p</option><option value="720">720p</option><option value="480">480p</option></select></label><label>{tr('audioFormat')}<select value={data?.preferences.audioFormat || 'best'} onchange={event => window.nib.setPreferences({ audioFormat: event.currentTarget.value as any })}><option value="best">{tr('originalWhenPossible')}</option><option value="mp3">MP3</option><option value="ogg">OGG</option><option value="wav">WAV</option><option value="opus">Opus</option></select></label><label>{tr('language')}<select value={data?.preferences.locale || 'system'} onchange={event => window.nib.setPreferences({ locale: event.currentTarget.value as any })}><option value="system">{tr('systemLanguage')}</option><option value="pt-BR">{tr('portuguese')}</option><option value="en">{tr('english')}</option></select></label></div>
      </div><div class="settings-block"><h2>{tr('nib')}</h2><label class="check"><input type="checkbox" checked={data?.preferences.reducedMotion || false} onchange={event => window.nib.setPreferences({ reducedMotion: event.currentTarget.checked })} /> {tr('reduceMotion')}</label></div>
      <div class:tour-highlight={tourStep === 5} class="settings-block session-settings"><h2>{tr('privateSessions')}</h2><p>{tr('sessionHelp')}</p><div class="session-status">Instagram {data?.sessions.instagram ? '●' : '○'} · YouTube {data?.sessions.youtube ? '●' : '○'} · X {data?.sessions.twitter ? '●' : '○'}</div><div class="session-form"><select bind:value={cookieService}><option value="instagram">Instagram</option><option value="youtube">YouTube</option><option value="twitter">X</option></select><input type="password" bind:value={cookieInput} placeholder={tr('pasteCookie')} autocomplete="off" /><button onclick={importSession}>{tr('import')}</button>{#if data?.sessions[cookieService]}<button class="text-button" onclick={() => window.nib.clearSession(cookieService)}>{tr('remove')}</button>{/if}</div></div>
      <div class="settings-block"><h2>{tr('downloadEngine')}</h2><p>{tr('extractorVersion', { version: data?.extractorVersion || '—' })}</p><button class="path-button" onclick={updateEngine}>{tr('updateExtractor')} ↗</button><p>{tr('updateExtractorHelp')}</p></div>
      <div class="settings-block help-block"><h2>{tr('help')}</h2><button class="path-button" onclick={startTour}>{tr('replayTour')} ↗</button>
        {#each ['Flow', 'Files', 'Picker', 'Session', 'Convert', 'Privacy', 'Trouble'] as topic}<details><summary>{tr(`help${topic}Q`)}</summary><p>{tr(`help${topic}A`)}</p></details>{/each}
        <div class="support-actions"><button class="text-button" onclick={() => window.nib.openReleases()}>{tr('versions')}</button><button class="text-button" onclick={exportDiagnostics}>{tr('diagnostics')}</button></div><p>{tr('diagnosticsNote')}</p><p>{tr('version', { version: data?.appVersion || '0.4.0' })}</p>
      </div></div>
    </section>
  {/if}

  <div class:home={scene === 'home'} class:downloads={scene === 'downloads'} class:history={scene === 'history'} class:settings={scene === 'settings'} class="mascot-area">
    {#if !bubbleDismissed}<button class="speech" onclick={() => bubbleDismissed = true} aria-label={tr('dismiss')}>{speech}</button>{/if}
    <button class:reacting={mascotHover} class="sprite" aria-label={`Nib: ${speech}`} title="Nib" style:background-image={`url('${spritePose.sheet === 'reactions' ? reactionSprite : sprite}')`} style:background-size={spritePose.sheet === 'reactions' ? '200% 200%' : '400% 200%'} style:background-position={`${spriteX * (spriteColumns === 2 ? 100 : 33.3333)}% ${spriteY * 100}%`} onmouseenter={() => { mascotHover = true; bubbleDismissed = false }} onmouseleave={() => mascotHover = false} onfocus={() => { mascotHover = true; bubbleDismissed = false }} onblur={() => mascotHover = false} onclick={() => bubbleDismissed = !bubbleDismissed}></button>
  </div>
  <nav class:tour-highlight={tourStep === 4} aria-label={tr('mainNavigation')}><button class:active={scene === 'home'} onclick={() => navigate('home')}>{tr('home')}</button><button class:active={scene === 'downloads'} onclick={() => navigate('downloads')}>{tr('downloads')}</button><button class:active={scene === 'history'} onclick={() => navigate('history')}>{tr('history')}</button><button class:active={scene === 'settings'} onclick={() => navigate('settings')}>{tr('settings')}</button></nav>
  {#if tourStep}<div class:step-one={tourStep === 1} class:step-two={tourStep === 2} class:step-three={tourStep === 3} class:step-four={tourStep === 4} class:step-five={tourStep === 5} class="tour-card" tabindex="-1" role="dialog" aria-modal="false" aria-label={tr(`tourTitle${tourStep}`)}><small>{tr('tourProgress', { step: tourStep })}</small><h2>{tr(`tourTitle${tourStep}`)}</h2><p>{tr(`tourText${tourStep}`)}</p><div><button onclick={finishTour}>{tr('tourSkip')}</button>{#if tourStep > 1}<button onclick={() => moveTour(-1)}>{tr('tourBack')}</button>{/if}<button class="primary" onclick={() => moveTour(1)}>{tr(tourStep === 5 ? 'tourDone' : 'tourNext')}</button></div></div>{/if}
  {#if message}<div class="toast" role="alert">{message}<button aria-label={tr('dismiss')} onclick={() => message = ''}>×</button></div>{/if}
  {#if data?.engine === 'starting'}<div class="engine-error" role="status">{tr('engineStarting')}</div>{/if}
  {#if data?.engine === 'error'}<div class="engine-error" role="alert">{tr('engineError')} <button onclick={() => window.nib.restartEngine()}>{tr('retryEngine')}</button></div>{/if}
  {#if pickerTask}<div class="modal-backdrop"><div class="picker-dialog" role="dialog" aria-modal="true" aria-label={tr('pickTitle')}><h2>{tr('pickTitle')}</h2><p>{tr('pickDescription')}</p><div class="picker-grid">{#each pickerTask.pickerItems || [] as item, index}<button class:selected={selected.includes(index)} onclick={() => toggleSelected(index)}>{#if item.thumb}<img src={item.thumb} alt="" />{:else}<span class="picker-placeholder">{item.type === 'photo' ? '▧' : '▶'}</span>{/if}<span>{tr(item.type)} {index + 1}</span></button>{/each}</div><div class="dialog-actions"><button onclick={() => action(pickerTask, 'cancel')}>{tr('cancel')}</button><button class="primary" disabled={!selected.length} onclick={confirmPicker}>{tr('saveItems', { count: selected.length })}</button></div></div></div>{/if}
  {#if conversionFile}<div class="modal-backdrop"><div class="picker-dialog conversion-dialog" role="dialog" aria-modal="true" aria-label={tr('convertTitle')}><h2>{tr('convertTitle')}</h2><p>{conversionFile.name}</p><label>{tr('outputFormat')}<select bind:value={conversionFormat}><option value="mp4">{tr('videoMp4')}</option><option value="mkv">{tr('videoMkv')}</option><option value="mp3">{tr('audioMp3')}</option><option value="wav">{tr('audioWav')}</option></select></label><p>{tr('convertKeepsOriginal')}</p><div class="dialog-actions"><button onclick={() => conversionFile = null}>{tr('cancel')}</button><button class="primary" onclick={convertFile}>{tr('startConversion')}</button></div></div></div>{/if}
</main>
