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
        <td width="48" height="48" bgcolor="#d4a017"
            style="width:48px;height:48px;border-radius:12px;background:#d4a017;
                   background-image:linear-gradient(135deg,#d4a017 0%,#f0c040 45%,#8B6914 100%);
                   text-align:center;vertical-align:middle;">
          <span style="display:inline-block;font-size:18px;line-height:48px;font-weight:900;color:#1a1200;
                       font-family:Arial,Helvetica,sans-serif;letter-spacing:0.5px;">VQ</span>
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
        <td align="left" bgcolor="#d4a017" style="border-radius:12px;">
          <a href="${safeHref}"
             style="display:inline-block;padding:12px 18px;font-size:14px;font-weight:800;text-decoration:none;color:#1a1200;-webkit-text-fill-color:#1a1200;border-radius:12px;">
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
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>${safeTitle}</title>
    <style>
      body, table, td, a { -webkit-text-size-adjust: 100%; }
      @media only screen and (max-width: 600px) {
        .mobile-padding { padding: 24px 12px !important; }
        .mobile-card { padding: 18px 14px !important; }
        .mobile-font { font-size: 13px !important; }
        .mobile-title { font-size: 18px !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#0f0a00;font-family:Arial,Helvetica,sans-serif;color:#1a1200;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${safePreheader}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#0f0a00"
           style="background:#0f0a00;background-image:linear-gradient(180deg,#0f0a00 0%,#1a1200 55%,#0f0a00 100%);">
      <tr>
        <td align="center" style="padding:34px 16px;" class="mobile-padding">
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;">
            <tr>
              <td style="padding:0 0 14px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="vertical-align:middle;">
                      ${logoMark}
                    </td>
                    <td style="vertical-align:middle;padding-left:12px;">
                      <div style="font-size:14px;font-weight:900;letter-spacing:0.2px;color:#f0c040;-webkit-text-fill-color:#f0c040;">Vaultquokka</div>
                      <div style="font-size:12px;color:#d4a017;-webkit-text-fill-color:#d4a017;">Invest. Trade. Grow.</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td>
                <div style="background:#1a1200;border-radius:18px;padding:1px;
                            background-image:linear-gradient(90deg,#d4a017 0%,#f0c040 45%,#8B6914 100%);">
                  <div style="background:#ffffff;border-radius:17px;padding:22px;" class="mobile-card">
                    <div style="font-size:20px;font-weight:900;margin:0 0 10px;color:#1a1200;-webkit-text-fill-color:#1a1200;" class="mobile-title">${safeTitle}</div>
                    <div style="font-size:14px;line-height:1.7;color:#1a1200;-webkit-text-fill-color:#1a1200;" class="mobile-font">${body}</div>
                  </div>
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding-top:14px;font-size:12px;line-height:1.6;color:#d4a017;-webkit-text-fill-color:#d4a017;">${footer || ''}</td>
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
  const dashboardUrl = 'https://www.vaultquokka.com/dashboard'

  // EXACT requested structure + content
  const subject = 'Welcome to Vaultquokka – Let’s get started!'

  const text = [
    'Welcome to the Future of Trading',
    `Hi ${greetingName},`,
    'We are excited to have you on board. Your account at Vaultquokka is now active and ready for use.',
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
    preheader: 'Welcome to Vaultquokka – Let’s get started!',
    title: 'Welcome to the Future of Trading',
    body: `
      <p style="margin:0 0 12px;"><strong>Hi ${escapeHtml(greetingName)},</strong></p>
      <p style="margin:0 0 14px;">We are excited to have you on board. Your account at <strong>Vaultquokka</strong> is now active and ready for use.</p>

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
    footer: `© ${new Date().getFullYear()} Vaultquokka.`,
  })

  return { subject, text, html }
}

export function depositDecisionEmail({ approved, amount, method }) {
  const walletUrl = 'https://www.vaultquokka.com/wallet'
  const dashboardUrl = 'https://www.vaultquokka.com/dashboard'
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
    footer: `© ${new Date().getFullYear()} Vaultquokka.`,
  })

  return { subject, text, html }
}

export function depositRequestReceivedEmail({ amount, method, address } = {}) {
  const walletUrl = 'https://www.vaultquokka.com/wallet'
  const amountText = Number.isFinite(amount) ? `$${Number(amount).toFixed(2)}` : ''
  const methodText = method ? String(method) : ''
  const addressText = address ? String(address) : ''

  const subject = 'Deposit request received'

  const text = [
    'Deposit request received',
    `Amount: ${amountText || '—'}`,
    `Method: ${methodText || '—'}`,
    `Deposit address: ${addressText || '—'}`,
    '',
    'Your deposit request has been received and is now pending review.',
    'Once approved, your Real Wallet balance will update and you will receive a confirmation email.',
    '',
    `View Wallet: ${walletUrl}`,
    '',
    'If you did not request this deposit, please contact us immediately to secure your information.'
  ].join('\n')

  const html = baseHtml({
    preheader: 'Your deposit request is pending review.',
    title: 'Deposit request received',
    body: `
      <div style="margin:0 0 12px;">${badgeHtml({ label: 'PENDING', variant: 'info' })}</div>

      <p style="margin:0 0 14px;">We’ve received your deposit request and it is now <strong>pending review</strong>.</p>

      ${detailsCardHtml({
        title: 'Deposit details',
        rows: [
          { label: 'Status', value: 'PENDING' },
          { label: 'Amount', value: amountText || '—' },
          { label: 'Method', value: methodText || '—' },
          { label: 'Address', value: addressText || '—' },
        ]
      })}

      <div style="margin:0 0 6px;font-weight:900;">What happens next</div>
      <ul style="margin:0 0 6px;padding-left:18px;">
        <li style="margin:0 0 6px;">Our team reviews your request.</li>
        <li style="margin:0;">You’ll receive an email once it’s approved or rejected.</li>
      </ul>

      ${buttonHtml({ href: walletUrl, label: 'View Wallet' })}

      <div style="margin-top:18px;padding-top:14px;border-top:1px solid #e5e7eb;">
        <div style="font-size:12px;color:#6b7280;line-height:1.55;">
          <div style="margin:0;">If you did not request this deposit, please contact us immediately to secure your information.</div>
        </div>
      </div>
    `,
    footer: `© ${new Date().getFullYear()} Vaultquokka.`,
  })

  return { subject, text, html }
}

export function withdrawalDecisionEmail({ approved, amount, method }) {
  const walletUrl = 'https://www.vaultquokka.com/wallet'
  const dashboardUrl = 'https://www.vaultquokka.com/dashboard'
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
    footer: `© ${new Date().getFullYear()} Vaultquokka.`,
  })

  return { subject, text, html }
}

export function verificationEmail({ verificationUrl, firstName, lastName } = {}) {
  const name = formatName({ firstName, lastName })
  const greetingName = name || 'there'

  const subject = 'Welcome to Vaultquokka — Confirm your email to get started'

  const text = [
    'Welcome to Vaultquokka!',
    '',
    `Hi ${greetingName},`,
    'Thank you for joining Vaultquokka — your all-in-one platform for investing, trading, and growing your wealth.',
    '',
    'WHAT YOU GET:',
    '- $100,000 virtual funds to practice risk-free',
    '- Real-time market data and live trading conditions',
    '- Multi-asset support: crypto, stocks, forex, and more',
    '- Secure wallet with easy deposits and withdrawals',
    '- Portfolio tracking and performance analytics',
    '',
    'GET STARTED:',
    'Please verify your email address to activate your account and unlock full access.',
    '',
    `Verify your email: ${verificationUrl}`,
    '',
    'This link expires in 24 hours.',
    '',
    'If you did not create this account, please ignore this email.',
    '',
    'Questions? Reply to this email and our support team will be happy to help.',
    '',
    'The Vaultquokka Team'
  ].join('\n')

  const html = baseHtml({
    preheader: 'Welcome to Vaultquokka! Verify your email to unlock $100K virtual funds and start trading.',
    title: 'Welcome to Vaultquokka!',
    body: `
      <p style="margin:0 0 14px;"><strong>Hi ${escapeHtml(greetingName)},</strong></p>

      <p style="margin:0 0 18px;">
        Thank you for joining <strong>Vaultquokka</strong> — your all-in-one platform for investing, trading, and growing your wealth.
        We are excited to have you on board.
      </p>

      <div style="margin:0 0 18px;padding:16px;background:#fffbeb;border:1px solid #fde68a;border-radius:12px;">
        <div style="font-size:13px;font-weight:900;color:#92400e;margin-bottom:10px;letter-spacing:0.3px;">WHAT YOU GET</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr>
            <td style="padding:5px 0;font-size:13px;color:#1a1200;vertical-align:top;width:22px;">&#128176;</td>
            <td style="padding:5px 0;font-size:13px;color:#1a1200;vertical-align:top;"><strong>$100,000 virtual funds</strong> to practice risk-free</td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:13px;color:#1a1200;vertical-align:top;width:22px;">&#128200;</td>
            <td style="padding:5px 0;font-size:13px;color:#1a1200;vertical-align:top;">Real-time market data and <strong>live trading conditions</strong></td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:13px;color:#1a1200;vertical-align:top;width:22px;">&#128241;</td>
            <td style="padding:5px 0;font-size:13px;color:#1a1200;vertical-align:top;">Multi-asset support: crypto, stocks, forex &amp; commodities</td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:13px;color:#1a1200;vertical-align:top;width:22px;">&#128272;</td>
            <td style="padding:5px 0;font-size:13px;color:#1a1200;vertical-align:top;">Secure wallet with easy deposits and withdrawals</td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:13px;color:#1a1200;vertical-align:top;width:22px;">&#128202;</td>
            <td style="padding:5px 0;font-size:13px;color:#1a1200;vertical-align:top;">Portfolio tracking and performance analytics</td>
          </tr>
        </table>
      </div>

      <div style="margin:0 0 18px;padding:16px;background:#fef3c7;border:1px solid #f59e0b;border-radius:12px;text-align:center;">
        <div style="font-size:13px;font-weight:900;color:#92400e;margin-bottom:8px;">READY TO START?</div>
        <div style="font-size:13px;color:#78350f;margin-bottom:14px;">Verify your email to activate your account and unlock full access.</div>
        ${buttonHtml({ href: verificationUrl, label: 'Verify Email & Get Started' })}
      </div>

      <div style="margin:0 0 14px;padding:14px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;">
        <div style="font-size:12px;color:#6b7280;margin-bottom:8px;font-weight:700;">Or copy and paste this URL into your browser:</div>
        <div style="font-size:12px;color:#d4a017;word-break:break-all;">${escapeHtml(verificationUrl)}</div>
      </div>

      <div style="margin-top:18px;padding-top:14px;border-top:1px solid #e5e7eb;">
        <div style="font-size:12px;color:#6b7280;line-height:1.55;">
          <div style="margin:0 0 6px;">This link expires in 24 hours.</div>
          <div style="margin:0 0 10px;">If you did not create this account, please ignore this email.</div>
          <div style="margin:0;">Questions? Reply to this email and our support team will be happy to help.</div>
        </div>
      </div>
    `,
    footer: `&copy; ${new Date().getFullYear()} Vaultquokka. All rights reserved.<br>Your gateway to smart investing.`,
  })

  return { subject, text, html }
}

export function withdrawalRequestReceivedEmail({ amount, method, address } = {}) {
  const walletUrl = 'https://www.vaultquokka.com/wallet'
  const amountText = Number.isFinite(amount) ? `$${Number(amount).toFixed(2)}` : ''
  const methodText = method ? String(method) : ''
  const addressText = address ? String(address) : ''

  const subject = 'Withdrawal request received'

  const text = [
    'Withdrawal request received',
    `Amount: ${amountText || '—'}`,
    `Method: ${methodText || '—'}`,
    `Address: ${addressText || '—'}`,
    '',
    'Your withdrawal request has been received and is now pending review.',
    'You will receive a confirmation email once it is approved or rejected.',
    '',
    `View Wallet: ${walletUrl}`,
    '',
    'If you did not request this withdrawal, please contact us immediately to secure your information.'
  ].join('\n')

  const html = baseHtml({
    preheader: 'Your withdrawal request is pending review.',
    title: 'Withdrawal request received',
    body: `
      <div style="margin:0 0 12px;">${badgeHtml({ label: 'PENDING', variant: 'info' })}</div>

      <p style="margin:0 0 14px;">We’ve received your withdrawal request and it is now <strong>pending review</strong>.</p>

      ${detailsCardHtml({
        title: 'Withdrawal details',
        rows: [
          { label: 'Status', value: 'PENDING' },
          { label: 'Amount', value: amountText || '—' },
          { label: 'Method', value: methodText || '—' },
          { label: 'Address', value: addressText || '—' },
        ]
      })}

      <div style="margin:0 0 6px;font-weight:900;">What happens next</div>
      <ul style="margin:0 0 6px;padding-left:18px;">
        <li style="margin:0 0 6px;">Our team reviews your request.</li>
        <li style="margin:0;">You’ll receive an email once it’s approved or rejected.</li>
      </ul>

      ${buttonHtml({ href: walletUrl, label: 'View Wallet' })}

      <div style="margin-top:18px;padding-top:14px;border-top:1px solid #e5e7eb;">
        <div style="font-size:12px;color:#6b7280;line-height:1.55;">
          <div style="margin:0;">If you did not request this withdrawal, please contact us immediately to secure your information.</div>
        </div>
      </div>
    `,
    footer: `© ${new Date().getFullYear()} Vaultquokka.`,
  })

  return { subject, text, html }
}
