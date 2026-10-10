export type MediaMode = 'video' | 'audio'
export type TaskState = 'queued' | 'analyzing' | 'choosing' | 'transferring' | 'processing' | 'paused' | 'completed' | 'failed' | 'canceled'
export type MediaType = 'video' | 'audio' | 'image' | 'file'
export type Scene = 'home' | 'downloads' | 'history' | 'settings'

export interface Task {
  id: string
  sourceUrl: string
  title: string
  service: string
  mode: MediaMode
  mediaType: MediaType
  state: TaskState
  bytesReceived: number
  bytesTotal: number | null
  progress: number | null
  stage: string
  error: string | null
  outputPath: string | null
  createdAt: string
  updatedAt: string
  completedAt: string | null
  pickerItems?: PickerItem[]
  pickerIndex?: number
}

export interface PickerItem { type: 'photo' | 'video' | 'gif'; url: string; thumb?: string }
export interface Preferences {
  downloadDirectory: string
  videoQuality: 'max' | '2160' | '1440' | '1080' | '720' | '480'
  audioFormat: 'best' | 'mp3' | 'ogg' | 'wav' | 'opus'
  reducedMotion: boolean
}
export type SessionService = 'instagram' | 'youtube' | 'twitter'
export type ConversionFormat = 'mp4' | 'mkv' | 'mp3' | 'wav'
export interface AppSnapshot { tasks: Task[]; history: Task[]; preferences: Preferences; sessions: Record<SessionService, boolean>; engine: 'starting' | 'ready' | 'error'; engineError?: string }

export interface NibApi {
  snapshot(): Promise<AppSnapshot>
  submit(url: string, mode: MediaMode): Promise<string>
  select(id: string, indexes: number[]): Promise<void>
  taskAction(id: string, action: 'pause' | 'resume' | 'cancel' | 'retry'): Promise<void>
  setPreferences(patch: Partial<Preferences>): Promise<Preferences>
  chooseDirectory(): Promise<string | null>
  importSession(service: SessionService, cookie: string): Promise<void>
  clearSession(service: SessionService): Promise<void>
  clearHistory(): Promise<void>
  openPath(path: string, folder: boolean): Promise<void>
  convertFile(format: ConversionFormat): Promise<{ path: string; method: 'copy' | 'converted' } | null>
  onSnapshot(callback: (snapshot: AppSnapshot) => void): () => void
}
