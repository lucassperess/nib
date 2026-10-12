import { expect, it } from 'vitest'
import { TransferProgressTracker } from './progress'

it('combines the video and audio streams into one monotonic download total', () => {
  const tracker = new TransferProgressTracker()
  expect(tracker.consume('NIB_SELECTED:NA:533067:223779:309288:NA')).toMatchObject({ total: 533067, totalKind: 'exact' })
  expect(tracker.consume('NIB_PROGRESS:100000:223779:NA:1000:395')).toMatchObject({ received: 100000, total: 533067 })
  expect(tracker.consume('NIB_PROGRESS:223779:223779:NA:1000:395')?.fraction).toBeCloseTo(223779 / 533067)
  expect(tracker.consume('NIB_PROGRESS:1024:309288:NA:1000:140')).toMatchObject({ received: 224803, total: 533067 })
  expect(tracker.consume('NIB_PROGRESS:309288:309288:NA:1000:140')).toMatchObject({ received: 533067, fraction: 1 })
})

it('does not invent a percentage when the transfer total is unavailable', () => {
  const tracker = new TransferProgressTracker()
  tracker.consume('NIB_SELECTED:NA:NA:NA:NA:NA')
  expect(tracker.consume('NIB_PROGRESS:46200000:NA:NA:NA:unknown')).toMatchObject({
    received: 46200000, total: null, totalKind: 'unknown', fraction: null
  })
})
