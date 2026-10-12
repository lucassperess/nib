import { contextBridge, ipcRenderer } from 'electron'
import type { AppSnapshot, ConversionFormat, HistoryQuery, MediaMode, NibApi, Preferences, SessionService, Task } from '../shared/types'

const api: NibApi = {
  snapshot: () => ipcRenderer.invoke('nib:snapshot'),
  history: (query: HistoryQuery) => ipcRenderer.invoke('nib:history', query),
  submit: (url: string, mode: MediaMode) => ipcRenderer.invoke('nib:submit', url, mode),
  select: (id: string, indexes: number[]) => ipcRenderer.invoke('nib:select', id, indexes),
  taskAction: (id, action) => ipcRenderer.invoke('nib:task-action', id, action),
  setPreferences: (patch: Partial<Preferences>) => ipcRenderer.invoke('nib:set-preferences', patch),
  chooseDirectory: () => ipcRenderer.invoke('nib:choose-directory'),
  importSession: (service: SessionService, cookie: string) => ipcRenderer.invoke('nib:import-session', service, cookie),
  clearSession: (service: SessionService) => ipcRenderer.invoke('nib:clear-session', service),
  clearHistory: () => ipcRenderer.invoke('nib:clear-history'),
  openPath: (path: string, folder: boolean) => ipcRenderer.invoke('nib:open-path', path, folder),
  convertFile: (format: ConversionFormat) => ipcRenderer.invoke('nib:convert-file', format),
  exportDiagnostics: () => ipcRenderer.invoke('nib:export-diagnostics'),
  openReleases: () => ipcRenderer.invoke('nib:open-releases'),
  restartEngine: () => ipcRenderer.invoke('nib:restart-engine'),
  updateEngine: () => ipcRenderer.invoke('nib:update-engine'),
  onSnapshot: (callback: (snapshot: AppSnapshot) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: AppSnapshot) => callback(data)
    ipcRenderer.on('nib:snapshot', listener)
    return () => ipcRenderer.removeListener('nib:snapshot', listener)
  },
  onTask: (callback: (task: Task) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, task: Task) => callback(task)
    ipcRenderer.on('nib:task', listener)
    return () => ipcRenderer.removeListener('nib:task', listener)
  }
}
contextBridge.exposeInMainWorld('nib', api)
