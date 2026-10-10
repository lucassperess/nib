import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { Preferences, Task } from '../shared/types'

export class Store {
  private db: Database.Database
  constructor(directory: string, defaultDownloadDirectory: string) {
    mkdirSync(directory, { recursive: true })
    this.db = new Database(join(directory, 'nib.sqlite'))
    this.db.pragma('journal_mode = WAL')
    this.db.exec(`CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, state TEXT NOT NULL, updated_at TEXT NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);`)
    if (!this.db.prepare('SELECT 1 FROM settings WHERE key = ?').get('preferences')) {
      this.setPreferences({ downloadDirectory: defaultDownloadDirectory, videoQuality: 'max', audioFormat: 'best', reducedMotion: false })
    }
    for (const task of this.tasks()) {
      if (['analyzing', 'transferring', 'processing'].includes(task.state)) {
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
    return JSON.parse(row.value) as Preferences
  }
  setPreferences(preferences: Preferences): void {
    this.db.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('preferences', JSON.stringify(preferences))
  }
  clearHistory(): void { this.db.prepare("DELETE FROM tasks WHERE state = 'completed'").run() }
  close(): void { this.db.close() }
}
