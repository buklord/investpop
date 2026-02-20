import './globals.css'
import Script from 'next/script'

export const metadata = {
  title: 'InvestPop - Live Trading Platform',
  description: 'A professional trading platform for stocks and crypto',
}

// Tawk.to — set NEXT_PUBLIC_TAWK_SRC to the full embed URL from your Tawk dashboard
// (e.g. https://embed.tawk.to/PROPERTY_ID/WIDGET_ID).
// Alternatively set NEXT_PUBLIC_TAWK_PROPERTY_ID + NEXT_PUBLIC_TAWK_WIDGET_ID.
const TAWK_SRC = process.env.NEXT_PUBLIC_TAWK_SRC || (
  process.env.NEXT_PUBLIC_TAWK_PROPERTY_ID
    ? `https://embed.tawk.to/${process.env.NEXT_PUBLIC_TAWK_PROPERTY_ID}/${process.env.NEXT_PUBLIC_TAWK_WIDGET_ID || '1ikvn6t4a'}`
    : null
)

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{__html:'window.addEventListener("error",function(e){if(e.error instanceof DOMException&&e.error.name==="DataCloneError"&&e.message&&e.message.includes("PerformanceServerTiming")){e.stopImmediatePropagation();e.preventDefault()}},true);'}} />
      </head>
      <body>
        {children}

        {/* ── Tawk.to Live Chat ─────────────────────────────────────────────
            Loads on every page when NEXT_PUBLIC_TAWK_SRC (or the legacy
            NEXT_PUBLIC_TAWK_PROPERTY_ID) env var is set.
            strategy="afterInteractive" ensures it never blocks rendering.
            The default widget bubble is hidden; our custom "Live Support"
            button calls window.Tawk_API.maximize() to open the chat.

            To activate: set NEXT_PUBLIC_TAWK_SRC in .env to your full
            Tawk.to embed URL (e.g. https://embed.tawk.to/PROP_ID/WIDGET_ID)
        ────────────────────────────────────────────────────────────────── */}
        {TAWK_SRC && (
          <Script id="tawk-to" strategy="afterInteractive">{`
            var Tawk_API = Tawk_API || {};
            Tawk_API.onLoad = function() {
              Tawk_API.hideWidget();
            };
            (function(){
              var s1 = document.createElement("script"),
                  s0 = document.getElementsByTagName("script")[0];
              s1.async = true;
              s1.src   = '${TAWK_SRC}';
              s1.charset = 'UTF-8';
              s1.setAttribute('crossorigin', '*');
              s0.parentNode.insertBefore(s1, s0);
            })();
          `}</Script>
        )}
      </body>
    </html>
  )
}
