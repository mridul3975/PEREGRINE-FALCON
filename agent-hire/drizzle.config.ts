// drizzle.config.ts
import 'dotenv/config';
import type { Config } from 'drizzle-kit';

export default {
    schema: "./src/db/schema.ts",
    out: "./drizzle", // Migrations will be generated here
    dialect: "sqlite",
    dbCredentials: {
        url: process.env.TURSO_DATABASE_URL ?? "file:./sqlite.db",
    },
} satisfies Config;