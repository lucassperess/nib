const pt = navigator.language.toLowerCase().startsWith('pt')
const copy = pt ? {
  subtitle: 'sessões privadas', intro: 'No Nib, abra Configurações → Sessões privadas e gere um código. Depois escolha o site aqui.',
  service: 'Site da sua conta', code: 'Código mostrado no Nib', send: 'Enviar sessão ao Nib',
  privacy: 'Os cookies desse site serão enviados somente ao Nib neste computador. Nada é salvo pela extensão. Faça isso apenas para sua própria conta.',
  missing: 'Digite o código mostrado no Nib.', empty: 'Nenhum cookie encontrado. Entre na sua conta no navegador e tente de novo.',
  success: 'Sessão enviada. Volte ao Nib para continuar.', unavailable: 'Não foi possível conectar ao Nib. Abra o aplicativo e gere um novo código.',
  denied: 'É preciso permitir acesso a esse site para enviar a sessão.', failed: 'Não foi possível enviar a sessão. Confira o código e tente novamente.'
} : {
  subtitle: 'private sessions', intro: 'In Nib, open Settings → Private sessions and generate a code. Then choose the site here.',
  service: 'Account site', code: 'Code shown in Nib', send: 'Send session to Nib',
  privacy: 'Cookies from this site are sent only to Nib on this computer. The extension stores nothing. Use it only with your own account.',
  missing: 'Enter the code shown in Nib.', empty: 'No cookies found. Sign in to your account in the browser and try again.',
  success: 'Session sent. Return to Nib to continue.', unavailable: 'Could not connect to Nib. Open the app and generate a new code.',
  denied: 'Allow access to this site to send the session.', failed: 'Could not send the session. Check the code and try again.'
}
for (const [id, value] of Object.entries({ subtitle: copy.subtitle, intro: copy.intro, 'service-label': copy.service, 'code-label': copy.code, send: copy.send, privacy: copy.privacy })) document.getElementById(id).textContent = value

const sites = {
  youtube: { domains: ['youtube.com'], origins: ['https://youtube.com/*', 'https://*.youtube.com/*'] },
  instagram: { domains: ['instagram.com'], origins: ['https://instagram.com/*', 'https://*.instagram.com/*'] },
  twitter: { domains: ['x.com', 'twitter.com'], origins: ['https://x.com/*', 'https://*.x.com/*', 'https://twitter.com/*', 'https://*.twitter.com/*'] }
}
const button = document.getElementById('send')
const status = document.getElementById('status')
button.addEventListener('click', async () => {
  const service = document.getElementById('service').value
  const code = document.getElementById('code').value.trim().toUpperCase()
  if (!code) { status.textContent = copy.missing; return }
  button.disabled = true
  status.textContent = ''
  try {
    const permitted = await chrome.permissions.request({ origins: sites[service].origins })
    if (!permitted) { status.textContent = copy.denied; return }
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
    if (!unique.size) { status.textContent = copy.empty; return }
    const response = await fetch('http://127.0.0.1:43837/session', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service, code, cookies: [...unique.values()] })
    })
    status.textContent = response.ok ? copy.success : copy.failed
    if (response.ok) document.getElementById('code').value = ''
  } catch { status.textContent = copy.unavailable }
  finally { button.disabled = false }
})
