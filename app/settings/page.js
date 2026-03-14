'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Menu,
  Settings,
  Shield,
  User,
  Lock,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react'
import AppSidebar from '@/components/AppSidebar'

export default function SettingsPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState(null)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileMsg, setProfileMsg] = useState(null)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) { router.push('/'); return }
      const data = await res.json()
      setUser(data.user)
      setFirstName(data.user.firstName || '')
      setLastName(data.user.lastName || '')
    } catch {
      router.push('/')
    } finally {
      setLoading(false)
    }
  }

  const handleProfileUpdate = async (e) => {
    e.preventDefault()
    setProfileMsg(null)
    setProfileLoading(true)

    try {
      const res = await fetch('/api/settings/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName })
      })
      const data = await res.json()
      if (res.ok) {
        setProfileMsg({ type: 'success', text: 'Profile updated successfully.' })
        setUser({ ...user, firstName, lastName })
      } else {
        setProfileMsg({ type: 'error', text: data.error || 'Failed to update profile.' })
      }
    } catch {
      setProfileMsg({ type: 'error', text: 'An error occurred. Please try again.' })
    } finally {
      setProfileLoading(false)
    }
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    setPasswordMsg(null)

    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'New passwords do not match.' })
      return
    }
    if (newPassword.length < 8) {
      setPasswordMsg({ type: 'error', text: 'New password must be at least 8 characters.' })
      return
    }

    setPasswordLoading(true)
    try {
      const res = await fetch('/api/settings/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      })
      const data = await res.json()
      if (res.ok) {
        setPasswordMsg({ type: 'success', text: 'Password updated successfully.' })
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        setPasswordMsg({ type: 'error', text: data.error || 'Failed to update password.' })
      }
    } catch {
      setPasswordMsg({ type: 'error', text: 'An error occurred. Please try again.' })
    } finally {
      setPasswordLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0d1117] flex">
      <AppSidebar
        currentPage="/settings"
        user={user}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />

      <div className="flex-1 min-w-0">
        {/* Mobile header */}
        <div className="lg:hidden bg-[#161b22] border-b border-slate-800 p-3 flex items-center justify-between sticky top-0 z-40">
          <button onClick={() => setSidebarOpen(true)} className="text-white p-1">
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-black text-sm leading-none">K</span>
            </div>
            <span className="font-bold text-white text-sm">Kartomtrades</span>
          </div>
          <div className="w-8" />
        </div>

        <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
          {/* Header */}
          <div className="mb-6 sm:mb-8">
            <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
              <Settings className="h-6 w-6" />
              Settings
            </h1>
            <p className="text-slate-400 text-sm mt-1">Manage your profile and security</p>
          </div>

          {/* Profile Info */}
          <Card className="bg-[#161b22] border-slate-800 mb-6">
            <CardHeader>
              <CardTitle className="text-white text-base flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleProfileUpdate} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName" className="text-slate-400 text-sm">First Name</Label>
                    <Input
                      id="firstName"
                      type="text"
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                      className="mt-1 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                      placeholder="Enter your first name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName" className="text-slate-400 text-sm">Last Name</Label>
                    <Input
                      id="lastName"
                      type="text"
                      value={lastName}
                      onChange={e => setLastName(e.target.value)}
                      className="mt-1 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                      placeholder="Enter your last name"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-slate-400 text-sm">Email Address</Label>
                  <div className="mt-1 px-3 py-2 bg-slate-800 rounded-md text-white text-sm">
                    {user?.email}
                  </div>
                </div>

                <div>
                  <Label className="text-slate-400 text-sm">Account Role</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      user?.role === 'SUPER_ADMIN'
                        ? 'bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20'
                        : user?.role === 'ADMIN'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}>
                      {user?.role === 'SUPER_ADMIN' ? '● SUPER ADMIN' : user?.role === 'ADMIN' ? '● ADMIN' : '● USER'}
                    </span>
                  </div>
                </div>

                <div>
                  <Label className="text-slate-400 text-sm">User ID</Label>
                  <div className="mt-1 px-3 py-2 bg-slate-800 rounded-md text-slate-500 text-xs font-mono">
                    {user?.id}
                  </div>
                </div>

                {profileMsg && (
                  <div className={`flex items-center gap-2 text-sm px-4 py-3 rounded-lg ${
                    profileMsg.type === 'success'
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-red-500/10 text-red-400'
                  }`}>
                    {profileMsg.type === 'success'
                      ? <CheckCircle className="h-4 w-4 flex-shrink-0" />
                      : <AlertCircle className="h-4 w-4 flex-shrink-0" />}
                    {profileMsg.text}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={profileLoading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {profileLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Update Profile
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Security - Change Password */}
          <Card className="bg-[#161b22] border-slate-800 mb-6">
            <CardHeader>
              <CardTitle className="text-white text-base flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Change Password
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div>
                  <Label htmlFor="currentPassword" className="text-slate-400 text-sm">Current Password</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    required
                    className="mt-1 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                    placeholder="Enter current password"
                  />
                </div>
                <div>
                  <Label htmlFor="newPassword" className="text-slate-400 text-sm">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                    className="mt-1 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                    placeholder="At least 8 characters"
                  />
                </div>
                <div>
                  <Label htmlFor="confirmPassword" className="text-slate-400 text-sm">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                    className="mt-1 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                    placeholder="Repeat new password"
                  />
                </div>

                {passwordMsg && (
                  <div className={`flex items-center gap-2 text-sm px-4 py-3 rounded-lg ${
                    passwordMsg.type === 'success'
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-red-500/10 text-red-400'
                  }`}>
                    {passwordMsg.type === 'success'
                      ? <CheckCircle className="h-4 w-4 flex-shrink-0" />
                      : <AlertCircle className="h-4 w-4 flex-shrink-0" />}
                    {passwordMsg.text}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={passwordLoading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {passwordLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Update Password
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Platform Info */}
          <Card className="bg-[#161b22] border-slate-800">
            <CardHeader>
              <CardTitle className="text-white text-base flex items-center gap-2">
                <Shield className="h-5 w-5" />
                About Kartomtrades
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-400 text-sm leading-relaxed">
                Kartomtrades is a professional trading platform for stocks and crypto.
                Trading fees and slippage are applied to closely mirror real market conditions.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="text-slate-500 text-xs mb-1">Trading Fee</div>
                  <div className="text-white font-medium">0.1% per trade</div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="text-slate-500 text-xs mb-1">Starting Balance</div>
                  <div className="text-white font-medium">$100,000</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
    </div>
  )
}
