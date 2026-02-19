import './globals.css'

export const metadata = {
  title: 'PaperTrade - Paper Trading Platform',
  description: 'A paper trading simulation platform for stocks and crypto',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{__html:'window.addEventListener("error",function(e){if(e.error instanceof DOMException&&e.error.name==="DataCloneError"&&e.message&&e.message.includes("PerformanceServerTiming")){e.stopImmediatePropagation();e.preventDefault()}},true);'}} />
      </head>
      <body>
        {children}
      </body>
    </html>
  )
}
