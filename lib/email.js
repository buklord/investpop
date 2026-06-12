import { Resend } from 'resend'

let resendClient = null

function getResendClient() {
  if (!resendClient) resendClient = new Resend(process.env.RESEND_API_KEY)
  return resendClient
}

export async function sendEmail({ to, subject, html, text, replyTo }) {
  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = (process.env.EMAIL_FROM || 'info@vaultquokka.com').toLowerCase()
  const fromName = process.env.EMAIL_FROM_NAME || 'Vaultquokka'

  if (!apiKey) {
    console.warn('[email] skipped: missing RESEND_API_KEY')
    return { skipped: true }
  }

  const resend = getResendClient()

  try {
    const result = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to,
      replyTo: replyTo || fromEmail,
      subject,
      html,
      text: text || html.replace(/<[^>]*>?/gm, ''),
      headers: {
        'X-Entity-Ref-ID': `vaultquokka-${Date.now()}`,
      }
    })
    return { ok: true, result }
  } catch (err) {
    console.error('[email] send failed:', err?.message || err)
    return { ok: false, error: err?.message || String(err) }
  }
}
