// drizzle.config.ts
import type { Config } from 'drizzle-kit';

export default {
    schema: "./src/db/schema.ts",
    out: "./drizzle", // Migrations will be generated here
    dialect: "sqlite",
    dbCredentials: {
        url: "file:./sqlite.db", // Must match your connection.ts
    }
} satisfies Config;