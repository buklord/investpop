/**
 * Script to fix audit_logs foreign key constraint
 * Allows user deletion by setting admin_id to NULL instead of blocking
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Applying audit_logs foreign key fix...');
  
  try {
    // Drop existing foreign key constraint
    await prisma.$executeRawUnsafe(`
      ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_admin_id_fkey;
    `);
    console.log('✓ Dropped existing foreign key constraint');
    
    // Make admin_id nullable
    await prisma.$executeRawUnsafe(`
      ALTER TABLE audit_logs ALTER COLUMN admin_id DROP NOT NULL;
    `);
    console.log('✓ Made admin_id nullable');
    
    // Recreate foreign key with ON DELETE SET NULL
    await prisma.$executeRawUnsafe(`
      ALTER TABLE audit_logs 
        ADD CONSTRAINT audit_logs_admin_id_fkey 
        FOREIGN KEY (admin_id) 
        REFERENCES users(id) 
        ON DELETE SET NULL;
    `);
    console.log('✓ Created foreign key with ON DELETE SET NULL');
    
    console.log('\n✅ Migration completed successfully!');
    console.log('Users can now be deleted, and their admin_id in audit_logs will be set to NULL.');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
