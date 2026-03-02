'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  BarChart3, Menu, Shield, CheckCircle, AlertCircle,
  Loader2, Upload, FileText, User, ArrowRight, ArrowLeft, Clock
} from 'lucide-react'
import AppSidebar from '@/components/AppSidebar'

const COUNTRIES = [
  'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany',
  'France', 'Netherlands', 'Spain', 'Italy', 'Japan', 'Singapore',
  'Hong Kong', 'United Arab Emirates', 'South Africa', 'Brazil',
  'Mexico', 'Argentina', 'India', 'China', 'South Korea',
  'Nigeria', 'Ghana', 'Kenya', 'Egypt', 'Other',
]

const DOC_TYPES = [
  { id: 'PASSPORT', label: 'Passport' },
  { id: 'NATIONAL_ID', label: 'National ID Card' },
  { id: 'DRIVERS_LICENSE', label: "Driver's Licence" },
]

export default function KycVerifyPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [kycStatus, setKycStatus] = useState('PENDING')
  const [step, setStep] = useState(1) // 1 = identity, 2 = document, 3 = submitted
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState(null)

  // Step 1 fields
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [dob, setDob] = useState('')
  const [country, setCountry] = useState('')
  const [phone, setPhone] = useState('')

  // Step 2 fields
  const [docType, setDocType] = useState('PASSPORT')
  const [docNote, setDocNote] = useState('')
  const [fileSelected, setFileSelected] = useState(false)

  useEffect(() => { checkAuth() }, [])

  // If user is waiting on admin review, keep KYC status fresh so approvals
  // take effect without requiring a manual refresh.
  useEffect(() => {
    if (!user) return
    if (kycStatus !== 'SUBMITTED') return
    let cancelled = false

    const refresh = async () => {
      try {
        const kRes = await fetch('/api/kyc/status', { cache: 'no-store' })
        if (!kRes.ok) return
        const kd = await kRes.json()
        const ks = kd.kycStatus || 'PENDING'
        if (cancelled) return
        setKycStatus(ks)
        if (ks === 'APPROVED') { router.push('/wallet/deposit'); return }
        if (ks === 'REJECTED') { setStep(1); return }
      } catch (_) {}
    }

    refresh()
    const interval = setInterval(refresh, 8000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [user, kycStatus, router])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) { router.push('/'); return }
      const data = await res.json()
      setUser(data.user)
      // Read live KYC status from the DB-backed endpoint so admin approvals take effect immediately.
      // Also pre-fill identity fields if already saved.
      const kRes = await fetch('/api/kyc/status', { cache: 'no-store' })
      if (kRes.ok) {
        const kd = await kRes.json()
        const ks = kd.kycStatus || 'PENDING'
        setKycStatus(ks)
        if (ks === 'APPROVED') { router.push('/wallet/deposit'); return }
        if (ks === 'SUBMITTED') setStep(3)
        if (kd.firstName) setFirstName(kd.firstName)
        if (kd.lastName) setLastName(kd.lastName)
        if (kd.dateOfBirth) setDob(kd.dateOfBirth)
        if (kd.country) setCountry(kd.country)
        if (kd.phoneNumber) setPhone(kd.phoneNumber)
      } else {
        setKycStatus('PENDING')
      }
    } catch { router.push('/') }
    finally { setLoading(false) }
  }

  const goToStep2 = () => {
    if (!firstName.trim() || !lastName.trim()) { setMsg({ type: 'error', text: 'First and last name are required.' }); return }
    if (!dob) { setMsg({ type: 'error', text: 'Date of birth is required.' }); return }
    if (!country) { setMsg({ type: 'error', text: 'Please select your country.' }); return }
    setMsg(null)
    setStep(2)
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setMsg(null)
    try {
      const res = await fetch('/api/kyc/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName, lastName, dateOfBirth: dob,
          country, phoneNumber: phone, documentType: docType, documentNote: docNote
        })
      })
      const data = await res.json()
      if (res.ok) {
        setKycStatus('SUBMITTED')
        setStep(3)
      } else {
        setMsg({ type: 'error', text: data.error || 'Submission failed. Please try again.' })
      }
    } catch { setMsg({ type: 'error', text: 'Network error. Please try again.' }) }
    finally { setSubmitting(false) }
  }

  if (loading) return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0d1117] flex">
      <AppSidebar currentPage="/wallet" user={user} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="flex-1 min-w-0">
        {/* Mobile header */}
        <div className="lg:hidden bg-[#161b22] border-b border-slate-800 p-3 flex items-center justify-between sticky top-0 z-40">
          <button onClick={() => setSidebarOpen(true)} className="text-white p-1"><Menu className="h-6 w-6" /></button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center">
              <BarChart3 className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-white text-sm">KYC Verification</span>
          </div>
          <div className="w-8" />
        </div>

        <div className="p-4 sm:p-6 lg:p-8 max-w-xl mx-auto">
          <Link href="/wallet" className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-6 text-sm transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Wallet
          </Link>

          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <Shield className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Identity Verification</h1>
              <p className="text-slate-400 text-sm">Required to unlock Real Wallet deposits</p>
            </div>
          </div>

          {/* Progress steps */}
          {step < 3 && (
            <div className="flex items-center gap-2 mb-6">
              {[{ n: 1, label: 'Identity' }, { n: 2, label: 'Document' }].map(s => (
                <div key={s.n} className="flex items-center gap-2 flex-1">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    step >= s.n ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400'
                  }`}>{s.n}</div>
                  <span className={`text-xs ${step >= s.n ? 'text-white' : 'text-slate-500'}`}>{s.label}</span>
                  {s.n < 2 && <div className="flex-1 h-px bg-slate-700 mx-1" />}
                </div>
              ))}
            </div>
          )}

          {/* ── Step 1: Identity ─────────────────────────── */}
          {step === 1 && (
            <Card className="bg-[#161b22] border-slate-700">
              <CardHeader>
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <User className="h-4 w-4 text-blue-400" />
                  Personal Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 mb-1.5 block">First Name *</label>
                    <Input value={firstName} onChange={e => setFirstName(e.target.value)}
                      placeholder="John" className="bg-slate-900 border-slate-700 text-white" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1.5 block">Last Name *</label>
                    <Input value={lastName} onChange={e => setLastName(e.target.value)}
                      placeholder="Smith" className="bg-slate-900 border-slate-700 text-white" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">Date of Birth *</label>
                  <Input type="date" value={dob} onChange={e => setDob(e.target.value)}
                    className="bg-slate-900 border-slate-700 text-white" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">Country of Residence *</label>
                  <select value={country} onChange={e => setCountry(e.target.value)}
                    className="w-full px-3 py-2 rounded-md bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
                    <option value="">Select country…</option>
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">Phone Number (optional)</label>
                  <Input value={phone} onChange={e => setPhone(e.target.value)}
                    placeholder="+1 555 000 0000" className="bg-slate-900 border-slate-700 text-white" />
                </div>

                {msg && (
                  <div className={`flex items-center gap-2 text-sm px-3 py-2.5 rounded-lg ${msg.type === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    {msg.text}
                  </div>
                )}

                <Button onClick={goToStep2} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                  Continue <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          )}

          {/* ── Step 2: Document ─────────────────────────── */}
          {step === 2 && (
            <Card className="bg-[#161b22] border-slate-700">
              <CardHeader>
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-400" />
                  Document Upload
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">Document Type</label>
                  <div className="grid grid-cols-3 gap-2">
                    {DOC_TYPES.map(dt => (
                      <button key={dt.id} onClick={() => setDocType(dt.id)}
                        className={`py-2 px-2 rounded-lg text-xs font-medium border transition-colors ${
                          docType === dt.id
                            ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                        }`}>{dt.label}</button>
                    ))}
                  </div>
                </div>

                {/* File dropzone UI — visual placeholder for demo.
                    File upload/storage is intentionally out of scope: the admin
                    reviews identity details (name/DOB/country) and approves manually.
                    A real deployment would wire this to an S3 pre-signed URL or similar. */}
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">Upload Document</label>
                  <label className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl p-8 cursor-pointer transition-colors ${
                    fileSelected
                      ? 'border-emerald-500/60 bg-emerald-500/5'
                      : 'border-slate-600 hover:border-blue-500/60 hover:bg-blue-500/5'
                  }`}>
                    <input type="file" accept="image/*,.pdf" className="hidden"
                      onChange={e => setFileSelected(!!e.target.files?.length)} />
                    {fileSelected ? (
                      <>
                        <CheckCircle className="h-10 w-10 text-emerald-400" />
                        <span className="text-emerald-400 text-sm font-medium">Document selected</span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-10 w-10 text-slate-500" />
                        <div className="text-center">
                          <p className="text-slate-300 text-sm font-medium">Click to upload or drag & drop</p>
                          <p className="text-slate-500 text-xs mt-1">PNG, JPG, or PDF — max 10 MB</p>
                        </div>
                      </>
                    )}
                  </label>
                </div>

                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">Additional Notes (optional)</label>
                  <Input value={docNote} onChange={e => setDocNote(e.target.value)}
                    placeholder="e.g. Passport number 12345678"
                    className="bg-slate-900 border-slate-700 text-white" />
                </div>

                {msg && (
                  <div className={`flex items-center gap-2 text-sm px-3 py-2.5 rounded-lg ${msg.type === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    {msg.text}
                  </div>
                )}

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(1)} className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800">
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back
                  </Button>
                  <Button onClick={handleSubmit} disabled={submitting} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Shield className="h-4 w-4 mr-2" />}
                    Submit for Review
                  </Button>
                </div>

                <p className="text-xs text-slate-500 text-center">
                  Your information is encrypted and only used for compliance purposes.
                </p>
              </CardContent>
            </Card>
          )}

          {/* ── Step 3: Submitted / Pending ─────────────── */}
          {step === 3 && (
            <Card className="bg-[#161b22] border-blue-500/30">
              <CardContent className="py-10 text-center space-y-4">
                <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto">
                  <Clock className="h-8 w-8 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-white text-lg font-bold mb-2">Verification in Progress</h2>
                  <p className="text-slate-400 text-sm max-w-sm mx-auto">
                    Your identity documents have been submitted. Our compliance team will review your application within 24 hours.
                  </p>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-4 py-3 text-blue-300 text-sm">
                  You will receive a notification once your account is verified.
                </div>
                <Link href="/dashboard">
                  <Button className="bg-slate-700 hover:bg-slate-600 text-white">
                    Return to Dashboard
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
    </div>
  )
}
