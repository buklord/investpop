import Link from 'next/link'

export const metadata = {
  title: 'Risk Disclosure — Kartomtrades',
  description: 'Important risk information you should read before trading on Kartomtrades.',
}

export default function RiskDisclosurePage() {
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
          <h1 className="text-3xl font-extrabold tracking-tight mb-2">Risk Disclosure</h1>
          <p className="text-white/35 text-sm">Last updated: April 2026 &mdash; Please read this in full before trading.</p>
        </div>

        {/* High-visibility warning box */}
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.07] px-5 py-4 mb-10">
          <p className="text-amber-300 font-semibold text-sm mb-1">Important notice</p>
          <p className="text-amber-200/65 text-sm leading-relaxed">
            Trading financial instruments, including Forex, cryptocurrencies, stocks, indices, and commodities,
            involves significant risk of loss. You may lose some or all of the capital you deposit. Only deposit funds
            you can afford to lose entirely. This disclosure does not cover every possible risk.
          </p>
        </div>

        <div className="prose prose-invert prose-sm max-w-none space-y-8 text-white/55 leading-relaxed">

          <section>
            <h2 className="text-white text-lg font-semibold mb-3">1. Nature of the platform</h2>
            <p>
              Kartomtrades is a simulated trading platform. Demo accounts use virtual funds only.
              No real money is involved in demo trading. Virtual profits and losses have no monetary value.
            </p>
            <p className="mt-3">
              Live accounts involve real funds and real financial risk. Market prices displayed on the Platform
              are derived from live data feeds and reflect real-world conditions, but execution quality,
              spreads, and latency may differ from other trading environments.
            </p>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-3">2. Market risk</h2>
            <p>
              Financial markets are inherently unpredictable. The value of any instrument can fall as well
              as rise, and rapidly. Past performance of any market, instrument, or trader is not a reliable
              indicator of future results. No trading strategy guarantees profit.
            </p>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-3">3. Leverage and margin</h2>
            <p>
              Leveraged trading allows you to control a position larger than your deposit. While this
              amplifies potential gains, it equally amplifies potential losses. A small move against
              your position can result in a loss that exceeds your initial deposit.
            </p>
            <p className="mt-3">
              You are responsible for maintaining sufficient margin in your live account to support open
              positions. Positions may be closed automatically if your margin falls below the required level.
            </p>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-3">4. Cryptocurrency-specific risks</h2>
            <p>
              Cryptocurrency markets are highly volatile and largely unregulated. Prices can move
              dramatically in short periods. Deposits and withdrawals on the Platform are processed
              in cryptocurrency (BTC or USDT). Cryptocurrency values fluctuate and the value of a deposit
              may decrease between the time of deposit and the time of withdrawal, regardless of
              trading performance.
            </p>
            <p className="mt-3">
              Cryptocurrency transactions are irreversible. Ensure you provide the correct wallet address
              when depositing. Incorrect deposits cannot be recovered.
            </p>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-3">5. Liquidity risk</h2>
            <p>
              During periods of high volatility or low market activity, it may not be possible to
              execute orders at stated prices. This is known as slippage. Stop loss orders do not
              guarantee execution at the specified price.
            </p>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-3">6. Technology risk</h2>
            <p>
              Trading via an internet-based platform introduces technology risk, including but not limited to:
              internet connectivity failures, hardware failures, software errors, and delays. We do not
              guarantee uninterrupted platform availability. System outages may prevent you from
              monitoring or closing positions at your intended time.
            </p>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-3">7. Copy trading risk</h2>
            <p>
              When using the copy trading feature, your account mirrors the positions of another trader.
              Past performance of any trader available to copy does not guarantee future results.
              The trader you copy may incur significant losses, and those losses will be reflected in
              your account. You remain responsible for all positions in your account, including those
              entered via copy trading.
            </p>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-3">8. Demo vs live account differences</h2>
            <p>
              Demo trading results may not reflect what would occur in a live account. Factors including
              real spreads, execution speed, deposit and withdrawal processing times, psychological
              pressure when real money is at risk, and position size constraints may significantly
              affect live trading performance compared to demo performance.
            </p>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-3">9. No financial advice</h2>
            <p>
              Nothing on the Platform, including market data, AI trade coach feedback, leaderboard data,
              copy trading performance data, or any other content, constitutes financial advice or a
              recommendation to trade any instrument in any direction. You should obtain independent
              financial advice if you are uncertain whether trading is appropriate for you.
            </p>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-3">10. Your responsibility</h2>
            <p>
              By using the Platform, you acknowledge that you understand the risks described in this
              disclosure, that you are trading at your own risk, and that Kartomtrades is not responsible
              for your trading outcomes.
            </p>
            <p className="mt-3">
              If you are unsure whether trading is appropriate for your financial situation, do not
              deposit real funds. The demo account is available at no cost for demo trading and education.
            </p>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-3">11. Contact</h2>
            <p>
              If you have questions about this Risk Disclosure, please contact us via the live support
              chat available on the Platform homepage.
            </p>
          </section>

        </div>
      </main>

      <footer className="border-t border-border/50 py-8 mt-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 flex flex-wrap gap-4 justify-between items-center">
          <p className="text-white/20 text-xs">&copy; {new Date().getFullYear()} Kartomtrades. All rights reserved.</p>
          <div className="flex gap-5 text-xs">
            <Link href="/privacy-policy"  className="text-white/30 hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="/terms"           className="text-white/30 hover:text-white transition-colors">Terms of Service</Link>
          </div>
        </div>
      </footer>

    </div>
  )
}
