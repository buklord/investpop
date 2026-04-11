// lib/cacheHeaders.js
// Generate proper cache control headers for different response types

export function getCacheHeaders(type = 'short', cacheControl = true) {
  const headers = {
    // Static content (assets, catalogs)
    'static': {
      'Cache-Control': 'public, max-age=86400, immutable', // 24 hours
      'CDN-Cache-Control': 'max-age=86400',
    },
    
    // Medium-term data (catalogs, leaderboards)
    'medium': {
      'Cache-Control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=1800', // 5min public, 10min CDN, 30min stale
      'CDN-Cache-Control': 'max-age=600',
    },
    
    // Short-term data (quotes, account data)
    'short': {
      'Cache-Control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=120', // 30sec public, 1min CDN, 2min stale
      'CDN-Cache-Control': 'max-age=60',
    },
    
    // Very short-term (account balance, positions)
    'minimal': {
      'Cache-Control': 'public, max-age=10, s-maxage=30, stale-while-revalidate=60', // 10sec public, 30sec CDN, 1min stale
      'CDN-Cache-Control': 'max-age=30',
    },
    
    // No cache (user-specific, always fresh)
    'none': {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  }
  
  return headers[type] || headers.short
}

export function addCacheHeaders(response, type = 'short') {
  const headers = getCacheHeaders(type)
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
  return response
}

// ETag generation for conditional requests
export function generateETag(data) {
  const crypto = require('crypto')
  return crypto
    .createHash('md5')
    .update(JSON.stringify(data))
    .digest('hex')
}

// Check if ETag matches for 304 responses
export function checkETag(eTag, newData) {
  return eTag === generateETag(newData)
}

// Handle conditional requests (304 Not Modified)
export function handleConditionalRequest(request, data) {
  const ifNoneMatch = request.headers.get('if-none-match')
  if (ifNoneMatch) {
    const newETag = generateETag(data)
    if (ifNoneMatch === newETag) {
      return { isModified: false, eTag: newETag }
    }
    return { isModified: true, eTag: newETag }
  }
  return { isModified: true, eTag: generateETag(data) }
}
