// Test script to verify database migrations
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function testMigration() {
  try {
    console.log('Testing database schema...\n')
    
    // Test 1: Check if trading_positions table exists
    const positions = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'trading_positions'
      ORDER BY ordinal_position
    `
    
    console.log('✓ trading_positions table columns:')
    positions.forEach(col => {
      const important = ['account_type', 'leader_position_id'].includes(col.column_name)
      console.log(`  ${important ? '★' : ' '} ${col.column_name}: ${col.data_type}`)
    })
    
    const hasAccountType = positions.some(col => col.column_name === 'account_type')
    const hasLeaderPositionId = positions.some(col => col.column_name === 'leader_position_id')
    
    console.log('\nMigration status:')
    console.log(`  account_type column: ${hasAccountType ? '✅ EXISTS' : '❌ MISSING'}`)
    console.log(`  leader_position_id column: ${hasLeaderPositionId ? '✅ EXISTS' : '❌ MISSING'}`)
    
    if (!hasAccountType || !hasLeaderPositionId) {
      console.log('\n⚠️  Migrations incomplete! Run any API endpoint to trigger migrations.')
    } else {
      console.log('\n✅ All migrations complete!')
    }
    
    // Test 2: Try a simple insert/delete to verify permissions
    /*try {
      const testId = 'test-migration-' + Date.now()
      await prisma.$executeRaw`
        INSERT INTO trading_positions (
          id, user_id, asset_id, side, quantity, entry_price, 
          leverage, status, total_invested, total_fees, account_type
        ) VALUES (
          ${testId}, 'test-user', 'test-asset', 'LONG', 
          1, 100, 1, 'OPEN', 100, 0, 'DEMO'
        )
      `
      await prisma.$executeRaw`DELETE FROM trading_positions WHERE id = ${testId}`
      console.log('✓ Write permissions OK\n')
    } catch (err) {
      console.log('✗ Write test failed:', err.message, '\n')
    }*/
    
  } catch (error) {
    console.error('Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

testMigration()
