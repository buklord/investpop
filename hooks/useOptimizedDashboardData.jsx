// hooks/useOptimizedDashboardData.jsx
'use client'

import { useState, useEffect, useRef } from 'react'

const REQUEST_CACHE = new Map()
const CACHE_TTL = {
  account: 10000,      // 10 sec
  positions: 15000,    // 15 sec
  trades: 30000,       // 30 sec
  watchlist: 60000,    // 1 min
  quotes: 20000,       // 20 sec
  notifications: 15000, // 15 sec
  perfMetrics: 120000, // 2 min
}

// Centralized cache with TTL
function getCachedOrFetch(key, fetchFn, ttl = 30000) {
  const cached = REQUEST_CACHE.get(key)
  if (cached && Date.now() < cached.expiresAt) {
    return Promise.resolve(cached.data)
  }

  // If already fetching, return the in-flight promise
  if (cached && cached.inFlight) {
    return cached.inFlight
  }

  const promise = fetchFn().then(data => {
    REQUEST_CACHE.set(key, {
      data,
      expiresAt: Date.now() + ttl,
      inFlight: null,
    })
    return data
  }).catch(err => {
    REQUEST_CACHE.delete(key)
    throw err
  })

  REQUEST_CACHE.set(key, {
    inFlight: promise,
    expiresAt: Date.now() + ttl,
  })

  return promise
}

export function useOptimizedDashboardData(userId) {
  const [data, setData] = useState({
    account: null,
    positions: [],
    trades: [],
    watchlist: [],
    quotes: {},
    perfMetrics: null,
    perfSetups: [],
    notifications: [],
  })

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const loadedRef = useRef(false)

  useEffect(() => {
    if (!userId || loadedRef.current) return
    loadedRef.current = true

    const loadData = async () => {
      try {
        // Load all data in parallel using cached requests
        const [account, positions, trades, watchlist, notifications, perfMetrics] = await Promise.all([
          getCachedOrFetch(
            `account:${userId}`,
            () => fetch('/api/account').then(r => r.json()),
            CACHE_TTL.account
          ),
          getCachedOrFetch(
            `positions:${userId}`,
            () => fetch('/api/positions').then(r => r.json()),
            CACHE_TTL.positions
          ),
          getCachedOrFetch(
            `trades:${userId}`,
            () => fetch('/api/trades').then(r => r.json()),
            CACHE_TTL.trades
          ),
          getCachedOrFetch(
            `watchlist:${userId}`,
            () => fetch('/api/watchlist').then(r => r.json()),
            CACHE_TTL.watchlist
          ),
          getCachedOrFetch(
            `notifications:${userId}`,
            () => fetch('/api/notifications').then(r => r.json()),
            CACHE_TTL.notifications
          ),
          getCachedOrFetch(
            `perfMetrics:${userId}`,
            () => fetch('/api/performance/metrics?days=30').then(r => r.json()),
            CACHE_TTL.perfMetrics
          ),
        ])

        // Extract symbols for batch quote fetch
        const symbols = new Set()
        positions.positions?.forEach(p => symbols.add(p.symbol))
        watchlist.watchlist?.forEach(w => symbols.add(w.symbol))

        let quotes = {}
        if (symbols.size > 0) {
          const quoteData = await getCachedOrFetch(
            `quotes:${userId}:${Array.from(symbols).sort().join(',')}`,
            () => {
              const symbolsParam = Array.from(symbols)
                .map(s => `${s},stock`)
                .join('|')
              return fetch(`/api/quotes/batch?symbols=${encodeURIComponent(symbolsParam)}`)
                .then(r => r.json())
            },
            CACHE_TTL.quotes
          )
          quotes = quoteData.quotes || {}
        }

        setData({
          account: account || null,
          positions: positions.positions || [],
          trades: trades.trades || [],
          watchlist: watchlist.watchlist || [],
          quotes,
          perfMetrics: perfMetrics.metrics || null,
          perfSetups: Array.isArray(perfMetrics.setups) ? perfMetrics.setups : [],
          notifications: notifications.notifications || [],
        })

        setLoading(false)
      } catch (err) {
        console.error('Dashboard data load error:', err)
        setError(err.message)
        setLoading(false)
      }
    }

    loadData()

    // Set up auto-refresh with longer intervals (30s instead of constantly)
    const refreshInterval = setInterval(() => {
      // Only refresh account since it changes most frequently
      getCachedOrFetch(
        `account:${userId}`,
        () => fetch('/api/account').then(r => r.json()),
        CACHE_TTL.account
      ).then(account => {
        setData(prev => ({ ...prev, account }))
      }).catch(() => {})
    }, 30000)

    return () => clearInterval(refreshInterval)
  }, [userId])

  const refresh = async () => {
    // Clear and reload on manual refresh
    if (userId) {
      REQUEST_CACHE.clear()
      return loadData()
    }
  }

  return { data, loading, error, refresh }
}

// Helper to invalidate cache after mutations (trade execution, etc)
export function invalidateDashboardCache(userId) {
  const keysToDelete = []
  for (const key of REQUEST_CACHE.keys()) {
    if (key.includes(`:${userId}`)) {
      keysToDelete.push(key)
    }
  }
  keysToDelete.forEach(key => REQUEST_CACHE.delete(key))
}
