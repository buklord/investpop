'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, QrCode, Copy, Check, ArrowDownToLine, Link2, Share2, Plus, X } from 'lucide-react'
import AppSidebar from '@/components/AppSidebar'
import TopNav from '@/components/TopNav'

const ASSETS = [
  { asset: 'USDT', name: 'TetherUS' },
  { asset: 'USDC', name: 'USD Coin' },
  { asset: 'BTC', name: 'Bitcoin' },
  { asset: 'ETH', name: 'Ethereum' },
  { asset: 'BNB', name: 'BNB' },
  { asset: 'SOL', name: 'Solana' },
  { asset: 'XRP', name: 'XRP' },
]

export default function ReceivePage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [asset, setAsset] = useState('USDT')
  const [info, setInfo] = useState(null)
  const [fetching, setFetching] = useState(false)
  const [copied, setCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [requestAmount, setRequestAmount] = useState('')
  const [showRequest, setShowRequest] = useState(false)

  useEffect(() => { checkAuth() }, [])
  useEffect(() => { if (user) loadAddress(asset) }, [user, asset])

  const paymentLink = info?.address
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/wallet/send?asset=${asset}&amount=${requestAmount || ''}&to=${encodeURIComponent(info.address)}`
    : ''

  const copyLink = async () => {
    if (!paymentLink) return
    try { await navigator.clipboard.writeText(paymentLink); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000) } catch (_) {}
  }

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) { router.push('/'); return }
      setUser((await res.json()).user)
    } catch { router.push('/') }
    finally { setLoading(false) }
  }

  const loadAddress = async (a) => {
    setFetching(true); setInfo(null)
    try {
      const res = await fetch(`/api/wallet/address?asset=${a}`)
      if (res.ok) setInfo(await res.json())
    } catch (_) {}
    finally { setFetching(false) }
  }

  const copy = async () => {
    if (!info?.address) return
    try { await navigator.clipboard.writeText(info.address); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch (_) {}
  }

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
  }

  return (
    <div className="min-h-screen bg-background flex">
      <AppSidebar currentPage="/wallet/receive" user={user} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopNav user={user} setSidebarOpen={setSidebarOpen} />

        <div className="p-4 sm:p-6 lg:p-8 max-w-xl mx-auto">
          <div className="mb-6">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Deposit / Receive</h1>
            <p className="text-muted-foreground text-sm">Send crypto to this address to fund your wallet.</p>
          </div>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground text-base flex items-center gap-2"><ArrowDownToLine className="h-4 w-4 text-emerald-400" /> Receive</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-muted-foreground text-xs mb-1.5 block">Coin</label>
                <Select value={asset} onValueChange={setAsset}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ASSETS.map(a => <SelectItem key={a.asset} value={a.asset}>{a.asset} — {a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {fetching ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-emerald-500" /></div>
              ) : info ? (
                <>
                  {/* Request Amount Toggle */}
                  <button
                    onClick={() => setShowRequest(!showRequest)}
                    className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    {showRequest ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                    {showRequest ? 'Remove request amount' : 'Request a specific amount'}
                  </button>

                  {showRequest && (
                    <div>
                      <label className="text-muted-foreground text-xs mb-1.5 block">Request amount ({asset})</label>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={requestAmount}
                        onChange={e => setRequestAmount(e.target.value)}
                        className="text-sm"
                      />
                    </div>
                  )}

                  <div className="flex flex-col items-center gap-3 py-2">
                    <div className="w-48 h-48 rounded-xl bg-white flex items-center justify-center border-2 border-border p-3">
                      {/* QR-like visual pattern */}
                      <svg viewBox="0 0 100 100" className="w-full h-full">
                        <rect width="100" height="100" fill="white" />
                        {/* Position patterns */}
                        <rect x="5" y="5" width="25" height="25" fill="black" />
                        <rect x="10" y="10" width="15" height="15" fill="white" />
                        <rect x="13" y="13" width="9" height="9" fill="black" />
                        <rect x="70" y="5" width="25" height="25" fill="black" />
                        <rect x="75" y="10" width="15" height="15" fill="white" />
                        <rect x="78" y="13" width="9" height="9" fill="black" />
                        <rect x="5" y="70" width="25" height="25" fill="black" />
                        <rect x="10" y="75" width="15" height="15" fill="white" />
                        <rect x="13" y="78" width="9" height="9" fill="black" />
                        {/* Data pattern (pseudo-random based on address) */}
                        {info.address.split('').map((ch, i) => (
                          <rect key={i}
                            x={35 + (i % 8) * 4}
                            y={5 + Math.floor(i / 8) * 4}
                            width="3"
                            height="3"
                            fill={ch.charCodeAt(0) % 2 === 0 ? 'black' : 'white'}
                          />
                        ))}
                        {/* Bottom-right mini pattern */}
                        <rect x="70" y="70" width="25" height="25" fill="black" opacity="0.3" />
                        {requestAmount && (
                          <text x="50" y="95" textAnchor="middle" fontSize="6" fill="black" fontFamily="monospace">
                            {requestAmount} {asset}
                          </text>
                        )}
                      </svg>
                    </div>
                    <span className="text-muted-foreground text-xs">
                      {requestAmount ? `Scan to send ${requestAmount} ${asset}` : 'Scan to get the address'}
                    </span>
                  </div>

                  <div>
                    <label className="text-muted-foreground text-xs mb-1.5 block">Network</label>
                    <div className="text-sm text-foreground bg-muted/40 rounded-lg px-3 py-2">{info.network}</div>
                  </div>

                  <div>
                    <label className="text-muted-foreground text-xs mb-1.5 block">{info.asset} deposit address</label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 text-sm text-foreground bg-muted/40 rounded-lg px-3 py-2 break-all font-mono">{info.address}</div>
                      <Button variant="outline" size="icon" onClick={copy} className="border-border flex-shrink-0">
                        {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Payment Request Link */}
                  {paymentLink && (
                    <div>
                      <label className="text-muted-foreground text-xs mb-1.5 block">Shareable payment link</label>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 text-xs text-foreground bg-muted/40 rounded-lg px-3 py-2 break-all font-mono truncate">{paymentLink}</div>
                        <Button variant="outline" size="icon" onClick={copyLink} className="border-border flex-shrink-0">
                          {linkCopied ? <Check className="h-4 w-4 text-emerald-400" /> : <Link2 className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="text-amber-300 text-xs bg-amber-500/10 rounded-lg px-3 py-2">
                    Send only {info.asset} via {info.network} to this address. Sending any other coin may result in loss.
                  </div>
                </>
              ) : (
                <div className="text-muted-foreground text-sm text-center py-6">Address unavailable.</div>
              )}
            </CardContent>
          </Card>

          <div className="mt-4">
            <Button variant="ghost" onClick={() => router.push('/wallet')} className="text-muted-foreground">Back to Wallet</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
