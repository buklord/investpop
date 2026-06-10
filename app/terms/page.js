import Link from 'next/link'

export const metadata = {
  title: 'Terms of Service — Vaultquokka',
  description: 'Terms and conditions governing use of the Vaultquokka trading platform.',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* Header */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-black text-base leading-none">V</span>
            </div>
            <span className="text-sm font-bold">Vaultquokka</span>
          </Link>
          <Link href="/" className="text-white/40 hover:text-white text-sm transition-colors">← Back to home</Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-14">
        <div className="mb-10">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-400 mb-3">Legal</p>
          <h1 className="text-3xl font-extrabold tracking-tight mb-2">Terms of Service</h1>
          <p className="text-white/35 text-sm">Last updated: April 2026</p>
        </div>

        <div className="prose prose-invert prose-sm max-w-none space-y-8 text-white/55 leading-relaxed">

          <section>
            <h2 className="text-white text-lg font-semibold mb-3">1. About the platform</h2>
            <p>
              Vaultquokka provides a simulated trading platform for educational and simulated trading purposes
              (the &ldquo;Platform&rdquo;). By creating an account, you accept these Terms of Service in full.
              If you do not agree, do not use the Platform.
            </p>
            <p className="mt-3">
              The Platform is not a licensed brokerage, financial advisor, or investment firm.
              Nothing on the Platform constitutes financial advice. All trading activity on a demo account
              uses virtual funds only and has no economic value.
            </p>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-3">2. Eligibility</h2>
            <p>To use the Platform, you must:</p>
            <ul className="list-disc list-outside ml-5 space-y-2 mt-3">
              <li>Be at least 18 years old, or the age of legal majority in your jurisdiction.</li>
              <li>Have the legal capacity to enter into a binding agreement.</li>
              <li>Not be resident in a jurisdiction where such services are prohibited.</li>
            </ul>
            <p className="mt-3">
              By registering, you confirm that you meet these requirements.
            </p>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-3">3. Demo account</h2>
            <p>
              Every account begins as a demo account, pre-loaded with $100,000 in virtual funds.
              Demo trading is free, requires no deposit, and carries no real financial risk.
              Virtual funds have no monetary value and cannot be withdrawn.
            </p>
            <p className="mt-3">
              Demo account results do not guarantee equivalent results in live trading. Market
              conditions, spreads, latency, and emotional factors differ significantly between
              simulated and live environments.
            </p>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-3">4. Live account</h2>
            <p>
              To activate a live account, you must complete identity verification (KYC) and be
              approved by our compliance team. Approval is not guaranteed.
            </p>
            <p className="mt-3">
              Live accounts involve real funds and real financial risk. You should only deposit
              funds you can afford to lose. Deposits are accepted in cryptocurrency (BTC, USDT).
              Withdrawals are subject to an administrative review process.
            </p>
            <p className="mt-3">
              The Platform reserves the right to freeze or close a live account at any time if
              there is a suspicion of fraudulent activity, violation of these Terms, or a legal requirement to do so.
            </p>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-3">5. Account security</h2>
            <p>
              You are responsible for maintaining the confidentiality of your account credentials.
              Do not share your password. Notify us immediately if you suspect unauthorised access
              to your account. We are not liable for losses resulting from your failure to protect
              your credentials.
            </p>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-3">6. Acceptable use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc list-outside ml-5 space-y-2 mt-3">
              <li>Use the Platform for any unlawful purpose.</li>
              <li>Manipulate market data, exploit system errors, or act in bad faith.</li>
              <li>Attempt to gain unauthorised access to other accounts or systems.</li>
              <li>Use automated scripts or bots to interact with the Platform without permission.</li>
              <li>Create multiple accounts to abuse demo fund resets or promotions.</li>
              <li>Use the Platform to launder money or facilitate financial crime.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-3">7. Copy trading</h2>
            <p>
              The copy trading feature allows you to mirror positions from other users on the Platform.
              Copy trading does not guarantee profits. Past performance of any trader on the Platform
              is not a reliable indicator of future results. You accept full responsibility for the
              trades executed in your account through the copy trading feature.
            </p>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-3">8. AI trade coach</h2>
            <p>
              The AI trade coach provides automated feedback on closed positions for educational purposes only.
              Feedback is generated algorithmically and does not constitute professional financial advice.
              Do not make trading decisions based solely on AI trade coach output.
            </p>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-3">9. No financial advice</h2>
            <p>
              The Platform, including all data, market prices, charts, AI analysis, leaderboards, and
              copy trading features, is provided for educational and simulation purposes only.
              Nothing on the Platform should be interpreted as a recommendation to buy or sell any
              financial instrument.
            </p>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-3">10. Limitation of liability</h2>
            <p>
              The Platform is provided on an &ldquo;as is&rdquo; basis. We do not guarantee uninterrupted
              availability, accuracy of market data, or freedom from errors.
              To the maximum extent permitted by applicable law, we exclude all liability for
              losses, damages, or claims arising from use of the Platform, including losses
              on live accounts.
            </p>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-3">11. Amendments</h2>
            <p>
              We may update these Terms at any time. Updated Terms will be posted on this page.
              Continued use of the Platform after any change constitutes acceptance of the new Terms.
            </p>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-3">12. Contact</h2>
            <p>
              For questions about these Terms, please use the live support chat available on the Platform homepage.
            </p>
          </section>

        </div>
      </main>

      <footer className="border-t border-border/50 py-8 mt-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 flex flex-wrap gap-4 justify-between items-center">
          <p className="text-white/20 text-xs">&copy; {new Date().getFullYear()} Vaultquokka. All rights reserved.</p>
          <div className="flex gap-5 text-xs">
            <Link href="/privacy-policy"   className="text-white/30 hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="/risk-disclosure"  className="text-white/30 hover:text-white transition-colors">Risk Disclosure</Link>
          </div>
        </div>
      </footer>

    </div>
  )
}
