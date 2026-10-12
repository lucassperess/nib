export type TotalKind = 'exact' | 'estimated' | 'unknown'
export interface TransferProgress {
  received: number
  total: number | null
  totalKind: TotalKind
  fraction: number | null
}

const number = (value: string | undefined): number | null => {
  const parsed = Number(value)
  return value && value !== 'NA' && Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

/** yt-dlp reports each requested stream separately; combine completed streams without resetting the UI. */
export class TransferProgressTracker {
  private completed = 0
  private currentFormat = ''
  private currentBytes = 0
  private currentTotal = 0
  private selectedTotal: number | null = null
  private selectedSeen = false
  private kind: TotalKind = 'unknown'

  consume(line: string): TransferProgress | null {
    if (line.startsWith('NIB_SELECTED:')) {
      this.selectedSeen = true
      const [, exact, approx, first, second, third] = line.split(':')
      const parts = [number(first), number(second), number(third)]
      const exactTotal = number(exact)
      if (exactTotal) { this.selectedTotal = exactTotal; this.kind = 'exact' }
      else if (parts[0] && parts[1] && !parts[2]) {
        this.selectedTotal = parts[0] + parts[1]
        this.kind = 'exact'
      } else {
        this.selectedTotal = number(approx)
        this.kind = this.selectedTotal ? 'estimated' : 'unknown'
      }
      return this.snapshot()
    }
    const match = line.match(/^NIB_PROGRESS:(\d+):([^:]+):([^:]+):([^:]+):(.+)$/)
    if (!match) return null
    const received = Number(match[1])
    if (!Number.isFinite(received)) return null
    const format = match[5].trim()
    const exact = number(match[2])
    const approximate = number(match[3])
    if (this.currentFormat && format !== this.currentFormat) {
      this.completed += Math.max(this.currentBytes, this.currentTotal)
      this.currentBytes = 0
      this.currentTotal = 0
    }
    this.currentFormat = format
    this.currentBytes = Math.max(this.currentBytes, received)
    this.currentTotal = Math.max(this.currentTotal, exact || approximate || 0)
    if (!this.selectedSeen && !this.selectedTotal && this.completed === 0 && this.currentTotal) {
      this.kind = exact ? 'exact' : 'estimated'
      this.selectedTotal = this.currentTotal
    }
    return this.snapshot()
  }

  private snapshot(): TransferProgress {
    const received = this.completed + this.currentBytes
    const total = this.selectedTotal
    return {
      received,
      total,
      totalKind: this.kind,
      fraction: total && this.kind === 'exact' ? Math.min(received / total, 1) : null
    }
  }
}
