import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy — Kartomtrades',
  description: 'How Kartomtrades collects, uses, and protects your personal information.',
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* Header */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-black text-base leading-none">K</span>
            </div>
            <span className="text-sm font-bold">Kartomtrades</span>
          </Link>
          <Link href="/" className="text-white/40 hover:text-white text-sm transition-colors">← Back to home</Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-14">
        <div className="mb-10">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-400 mb-3">Legal</p>
          <h1 className="text-3xl font-extrabold tracking-tight mb-2">Privacy Policy</h1>
          <p className="text-white/35 text-sm">Last updated: April 2026</p>
        </div>

        <div className="prose prose-invert prose-sm max-w-none space-y-8 text-white/55 leading-relaxed">

          <section>
            <h2 className="text-white text-lg font-semibold mb-3">1. Introduction</h2>
            <p>
              Kartomtrades operates a simulated trading platform for educational and practice purposes (the &ldquo;Platform&rdquo;).
              This Privacy Policy explains how we collect, use, store, and protect personal information when
              you use our website and services. By creating an account or using the Platform, you agree to the
              practices described in this policy.
            </p>
            <p className="mt-3">
              If you have questions about this policy, please contact us using the support options available on the Platform.
            </p>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-3">2. Information we collect</h2>
            <p>We collect the following categories of information:</p>
            <ul className="list-disc list-outside ml-5 space-y-2 mt-3">
              <li>
                <strong className="text-white/75">Account information:</strong> email address, first name (optional), and a hashed password
                when you register for an account.
              </li>
              <li>
                <strong className="text-white/75">Identity verification data (KYC):</strong> government-issued identification documents,
                proof of address, and related information required before activating a live trading account.
                This information is collected and reviewed by our compliance team.
              </li>
              <li>
                <strong className="text-white/75">Trading activity:</strong> position history, demo and live trade records, order data,
                and account balance information generated through your use of the Platform.
              </li>
              <li>
                <strong className="text-white/75">Technical data:</strong> IP address, browser type, device information, and usage
                logs collected automatically when you interact with the Platform.
              </li>
              <li>
                <strong className="text-white/75">Communication data:</strong> messages sent to our support team, including live chat
                transcripts.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-3">3. How we use your information</h2>
            <ul className="list-disc list-outside ml-5 space-y-2">
              <li>To create and manage your account.</li>
              <li>To process identity verification before activating live account access.</li>
              <li>To provide access to the demo and live trading environment.</li>
              <li>To process deposits and withdrawals on live accounts.</li>
              <li>To send account-related notifications, such as deposit confirmations or security alerts.</li>
              <li>To respond to support requests.</li>
              <li>To improve the Platform and diagnose technical issues.</li>
              <li>To comply with legal obligations, including anti-money laundering (AML) requirements.</li>
            </ul>
            <p className="mt-3">
              We do not sell your personal information to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-3">4. Data storage and security</h2>
            <p>
              User data is stored using Supabase, a cloud database provider with industry-standard encryption at
              rest and in transit. Passwords are stored as one-way hashes and are never readable by Platform staff.
            </p>
            <p className="mt-3">
              Reasonable technical and organisational measures are in place to protect your data against
              unauthorised access, loss, or disclosure. However, no system is completely secure, and we cannot
              guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-3">5. Data retention</h2>
            <p>
              We retain account information for as long as your account is active and for a reasonable period
              thereafter in order to comply with legal obligations, resolve disputes, and enforce agreements.
            </p>
            <p className="mt-3">
              You may request deletion of your account and associated data by contacting our support team.
              Certain records may be retained longer where required by applicable law.
            </p>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-3">6. Third-party services</h2>
            <p>The Platform uses the following third-party services that may process your data:</p>
            <ul className="list-disc list-outside ml-5 space-y-2 mt-3">
              <li><strong className="text-white/75">Supabase:</strong> Database and authentication infrastructure.</li>
              <li><strong className="text-white/75">Vercel:</strong> Hosting and deployment infrastructure.</li>
              <li><strong className="text-white/75">Tawk.to:</strong> Live chat support (if active). Their privacy policy applies to chat data.</li>
              <li><strong className="text-white/75">TradingView:</strong> Charting widgets embedded within the trading interface.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-3">7. Cookies</h2>
            <p>
              The Platform uses session cookies to maintain your authenticated session. These are temporary and
              are removed when you log out or close your browser. We do not currently use tracking or advertising cookies.
            </p>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-3">8. Your rights</h2>
            <p>Depending on your location, you may have rights to:</p>
            <ul className="list-disc list-outside ml-5 space-y-2 mt-3">
              <li>Access the personal data we hold about you.</li>
              <li>Request correction of inaccurate data.</li>
              <li>Request deletion of your account and data.</li>
              <li>Withdraw consent where processing is based on consent.</li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, please contact our support team through the live chat on the Platform.
            </p>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-3">9. Changes to this policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Changes will be posted on this page with an
              updated &ldquo;Last updated&rdquo; date. Continued use of the Platform after changes are posted
              constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-3">10. Contact</h2>
            <p>
              For questions, data requests, or complaints about this Privacy Policy, please contact us via the
              live support chat available on the Platform homepage.
            </p>
          </section>

        </div>
      </main>

      <footer className="border-t border-border/50 py-8 mt-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 flex flex-wrap gap-4 justify-between items-center">
          <p className="text-white/20 text-xs">&copy; {new Date().getFullYear()} Kartomtrades. All rights reserved.</p>
          <div className="flex gap-5 text-xs">
            <Link href="/terms"            className="text-white/30 hover:text-white transition-colors">Terms of Service</Link>
            <Link href="/risk-disclosure"  className="text-white/30 hover:text-white transition-colors">Risk Disclosure</Link>
          </div>
        </div>
      </footer>

    </div>
  )
}
