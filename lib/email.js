import { Resend } from 'resend'

let resendClient = null

function getResendClient() {
  if (!resendClient) resendClient = new Resend(process.env.RESEND_API_KEY)
  return resendClient
}

export async function sendEmail({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM

  if (!apiKey || !from) {
    console.warn('[email] skipped: missing RESEND_API_KEY or EMAIL_FROM')
    return { skipped: true }
  }

  const resend = getResendClient()
  return await resend.emails.send({
    from,
    to,
    subject,
    html,
    text,
  })
}
