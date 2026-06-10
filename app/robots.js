export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard', '/portfolio', '/trade', '/wallet', '/history', '/journal', '/settings', '/kyc', '/admin', '/copy-trading', '/leaderboard', '/markets', '/api/'],
    },
    sitemap: 'https://www.vaultquokka.com/sitemap.xml',
  }
}
