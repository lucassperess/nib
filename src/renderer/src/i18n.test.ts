import { expect, it } from 'vitest'
import { resolveLanguage, translate } from './i18n'

it('chooses Portuguese for Portuguese Windows locales and English otherwise', () => {
  expect(resolveLanguage('system', 'pt-BR')).toBe('pt-BR')
  expect(resolveLanguage('system', 'pt-PT')).toBe('pt-BR')
  expect(resolveLanguage('system', 'en-US')).toBe('en')
  expect(resolveLanguage('en', 'pt-BR')).toBe('en')
})

it('translates the onboarding and file-saving states with values', () => {
  expect(translate('pt-BR', 'tourProgress', { step: 2 })).toBe('2 de 5')
  expect(translate('en', 'tourProgress', { step: 2 })).toBe('2 of 5')
  expect(translate('pt-BR', 'statusFinalizing')).toBe('Salvando arquivo')
  expect(translate('en', 'statusFinalizing')).toBe('Saving the file')
  expect(translate('pt-BR', 'transferExact', { received: '46,2 MB', total: '128 MB', percent: 36 })).toBe('46,2 MB de 128 MB · 36%')
  expect(translate('en', 'transferUnknown', { received: '46.2 MB' })).toBe('46.2 MB downloaded · total unavailable')
})
