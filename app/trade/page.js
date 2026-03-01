import { redirect } from 'next/navigation'

// /trade is an alias for /markets (the trading terminal)
export default function TradePage() {
  redirect('/markets')
}
