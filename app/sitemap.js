export default function sitemap() {
  const base = 'https://www.kartomtrades.com'
  const now = new Date().toISOString()

  return [
    { url: `${base}/`,                priority: 1.0,  changeFrequency: 'weekly',  lastModified: now },
    { url: `${base}/register`,        priority: 0.9,  changeFrequency: 'monthly', lastModified: now },
    { url: `${base}/login`,           priority: 0.8,  changeFrequency: 'monthly', lastModified: now },
    { url: `${base}/privacy-policy`,  priority: 0.4,  changeFrequency: 'yearly',  lastModified: now },
    { url: `${base}/terms`,           priority: 0.4,  changeFrequency: 'yearly',  lastModified: now },
    { url: `${base}/risk-disclosure`, priority: 0.4,  changeFrequency: 'yearly',  lastModified: now },
  ]
}
