/**
 * make-admin.js
 * 
 * Promotes a user to ADMIN role by email address.
 * 
 * Usage:
 *   node scripts/make-admin.js your@email.com
 * 
 * Requires DATABASE_URL or DIRECT_URL in your .env file.
 * The 'role' column is created automatically by the app on first request;
 * run the app at least once before using this script.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') })

const { Client } = require('pg')

async function main() {
  const email = process.argv[2]

  if (!email) {
    console.error('Usage: node scripts/make-admin.js <email>')
    process.exit(1)
  }

  const client = new Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL })

  try {
    await client.connect()
    console.log('Connected to database.')

    // Find user
    const { rows } = await client.query(
      'SELECT id, email, role FROM users WHERE email = $1',
      [email]
    )

    if (rows.length === 0) {
      console.error(`No user found with email: ${email}`)
      process.exit(1)
    }

    const user = rows[0]

    if (user.role === 'ADMIN') {
      console.log(`User ${email} is already ADMIN.`)
      process.exit(0)
    }

    // Promote to ADMIN
    await client.query(
      "UPDATE users SET role = 'ADMIN' WHERE id = $1",
      [user.id]
    )

    console.log(`✅ Success! ${email} has been promoted to ADMIN.`)
    console.log('   Refresh the app to see the Admin menu in the sidebar.')
  } finally {
    await client.end()
  }
}

main().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
