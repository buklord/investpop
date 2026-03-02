function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function logoMarkHtml() {
  // Use a pure-HTML mark instead of a remote image so it still renders when
  // email clients block remote images by default (e.g. Proton, Gmail, Outlook).
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:separate;">
      <tr>
        <td width="44" height="44" bgcolor="#2563EB"
            style="width:44px;height:44px;border-radius:12px;background:#2563EB;
                   background-image:linear-gradient(135deg,#2563EB 0%,#06B6D4 45%,#111827 100%);
                   text-align:center;vertical-align:middle;">
          <span style="display:inline-block;font-size:22px;line-height:44px;font-weight:900;color:#ffffff;
                       font-family:Arial,Helvetica,sans-serif;">K</span>
        </td>
      </tr>
    </table>
  `
}

function badgeHtml({ label, variant }) {
  const safe = escapeHtml(label)
  const styles = variant === 'success'
    ? { bg: '#ECFDF5', border: '#A7F3D0', fg: '#065F46' }
    : variant === 'danger'
      ? { bg: '#FEF2F2', border: '#FECACA', fg: '#991B1B' }
      : { bg: '#EFF6FF', border: '#BFDBFE', fg: '#1D4ED8' }
  return `
    <span style="display:inline-block;font-size:12px;font-weight:900;letter-spacing:0.4px;text-transform:uppercase;
                 padding:6px 10px;border-radius:999px;background:${styles.bg};border:1px solid ${styles.border};color:${styles.fg};">
      ${safe}
    </span>
  `
}

function detailsCardHtml({ title, rows }) {
  const safeTitle = escapeHtml(title)
  const safeRows = (rows || [])
    .map(r => `
      <tr>
        <td style="padding:6px 0;color:#6b7280;font-size:12px;font-weight:700;vertical-align:top;width:130px;">${escapeHtml(r.label)}</td>
        <td style="padding:6px 0;color:#111827;font-size:14px;font-weight:700;vertical-align:top;">${escapeHtml(r.value)}</td>
      </tr>
    `)
    .join('')
  return `
    <div style="margin:0 0 14px;padding:14px 14px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;">
      <div style="font-size:12px;color:#6b7280;margin-bottom:10px;font-weight:900;letter-spacing:0.2px;">${safeTitle}</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        ${safeRows}
      </table>
    </div>
  `
}

function buttonHtml({ href, label }) {
  const safeHref = escapeHtml(href)
  const safeLabel = escapeHtml(label)
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 0;">
      <tr>
        <td align="left" bgcolor="#2563EB" style="border-radius:12px;">
          <a href="${safeHref}"
             style="display:inline-block;padding:12px 18px;font-size:14px;font-weight:800;text-decoration:none;color:#ffffff;border-radius:12px;">
            ${safeLabel}
          </a>
        </td>
      </tr>
    </table>
  `
}

function baseHtml({ preheader, title, body, footer }) {
  const safeTitle = escapeHtml(title)
  const safePreheader = escapeHtml(preheader || '')
  const logoMark = logoMarkHtml()
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0;padding:0;background:#0b1220;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${safePreheader}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#0b1220"
           style="background:#0b1220;background-image:linear-gradient(180deg,#0b1220 0%,#0f172a 55%,#0b1220 100%);">
      <tr>
        <td align="center" style="padding:34px 16px;">
          <table role="presentation" width="620" cellpadding="0" cellspacing="0" style="width:100%;max-width:620px;">
            <tr>
              <td style="padding:0 0 14px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="vertical-align:middle;">
                      ${logoMark}
                    </td>
                    <td style="vertical-align:middle;padding-left:12px;">
                      <div style="font-size:14px;font-weight:900;letter-spacing:0.2px;color:#e5e7eb;">Kartomtrades</div>
                      <div style="font-size:12px;color:#94a3b8;">Secure trading platform</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td>
                <div style="background:#111827;border-radius:18px;padding:1px;
                            background-image:linear-gradient(90deg,#2563EB 0%,#06B6D4 45%,#111827 100%);">
                  <div style="background:#ffffff;border-radius:17px;padding:22px;
                              background-image:linear-gradient(180deg,#ffffff 0%,#f8fafc 100%);">
                    <div style="font-size:20px;font-weight:900;margin:0 0 10px;color:#0f172a;">${safeTitle}</div>
                    <div style="font-size:14px;line-height:1.7;color:#111827;">${body}</div>
                  </div>
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding-top:14px;font-size:12px;line-height:1.6;color:#94a3b8;">${footer || ''}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function formatName({ firstName, lastName } = {}) {
  const fn = typeof firstName === 'string' ? firstName.trim() : ''
  const ln = typeof lastName === 'string' ? lastName.trim() : ''
  const full = `${fn} ${ln}`.trim()
  return full || ''
}

export function welcomeEmail({ firstName, lastName } = {}) {
  const name = formatName({ firstName, lastName })
  const greetingName = name || 'User'
  const dashboardUrl = 'https://www.kartomtrades.com/dashboard'

  // EXACT requested structure + content
  const subject = 'Welcome to Kartomtrades – Let’s get started!'

  const text = [
    'Welcome to the Future of Trading',
    `Hi ${greetingName},`,
    'We are excited to have you on board. Your account at Kartomtrades is now active and ready for use.',
    '',
    'Next Steps:',
    '• Step 1: Make your first deposit to fund your trading wallet.',
    '• Step 2: Start exploring the markets and open your first trade.',
    '',
    `Go to Dashboard: ${dashboardUrl}`,
    '',
    'If you have any questions, feel free to reply to this email or visit our support center.',
    'If you did not create this account, please contact us immediately to secure your information.'
  ].join('\n')

  const html = baseHtml({
    preheader: 'Welcome to Kartomtrades – Let’s get started!',
    title: 'Welcome to the Future of Trading',
    body: `
      <p style="margin:0 0 12px;"><strong>Hi ${escapeHtml(greetingName)},</strong></p>
      <p style="margin:0 0 14px;">We are excited to have you on board. Your account at <strong>Kartomtrades</strong> is now active and ready for use.</p>

      <div style="margin:14px 0 10px;font-weight:900;">Next Steps</div>
      <ul style="margin:0 0 6px;padding-left:18px;">
        <li style="margin:0 0 6px;">Step 1: Make your first deposit to fund your trading wallet.</li>
        <li style="margin:0;">Step 2: Start exploring the markets and open your first trade.</li>
      </ul>

      ${buttonHtml({ href: dashboardUrl, label: 'Go to Dashboard' })}

      <div style="margin-top:18px;padding-top:14px;border-top:1px solid #e5e7eb;">
        <div style="font-size:12px;color:#6b7280;line-height:1.55;">
          <div style="margin:0 0 10px;">If you have any questions, feel free to reply to this email or visit our support center.</div>
          <div style="margin:0;">If you did not create this account, please contact us immediately to secure your information.</div>
        </div>
      </div>
    `,
    footer: `© ${new Date().getFullYear()} Kartomtrades.`,
  })

  return { subject, text, html }
}

export function depositDecisionEmail({ approved, amount, method }) {
  const walletUrl = 'https://www.kartomtrades.com/wallet'
  const dashboardUrl = 'https://www.kartomtrades.com/dashboard'
  const subject = approved ? 'Deposit approved' : 'Deposit rejected'
  const amountText = Number.isFinite(amount) ? `$${Number(amount).toFixed(2)}` : ''
  const methodText = method ? String(method) : ''
  const statusLabel = approved ? 'APPROVED' : 'REJECTED'

  const text = approved
    ? [
        'Deposit approved',
        `Amount: ${amountText || '—'}`,
        `Method: ${methodText || '—'}`,
        '',
        'Your deposit has been approved. Your Real Wallet balance will update shortly.',
        '',
        'What happens next:',
        '• Your wallet balance updates once the credit is confirmed.',
        '• You can start exploring markets and place your first trade from the dashboard.',
        '',
        `View Wallet: ${walletUrl}`,
        `Go to Dashboard: ${dashboardUrl}`,
        '',
        'If you did not request this deposit, please contact us immediately to secure your information.'
      ].join('\n')
    : [
        'Deposit rejected',
        `Amount: ${amountText || '—'}`,
        `Method: ${methodText || '—'}`,
        '',
        'Your deposit request was rejected. If you believe this was a mistake, please reply to this email and our team will help.',
        '',
        'What you can do now:',
        '• Double-check the deposit method and amount.',
        '• Re-submit the request from your wallet page.',
        '',
        `View Wallet: ${walletUrl}`,
        '',
        'If you did not request this deposit, please contact us immediately to secure your information.'
      ].join('\n')

  const html = baseHtml({
    preheader: approved ? 'Your deposit was approved.' : 'Your deposit request was rejected.',
    title: approved ? 'Deposit approved' : 'Deposit rejected',
    body: `
      <div style="margin:0 0 12px;">${badgeHtml({ label: statusLabel, variant: approved ? 'success' : 'danger' })}</div>

      <p style="margin:0 0 14px;">${approved
        ? 'Your deposit has been <strong>approved</strong>. Your Real Wallet balance will update shortly.'
        : 'Your deposit request has been <strong>rejected</strong>. If you believe this was a mistake, please reply to this email and our team will help.'
      }</p>

      ${detailsCardHtml({
        title: 'Deposit details',
        rows: [
          { label: 'Status', value: statusLabel },
          { label: 'Amount', value: amountText || '—' },
          { label: 'Method', value: methodText || '—' },
        ]
      })}

      <div style="margin:0 0 6px;font-weight:900;">${approved ? 'What happens next' : 'What you can do now'}</div>
      <ul style="margin:0 0 6px;padding-left:18px;">
        ${approved
          ? `
            <li style="margin:0 0 6px;">Your wallet balance updates once the credit is confirmed.</li>
            <li style="margin:0;">Explore markets and place your first trade from the dashboard.</li>
          `
          : `
            <li style="margin:0 0 6px;">Double-check the deposit method and amount.</li>
            <li style="margin:0;">Re-submit the request from your wallet page.</li>
          `
        }
      </ul>

      ${buttonHtml({ href: walletUrl, label: 'View Wallet' })}
      ${approved ? buttonHtml({ href: dashboardUrl, label: 'Go to Dashboard' }) : ''}

      <div style="margin-top:18px;padding-top:14px;border-top:1px solid #e5e7eb;">
        <div style="font-size:12px;color:#6b7280;line-height:1.55;">
          <div style="margin:0;">If you did not request this deposit, please contact us immediately to secure your information.</div>
        </div>
      </div>
    `,
    footer: `© ${new Date().getFullYear()} Kartomtrades.`,
  })

  return { subject, text, html }
}

export function withdrawalDecisionEmail({ approved, amount, method }) {
  const walletUrl = 'https://www.kartomtrades.com/wallet'
  const dashboardUrl = 'https://www.kartomtrades.com/dashboard'
  const subject = approved ? 'Withdrawal approved' : 'Withdrawal rejected'
  const amountText = Number.isFinite(amount) ? `$${Number(amount).toFixed(2)}` : ''
  const methodText = method ? String(method) : ''
  const statusLabel = approved ? 'APPROVED' : 'REJECTED'

  const text = approved
    ? [
        'Withdrawal approved',
        `Amount: ${amountText || '—'}`,
        `Method: ${methodText || '—'}`,
        '',
        'Your withdrawal has been approved. Processing times may vary depending on the network and payment method.',
        '',
        'What happens next:',
        '• Your withdrawal will be processed by our team.',
        '• You can keep trading while the withdrawal completes.',
        `View Wallet: ${walletUrl}`,
        '',
        'If you did not request this withdrawal, contact us immediately.'
      ].join('\n')
    : [
        'Withdrawal rejected',
        `Amount: ${amountText || '—'}`,
        `Method: ${methodText || '—'}`,
        '',
        'Your withdrawal request was rejected. Please reply to this email if you need help or clarification.',
        '',
        'Common reasons:',
        '• KYC not completed',
        '• Insufficient available Real Wallet balance',
        '• Address format mismatch',
        `View Wallet: ${walletUrl}`,
        '',
        'If you did not request this withdrawal, contact us immediately.'
      ].join('\n')

  const html = baseHtml({
    preheader: approved ? 'Your withdrawal was approved.' : 'Your withdrawal request was rejected.',
    title: approved ? 'Withdrawal approved' : 'Withdrawal rejected',
    body: `
      <div style="margin:0 0 12px;">${badgeHtml({ label: statusLabel, variant: approved ? 'success' : 'danger' })}</div>

      <p style="margin:0 0 14px;">${approved
        ? 'Your withdrawal has been <strong>approved</strong>. Processing times may vary depending on the network and payment method.'
        : 'Your withdrawal request has been <strong>rejected</strong>. Please reply to this email if you need help or clarification.'
      }</p>

      ${detailsCardHtml({
        title: 'Withdrawal details',
        rows: [
          { label: 'Status', value: statusLabel },
          { label: 'Amount', value: amountText || '—' },
          { label: 'Method', value: methodText || '—' },
        ]
      })}

      <div style="margin:0 0 6px;font-weight:900;">${approved ? 'What happens next' : 'Common reasons'}</div>
      <ul style="margin:0 0 6px;padding-left:18px;">
        ${approved
          ? `
            <li style="margin:0 0 6px;">Your withdrawal will be processed by our team.</li>
            <li style="margin:0;">You can keep trading while the withdrawal completes.</li>
          `
          : `
            <li style="margin:0 0 6px;">KYC not completed</li>
            <li style="margin:0 0 6px;">Insufficient available Real Wallet balance</li>
            <li style="margin:0;">Address format mismatch</li>
          `
        }
      </ul>

      ${buttonHtml({ href: walletUrl, label: 'View Wallet' })}
      ${approved ? buttonHtml({ href: dashboardUrl, label: 'Go to Dashboard' }) : ''}

      <div style="margin-top:18px;padding-top:14px;border-top:1px solid #e5e7eb;">
        <div style="font-size:12px;color:#6b7280;line-height:1.55;">
          <div style="margin:0;">If you did not request this withdrawal, please contact us immediately to secure your information.</div>
        </div>
      </div>
    `,
    footer: `© ${new Date().getFullYear()} Kartomtrades.`,
  })

  return { subject, text, html }
}
