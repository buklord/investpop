'use client'

import { useState, useEffect, useCallback } from 'react'
import { Gift, Copy, Users, DollarSign, Check, ArrowRight, Star, Sparkles } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'

export default function ReferralPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState(false)
  const [claimCode, setClaimCode] = useState('')
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  const loadReferral = useCallback(async () => {
    try {
      const res = await fetch('/api/referral')
      const d = await res.json()
      if (res.ok) setData(d)
    } catch { /* silent */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadReferral() }, [loadReferral])

  const copyCode = async () => {
    if (!data?.code) return
    try {
      await navigator.clipboard.writeText(data.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast({ title: 'Copied!', description: 'Referral code copied to clipboard.' })
    } catch { toast({ title: 'Copy failed', variant: 'destructive' }) }
  }

  const copyLink = async () => {
    if (!data?.code) return
    const link = `${window.location.origin}/register?ref=${data.code}`
    try {
      await navigator.clipboard.writeText(link)
      toast({ title: 'Link copied!', description: 'Share this link with friends.' })
    } catch { toast({ title: 'Copy failed', variant: 'destructive' }) }
  }

  const handleClaim = async (e) => {
    e.preventDefault()
    if (!claimCode.trim()) return
    setClaiming(true)
    try {
      const res = await fetch('/api/referral/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: claimCode.trim().toUpperCase() }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Failed')
      toast({ title: `🎉 Referral applied!`, description: d.message })
      setClaimCode('')
      loadReferral()
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally { setClaiming(false) }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-40 rounded-xl bg-muted/40 animate-pulse" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <Gift className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Referral Program</h1>
            <p className="text-sm text-muted-foreground">Invite friends and earn demo trading credits</p>
          </div>
        </div>

        {/* Hero banner */}
        <Card className="border-0 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent">
          <CardContent className="pt-6 pb-6">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
              <div className="flex-1 text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                  <Sparkles className="w-5 h-5 text-yellow-500" />
                  <span className="font-semibold text-lg">Earn $50 per friend</span>
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Share your code. When a friend signs up and applies it, they get <strong>$25</strong> demo credits and you get <strong>$50</strong>. No limits.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 flex-shrink-0">
                <div className="text-center p-3 rounded-xl bg-background/60">
                  <div className="text-2xl font-bold text-primary">${(data?.totalEarned || 0).toFixed(0)}</div>
                  <div className="text-xs text-muted-foreground">Earned</div>
                </div>
                <div className="text-center p-3 rounded-xl bg-background/60">
                  <div className="text-2xl font-bold">{data?.totalReferrals || 0}</div>
                  <div className="text-xs text-muted-foreground">Friends</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Your referral code */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-500" />
              Your Referral Code
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                readOnly
                value={data?.code || '—'}
                className="text-lg font-mono font-bold tracking-widest text-center"
              />
              <Button onClick={copyCode} variant="outline" className="gap-2 flex-shrink-0">
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <Button onClick={copyLink} variant="secondary" className="w-full gap-2">
              <ArrowRight className="w-4 h-4" />
              Copy Invite Link
            </Button>
          </CardContent>
        </Card>

        {/* How it works */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">How It Works</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                { step: '1', icon: Copy, title: 'Copy your code', desc: 'Get your unique referral code from this page.' },
                { step: '2', icon: Users, title: 'Share with friends', desc: 'Send the code or link to anyone interested in trading.' },
                { step: '3', icon: DollarSign, title: 'Both get credits', desc: 'They get $25, you get $50 in demo trading credits.' },
              ].map(({ step, icon: Icon, title, desc }) => (
                <div key={step} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-sm font-bold text-primary">
                    {step}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Enter a referral code */}
        {!data?.hasClaimed && (
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Have a Referral Code?</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleClaim} className="flex gap-2">
                <Input
                  placeholder="Enter code e.g. ALEX1A2B"
                  className="font-mono uppercase"
                  value={claimCode}
                  onChange={e => setClaimCode(e.target.value.toUpperCase())}
                />
                <Button type="submit" disabled={claiming || !claimCode.trim()} className="flex-shrink-0">
                  {claiming ? 'Applying…' : 'Apply'}
                </Button>
              </form>
              <p className="text-xs text-muted-foreground mt-2">
                Apply a friend's code once to receive $25 in demo credits. You can only claim one code.
              </p>
            </CardContent>
          </Card>
        )}

        {data?.hasClaimed && (
          <Card className="border-border/50 bg-green-500/5">
            <CardContent className="py-4 flex items-center gap-3">
              <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm">Referral code applied</p>
                <p className="text-xs text-muted-foreground">You've already claimed your signup bonus.</p>
              </div>
              <Badge variant="secondary" className="ml-auto">+$25</Badge>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
