import './globals.css'
import Script from 'next/script'

export const metadata = {
  title: 'InvestPop - Live Trading Platform',
  description: 'A professional trading platform for stocks and crypto',
}

// Tawk.to property ID — set NEXT_PUBLIC_TAWK_PROPERTY_ID in your .env
const TAWK_PROPERTY_ID = process.env.NEXT_PUBLIC_TAWK_PROPERTY_ID
const TAWK_WIDGET_ID   = process.env.NEXT_PUBLIC_TAWK_WIDGET_ID || '1ikvn6t4a'

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{__html:'window.addEventListener("error",function(e){if(e.error instanceof DOMException&&e.error.name==="DataCloneError"&&e.message&&e.message.includes("PerformanceServerTiming")){e.stopImmediatePropagation();e.preventDefault()}},true);'}} />
      </head>
      <body>
        {children}

        {/* ── Tawk.to Live Chat ─────────────────────────────────────────────
            Loads only when NEXT_PUBLIC_TAWK_PROPERTY_ID is set.
            The default widget bubble is hidden; our custom "Live Support"
            button calls window.Tawk_API.maximize() to open the chat.
        ────────────────────────────────────────────────────────────────── */}
        {TAWK_PROPERTY_ID && (
          <Script id="tawk-to" strategy="afterInteractive">{`
            var Tawk_API = Tawk_API || {};
            Tawk_API.onLoad = function() {
              Tawk_API.hideWidget();
            };
            (function(){
              var s1 = document.createElement("script"),
                  s0 = document.getElementsByTagName("script")[0];
              s1.async = true;
              s1.src   = 'https://embed.tawk.to/${TAWK_PROPERTY_ID}/${TAWK_WIDGET_ID}';
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
