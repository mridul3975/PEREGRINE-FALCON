import { migrate } from 'drizzle-orm/libsql/migrator';
import { db } from './connection';

async function runMigrations() {
    console.log("Running database migrations...");
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log("Migrations complete!");
    process.exit(0);
}

runMigrations().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
});