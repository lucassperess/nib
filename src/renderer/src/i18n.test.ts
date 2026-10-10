import { expect, it } from 'vitest'
import { resolveLanguage, translate } from './i18n'

it('chooses Portuguese for Portuguese Windows locales and English otherwise', () => {
  expect(resolveLanguage('system', 'pt-BR')).toBe('pt-BR')
  expect(resolveLanguage('system', 'pt-PT')).toBe('pt-BR')
  expect(resolveLanguage('system', 'en-US')).toBe('en')
  expect(resolveLanguage('en', 'pt-BR')).toBe('en')
})

it('translates the onboarding and file-saving states with values', () => {
  expect(translate('pt-BR', 'tourProgress', { step: 2 })).toBe('2 de 3')
  expect(translate('en', 'tourProgress', { step: 2 })).toBe('2 of 3')
  expect(translate('pt-BR', 'statusFinalizing')).toBe('Salvando arquivo')
  expect(translate('en', 'statusFinalizing')).toBe('Saving the file')
})
