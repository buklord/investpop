function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function baseHtml({ title, body }) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#111;">
    <div style="max-width:560px;margin:0 auto;padding:24px;">
      <div style="font-size:18px;font-weight:700;margin-bottom:16px;">${escapeHtml(title)}</div>
      <div style="font-size:14px;line-height:1.5;">${body}</div>
      <div style="margin-top:24px;font-size:12px;color:#555;">Kartomtrades</div>
    </div>
  </body>
</html>`
}

export function welcomeEmail() {
  const subject = 'Welcome to Kartomtrades'
  const text = 'Your account has been created successfully. You can now log in and start trading.'
  const html = baseHtml({
    title: subject,
    body: `<p>${escapeHtml(text)}</p>`,
  })
  return { subject, text, html }
}

export function depositDecisionEmail({ approved, amount, method }) {
  const subject = approved ? 'Deposit approved' : 'Deposit rejected'
  const amountText = Number.isFinite(amount) ? `$${Number(amount).toFixed(2)}` : ''
  const methodText = method ? String(method) : ''

  const text = approved
    ? `Your deposit${amountText ? ` of ${amountText}` : ''}${methodText ? ` via ${methodText}` : ''} has been approved.`
    : `Your deposit request${methodText ? ` via ${methodText}` : ''} has been rejected. Please contact support if you have questions.`

  const html = baseHtml({
    title: subject,
    body: `<p>${escapeHtml(text)}</p>`,
  })

  return { subject, text, html }
}

export function withdrawalDecisionEmail({ approved, amount, method }) {
  const subject = approved ? 'Withdrawal approved' : 'Withdrawal rejected'
  const amountText = Number.isFinite(amount) ? `$${Number(amount).toFixed(2)}` : ''
  const methodText = method ? String(method) : ''

  const text = approved
    ? `Your withdrawal${amountText ? ` of ${amountText}` : ''}${methodText ? ` via ${methodText}` : ''} has been approved.`
    : `Your withdrawal request${amountText ? ` for ${amountText}` : ''}${methodText ? ` via ${methodText}` : ''} was rejected. Please contact support for details.`

  const html = baseHtml({
    title: subject,
    body: `<p>${escapeHtml(text)}</p>`,
  })

  return { subject, text, html }
}
