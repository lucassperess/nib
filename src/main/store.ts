import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { HistoryPage, HistoryQuery, Preferences, Task } from '../shared/types'

export class Store {
  private db: Database.Database
  constructor(directory: string, private defaultDownloadDirectory: string) {
    mkdirSync(directory, { recursive: true })
    this.db = new Database(join(directory, 'nib.sqlite'))
    this.db.pragma('journal_mode = WAL')
    this.db.exec(`CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, state TEXT NOT NULL, updated_at TEXT NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);`)
    if (!this.db.prepare('SELECT 1 FROM settings WHERE key = ?').get('preferences')) {
      this.setPreferences({ downloadDirectory: defaultDownloadDirectory, videoQuality: 'max', audioFormat: 'best', reducedMotion: false, locale: 'system', tutorialSeenVersion: 0 })
    }
    for (const task of this.tasks()) {
      if (['analyzing', 'transferring', 'processing', 'finalizing', 'paused'].includes(task.state)) {
        task.state = 'queued'
        task.stage = 'Ready to retry after restart'
        task.progress = null
        task.bytesReceived = 0
        task.bytesTotal = null
        this.saveTask(task)
      }
    }
  }
  tasks(): Task[] {
    return (this.db.prepare('SELECT data FROM tasks ORDER BY updated_at DESC').all() as { data: string }[]).map(row => JSON.parse(row.data) as Task)
  }
  activeTasks(): Task[] {
    return (this.db.prepare("SELECT data FROM tasks WHERE state != 'completed' ORDER BY updated_at DESC").all() as { data: string }[]).map(row => JSON.parse(row.data) as Task)
  }
  history(query: HistoryQuery = {}): HistoryPage {
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 50))
    const offset = Math.max(0, Number(query.offset) || 0)
    const mediaType = query.mediaType && query.mediaType !== 'all' ? query.mediaType : null
    const search = (query.search || '').trim().toLowerCase().slice(0, 200)
    const rows = this.db.prepare(`SELECT data FROM tasks WHERE state = 'completed'
      AND (? IS NULL OR json_extract(data, '$.mediaType') = ?)
      AND (? = '' OR instr(lower(coalesce(json_extract(data, '$.title'), '') || ' ' || coalesce(json_extract(data, '$.service'), '')), ?) > 0)
      ORDER BY updated_at DESC, id DESC LIMIT ? OFFSET ?`).all(mediaType, mediaType, search, search, limit + 1, offset) as { data: string }[]
    return { items: rows.slice(0, limit).map(row => JSON.parse(row.data) as Task), nextOffset: rows.length > limit ? offset + limit : null }
  }
  getTask(id: string): Task | undefined {
    const row = this.db.prepare('SELECT data FROM tasks WHERE id = ?').get(id) as { data: string } | undefined
    return row ? JSON.parse(row.data) as Task : undefined
  }
  saveTask(task: Task): void {
    task.updatedAt = new Date().toISOString()
    this.db.prepare('INSERT INTO tasks (id,state,updated_at,data) VALUES (@id,@state,@updatedAt,@data) ON CONFLICT(id) DO UPDATE SET state=excluded.state,updated_at=excluded.updated_at,data=excluded.data').run({ id: task.id, state: task.state, updatedAt: task.updatedAt, data: JSON.stringify(task) })
  }
  deleteTask(id: string): void { this.db.prepare('DELETE FROM tasks WHERE id = ?').run(id) }
  getPreferences(): Preferences {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get('preferences') as { value: string }
    const stored = JSON.parse(row.value) as Partial<Preferences>
    return { downloadDirectory: stored.downloadDirectory || this.defaultDownloadDirectory, videoQuality: stored.videoQuality || 'max', audioFormat: stored.audioFormat || 'best', reducedMotion: !!stored.reducedMotion, locale: stored.locale === 'pt-BR' || stored.locale === 'en' ? stored.locale : 'system', tutorialSeenVersion: Number(stored.tutorialSeenVersion) || 0 }
  }
  setPreferences(preferences: Preferences): void {
    this.db.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('preferences', JSON.stringify(preferences))
  }
  clearHistory(): void { this.db.prepare("DELETE FROM tasks WHERE state = 'completed'").run() }
  close(): void { this.db.close() }
}
