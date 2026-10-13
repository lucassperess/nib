const copy = {
  'pt-BR': {
    subtitle: 'sessões privadas', intro: 'Conecte sua conta ao Nib somente quando um site pedir acesso.',
    language: 'Switch to English', service: 'Site da sua conta', choose: 'Escolha um site',
    detected: 'Aba detectada: {site}', unsupported: 'Esta aba não é de um site compatível. Escolha o site manualmente.',
    manual: 'Site escolhido manualmente: {site}', code: 'Código mostrado no Nib', send: 'Enviar sessão ao Nib',
    privacy: 'Os cookies do site escolhido vão somente para o Nib neste computador. A extensão não os guarda. Use apenas sua própria conta.',
    select: 'Escolha o site da sua conta.', missing: 'Digite o código mostrado no Nib.',
    empty: 'Nenhum cookie encontrado. Entre na sua conta neste navegador e tente de novo.',
    success: 'Sessão enviada. Confirme a conexão no Nib.', unavailable: 'Não foi possível conectar ao Nib. Abra o aplicativo e gere um novo código.',
    denied: 'Permita o acesso aos cookies desse site para enviar a sessão.', failed: 'Não foi possível enviar a sessão. Confira o site e o código.'
  },
  en: {
    subtitle: 'private sessions', intro: 'Connect your account to Nib only when a site requires access.',
    language: 'Mudar para português', service: 'Account site', choose: 'Choose a site',
    detected: 'Detected tab: {site}', unsupported: 'This tab is not a supported site. Choose a site manually.',
    manual: 'Manually selected site: {site}', code: 'Code shown in Nib', send: 'Send session to Nib',
    privacy: 'Cookies from the chosen site go only to Nib on this computer. The extension does not store them. Use only your own account.',
    select: 'Choose your account site.', missing: 'Enter the code shown in Nib.',
    empty: 'No cookies found. Sign in to your account in this browser and try again.',
    success: 'Session sent. Confirm the connection in Nib.', unavailable: 'Could not connect to Nib. Open the app and generate a new code.',
    denied: 'Allow access to this site’s cookies to send the session.', failed: 'Could not send the session. Check the site and code.'
  }
}

const sites = {
  youtube: { name: 'YouTube', domains: ['youtube.com'], origins: ['https://youtube.com/*', 'https://*.youtube.com/*'] },
  instagram: { name: 'Instagram', domains: ['instagram.com'], origins: ['https://instagram.com/*', 'https://*.instagram.com/*'] },
  twitter: { name: 'X', domains: ['x.com', 'twitter.com'], origins: ['https://x.com/*', 'https://*.x.com/*', 'https://twitter.com/*', 'https://*.twitter.com/*'] }
}

const byId = id => document.getElementById(id)
const serviceInput = byId('service')
const codeInput = byId('code')
const languageButton = byId('language')
const sendButton = byId('send')
const status = byId('status')
let language = 'pt-BR'
let detectedService = ''
let statusKey = ''

function siteForUrl(raw) {
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:') return ''
    const host = url.hostname.toLowerCase()
    if (host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com')) return 'youtube'
    if (host === 'instagram.com' || host.endsWith('.instagram.com')) return 'instagram'
    if (host === 'x.com' || host.endsWith('.x.com') || host === 'twitter.com' || host.endsWith('.twitter.com')) return 'twitter'
  } catch { /* Internal or unavailable tab. */ }
  return ''
}

function message(key, values = {}) {
  return copy[language][key].replace(/\{(\w+)\}/g, (_, name) => values[name] ?? '')
}

function render() {
  document.documentElement.lang = language
  byId('subtitle').textContent = message('subtitle')
  byId('intro').textContent = message('intro')
  byId('service-label').textContent = message('service')
  serviceInput.options[0].textContent = message('choose')
  byId('code-label').textContent = message('code')
  sendButton.textContent = message('send')
  byId('privacy').textContent = message('privacy')
  languageButton.textContent = language === 'pt-BR' ? 'EN' : 'PT'
  languageButton.setAttribute('aria-label', message('language'))
  byId('detected').textContent = !serviceInput.value ? message('unsupported')
    : serviceInput.value === detectedService ? message('detected', { site: sites[serviceInput.value].name })
      : message('manual', { site: sites[serviceInput.value].name })
  status.textContent = statusKey ? message(statusKey) : ''
}

function showStatus(key) { statusKey = key; render() }

languageButton.addEventListener('click', async () => {
  language = language === 'pt-BR' ? 'en' : 'pt-BR'
  await chrome.storage.local.set({ language })
  render()
})

serviceInput.addEventListener('change', () => {
  statusKey = ''
  render()
})

sendButton.addEventListener('click', async () => {
  const service = serviceInput.value
  const code = codeInput.value.trim().toUpperCase()
  if (!sites[service]) { showStatus('select'); return }
  if (!code) { showStatus('missing'); return }
  sendButton.disabled = true
  showStatus('')
  try {
    const permitted = await chrome.permissions.request({ origins: sites[service].origins })
    if (!permitted) { showStatus('denied'); return }
    const found = (await Promise.all(sites[service].domains.map(domain => chrome.cookies.getAll({ domain })))).flat()
    const unique = new Map()
    for (const cookie of found) {
      const host = cookie.domain.replace(/^\./, '').toLowerCase()
      if (!sites[service].domains.some(domain => host === domain || host.endsWith(`.${domain}`))) continue
      unique.set(`${cookie.domain}\t${cookie.path}\t${cookie.name}`, {
        domain: cookie.domain, path: cookie.path, name: cookie.name, value: cookie.value,
        secure: cookie.secure, httpOnly: cookie.httpOnly, expirationDate: cookie.expirationDate
      })
    }
    if (!unique.size) { showStatus('empty'); return }
    const response = await fetch('http://127.0.0.1:43837/session', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service, code, cookies: [...unique.values()] })
    })
    showStatus(response.ok ? 'success' : 'failed')
    if (response.ok) codeInput.value = ''
  } catch { showStatus('unavailable') }
  finally { sendButton.disabled = false }
})

async function initialize() {
  try {
    const saved = await chrome.storage.local.get({ language: 'pt-BR' })
    language = saved.language === 'en' ? 'en' : 'pt-BR'
  } catch { language = 'pt-BR' }
  render()
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    detectedService = siteForUrl(tab?.url)
    if (!serviceInput.value) serviceInput.value = detectedService
  } catch { detectedService = '' }
  render()
}

void initialize()
