<script lang="ts">
  import { onMount } from 'svelte'
  import type { AppSnapshot, ConversionFormat, MediaMode, NibApi, Scene, Task, SessionService } from '../../shared/types'
  import homeBg from '../../../assets/backgrounds/home.png'
  import downloadsBg from '../../../assets/backgrounds/downloads.png'
  import historyBg from '../../../assets/backgrounds/history.png'
  import logo from '../../../assets/branding/nib-wordmark.png'
  import sprite from '../../../assets/sprites/nib-states-v1.png'

  declare global { interface Window { nib: NibApi } }

  let data: AppSnapshot | null = null
  let scene: Scene = 'home'
  let blackout = false
  let input = ''
  let mode: MediaMode = 'video'
  let message = ''
  let search = ''
  let filter: 'all' | 'video' | 'audio' | 'image' = 'all'
  let selected: number[] = []
  let cookieInput = ''
  let cookieService: SessionService = 'instagram'
  let conversionFormat: ConversionFormat = 'mp4'
  let spriteTick = 0
  let bubbleDismissed = false

  const backgrounds = { home: homeBg, downloads: downloadsBg, history: historyBg, settings: historyBg }
  $: tasks = data?.tasks || []
  $: history = (data?.history || []).filter(task => (filter === 'all' || task.mediaType === filter) && `${task.title} ${task.service}`.toLowerCase().includes(search.toLowerCase()))
  $: pickerTask = tasks.find(task => task.state === 'choosing')
  $: speakingTask = [...tasks].sort((a, b) => priority(b) - priority(a))[0]
  $: mascotState = speakingTask?.state || (data?.history.length ? 'completed' : 'idle')
  $: speech = getSpeech(speakingTask, data)
  $: spriteFrame = getSpriteFrame(mascotState, spriteTick)
  $: spriteX = spriteFrame % 4
  $: spriteY = Math.floor(spriteFrame / 4)

  function priority(task: Task): number {
    return ({ failed: 8, choosing: 7, processing: 6, transferring: 5, analyzing: 4, queued: 3, paused: 2, canceled: 1, completed: 0 } as Record<string, number>)[task.state] || 0
  }
  function getSpeech(task: Task | undefined, snapshot: AppSnapshot | null): string {
    if (snapshot?.engine === 'starting') return 'Waking up...'
    if (snapshot?.engine === 'error') return 'I need a hand.'
    if (!task) return 'Paste a link.\nNib the rest.'
    return ({
      queued: 'On my list!', analyzing: 'Let me look...', choosing: 'Which ones?', transferring: 'Nibbing away...',
      processing: 'Almost done!', paused: 'Taking a breath.', failed: 'That didn’t work.', canceled: 'Stopped for now.'
    } as Record<string, string>)[task.state] || 'All done!'
  }
  function getSpriteFrame(state: string, tick: number): number {
    const pairs: Record<string, number[]> = {
      idle: [0, 1], queued: [1, 0], analyzing: [2, 1], choosing: [2, 0],
      transferring: [3, 2], processing: [4, 3], completed: [5, 4], failed: [6, 2], paused: [7, 0], canceled: [7, 0]
    }
    return (pairs[state] || pairs.idle)[tick % 2]
  }
  function notice(error: unknown): void { message = error instanceof Error ? error.message : String(error); setTimeout(() => message = '', 6500) }
  onMount(() => {
    window.nib.snapshot().then(value => data = value).catch(notice)
    const unsubscribe = window.nib.onSnapshot(value => data = value)
    const timer = setInterval(() => spriteTick++, 500)
    return () => { unsubscribe(); clearInterval(timer) }
  })
  async function navigate(target: Scene): Promise<void> {
    if (target === scene || blackout) return
    if (data?.preferences.reducedMotion) { scene = target; return }
    blackout = true
    await new Promise(resolve => setTimeout(resolve, 190))
    scene = target
    await new Promise(resolve => setTimeout(resolve, 160))
    blackout = false
  }
  async function submit(): Promise<void> {
    try {
      if (!input.trim()) throw new Error('Paste a link first')
      await window.nib.submit(input, mode)
      input = ''
      await navigate('downloads')
    } catch (error) { notice(error) }
  }
  async function action(task: Task, kind: 'pause' | 'resume' | 'cancel' | 'retry'): Promise<void> {
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
    try { await window.nib.importSession(cookieService, cookieInput); cookieInput = ''; message = 'Session saved on this device' } catch (error) { notice(error) }
  }
  async function convertFile(): Promise<void> {
    try { const result = await window.nib.convertFile(conversionFormat); if (result) message = `${result.method === 'copy' ? 'Changed the container without re-encoding' : 'Converted your media'}: ${result.path}` } catch (error) { notice(error) }
  }
  function formatBytes(value: number): string { return value >= 1e9 ? `${(value / 1e9).toFixed(1)} GB` : value >= 1e6 ? `${(value / 1e6).toFixed(1)} MB` : `${Math.round(value / 1e3)} KB` }
</script>

<main class="app" style:background-image={`url('${backgrounds[scene]}')`} ondragover={event => event.preventDefault()} ondrop={event => { event.preventDefault(); const url = event.dataTransfer?.getData('text/uri-list') || event.dataTransfer?.getData('text/plain'); if (url) { input = url; scene = 'home' } }}>
  <div class="scene-shade"></div>
  <div class:visible={blackout} class="curtain"></div>
  <div class="top-brand"><img src={logo} alt="Nib" /></div>

  {#if scene === 'home'}
    <section class="home-content" aria-label="Save media">
      <img class="hero-logo" src={logo} alt="Nib" />
      <form onsubmit={event => { event.preventDefault(); submit() }}>
        <label class="link-field"><span aria-hidden="true">↗</span><input aria-label="Media link" bind:value={input} placeholder="https://example.com" autocomplete="off" spellcheck="false" /></label>
        <div class="home-actions">
          <button type="button" class:chosen={mode === 'video'} onclick={() => mode = 'video'}>▶ <span>Video</span></button>
          <button type="button" class:chosen={mode === 'audio'} onclick={() => mode = 'audio'}>◀ <span>Audio</span></button>
          <button class="primary" type="submit" disabled={data?.engine !== 'ready'}>Download with Nib ↗</button>
        </div>
      </form>
      <p class="home-note">Your links and history stay on this device.</p>
    </section>
    <div class="supported"><small>Supported</small><div><span>YouTube</span><span>Instagram</span><span>𝕏</span><span>TikTok</span></div></div>
  {:else if scene === 'downloads'}
    <section class="workspace downloads-workspace" aria-label="Downloads">
      <div class="workspace-head"><div><h1>Downloads</h1><p>{tasks.length} in your queue</p></div><div class="convert-action"><select aria-label="Conversion format" bind:value={conversionFormat}><option value="mp4">Video · MP4</option><option value="mkv">Video · MKV</option><option value="mp3">Audio · MP3</option><option value="wav">Audio · WAV</option></select><button class="text-button" onclick={convertFile}>Convert a file ↗</button></div></div>
      <div class="status-line"><span>All · {tasks.length}</span><span>Downloading · {tasks.filter(t => t.state === 'transferring').length}</span><span>Processing · {tasks.filter(t => t.state === 'processing').length}</span><span>Needs help · {tasks.filter(t => t.state === 'failed').length}</span></div>
      <div class="task-list">
        {#if tasks.length === 0}<div class="empty-state">Nothing in the queue yet.<br /><small>Paste a link on Home and I’ll get started.</small></div>{/if}
        {#each tasks as task (task.id)}
          <article class="task-row">
            <div class="media-mark">{task.mediaType === 'audio' ? '♫' : task.mediaType === 'image' ? '▧' : '▶'}</div>
            <div class="task-info"><div class="task-title">{task.title}</div><div class="task-sub">{task.service} · {task.mode}</div>
              {#if task.state === 'transferring' || task.state === 'paused'}<div class="progress-track"><div style:width={task.progress === null ? '28%' : `${Math.round(task.progress * 100)}%`} class:indeterminate={task.progress === null}></div></div>{/if}
              <div class="task-bottom"><span>{task.error || task.stage}</span><span>{task.bytesReceived ? formatBytes(task.bytesReceived) : ''}{task.bytesTotal ? ` / ${formatBytes(task.bytesTotal)}` : ''}{task.progress !== null && task.state === 'transferring' ? ` · ${Math.round(task.progress * 100)}%` : ''}</span></div>
            </div>
            <div class="row-actions">
              {#if task.state === 'transferring'}<button aria-label="Pause" onclick={() => action(task, 'pause')}>Ⅱ</button>{/if}
              {#if task.state === 'paused'}<button aria-label="Resume" onclick={() => action(task, 'resume')}>▶</button>{/if}
              {#if task.state === 'failed' || task.state === 'canceled'}<button aria-label="Retry" onclick={() => action(task, 'retry')}>↻</button>{/if}
              {#if !['completed','canceled'].includes(task.state)}<button aria-label="Cancel" onclick={() => action(task, 'cancel')}>×</button>{/if}
            </div>
          </article>
        {/each}
      </div>
    </section>
  {:else if scene === 'history'}
    <section class="workspace history-workspace" aria-label="History">
      <div class="workspace-head"><div><h1>History</h1><p>Everything Nib finished for you</p></div>{#if data?.history.length}<button class="text-button" onclick={async () => { try { await window.nib.clearHistory() } catch (e) { notice(e) } }}>Clear history</button>{/if}</div>
      <div class="history-tools"><label>⌕ <input aria-label="Search history" bind:value={search} placeholder="Search" /></label><div class="filter-tabs">{#each ['all','video','audio','image'] as kind}<button class:active={filter === kind} onclick={() => filter = kind as typeof filter}>{kind === 'all' ? 'All' : `${kind[0].toUpperCase()}${kind.slice(1)}s`}</button>{/each}</div></div>
      <div class="history-table"><div class="history-header"><span>Name</span><span>Type</span><span>Size</span><span>Date</span><span></span></div>
        {#if history.length === 0}<div class="empty-state">No finished files here yet.</div>{/if}
        {#each history as task (task.id)}<div class="history-row"><div class="history-name"><span class="media-mark small">{task.mediaType === 'audio' ? '♫' : task.mediaType === 'image' ? '▧' : '▶'}</span><div><strong>{task.title}</strong><small>{task.service}</small></div></div><span>{task.mediaType}</span><span>{formatBytes(task.bytesReceived)}</span><span>{task.completedAt ? new Date(task.completedAt).toLocaleDateString('en-US') : ''}</span><span class="history-actions"><button onclick={() => open(task, false)}>Open</button><button onclick={() => open(task, true)}>Folder</button></span></div>{/each}
      </div>
    </section>
  {:else}
    <section class="workspace settings-workspace" aria-label="Settings">
      <div class="workspace-head"><div><h1>Settings</h1><p>Make Nib yours</p></div></div>
      <div class="settings-scroll"><div class="settings-block"><h2>Saving</h2><p>Files go to</p><button class="path-button" onclick={chooseDirectory}>{data?.preferences.downloadDirectory || 'Choose a folder'} ↗</button>
        <div class="setting-grid"><label>Video quality <select value={data?.preferences.videoQuality || 'max'} onchange={event => window.nib.setPreferences({ videoQuality: event.currentTarget.value as any })}><option value="max">Best available</option><option value="2160">2160p</option><option value="1440">1440p</option><option value="1080">1080p</option><option value="720">720p</option><option value="480">480p</option></select></label><label>Audio format <select value={data?.preferences.audioFormat || 'best'} onchange={event => window.nib.setPreferences({ audioFormat: event.currentTarget.value as any })}><option value="best">Original when possible</option><option value="mp3">MP3</option><option value="ogg">OGG</option><option value="wav">WAV</option><option value="opus">Opus</option></select></label></div>
      </div><div class="settings-block"><h2>Nib</h2><label class="check"><input type="checkbox" checked={data?.preferences.reducedMotion || false} onchange={event => window.nib.setPreferences({ reducedMotion: event.currentTarget.checked })} /> Reduce motion</label></div>
      <div class="settings-block"><h2>Private sessions</h2><p>Import a cookie string from an account you can access. It stays protected on this computer. Sessions can expire.</p><div class="session-status">Instagram {data?.sessions.instagram ? '●' : '○'} · YouTube {data?.sessions.youtube ? '●' : '○'} · X {data?.sessions.twitter ? '●' : '○'}</div><div class="session-form"><select bind:value={cookieService}><option value="instagram">Instagram</option><option value="youtube">YouTube</option><option value="twitter">X</option></select><input type="password" bind:value={cookieInput} placeholder="Paste cookie string" autocomplete="off" /><button onclick={importSession}>Import</button>{#if data?.sessions[cookieService]}<button class="text-button" onclick={() => window.nib.clearSession(cookieService)}>Remove</button>{/if}</div></div></div>
    </section>
  {/if}

  <div class:home={scene === 'home'} class:downloads={scene === 'downloads'} class:history={scene === 'history'} class:settings={scene === 'settings'} class="mascot-area">
    {#if !bubbleDismissed}<button class="speech" onclick={() => bubbleDismissed = true} aria-label="Dismiss Nib message">{speech}</button>{/if}
    <button class="sprite" aria-label="Nib says: {speech}" title="Nib" style:background-image={`url('${sprite}')`} style:background-position={`${spriteX * 33.3333}% ${spriteY * 100}%`} onclick={() => bubbleDismissed = !bubbleDismissed}></button>
  </div>

  <nav aria-label="Main navigation"><button class:active={scene === 'home'} onclick={() => navigate('home')}>Home</button><button class:active={scene === 'downloads'} onclick={() => navigate('downloads')}>Downloads</button><button class:active={scene === 'history'} onclick={() => navigate('history')}>History</button><button class:active={scene === 'settings'} onclick={() => navigate('settings')}>Settings</button></nav>
  {#if message}<div class="toast" role="alert">{message}<button aria-label="Dismiss" onclick={() => message = ''}>×</button></div>{/if}
  {#if data?.engine === 'error'}<div class="engine-error" role="alert">Local engine did not start. {data.engineError}</div>{/if}
  {#if pickerTask}<div class="modal-backdrop"><div class="picker-dialog" role="dialog" aria-modal="true" aria-label="Choose media"><h2>Pick what Nib should save</h2><p>This link has more than one item.</p><div class="picker-grid">{#each pickerTask.pickerItems || [] as item, index}<button class:selected={selected.includes(index)} onclick={() => toggleSelected(index)}>{#if item.thumb}<img src={item.thumb} alt="" />{:else}<span class="picker-placeholder">{item.type === 'photo' ? '▧' : '▶'}</span>{/if}<span>{item.type} {index + 1}</span></button>{/each}</div><div class="dialog-actions"><button onclick={() => action(pickerTask, 'cancel')}>Cancel</button><button class="primary" disabled={!selected.length} onclick={confirmPicker}>Save {selected.length} {selected.length === 1 ? 'item' : 'items'}</button></div></div></div>{/if}
</main>
