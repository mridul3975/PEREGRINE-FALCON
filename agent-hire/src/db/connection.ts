// src/db/connection.ts
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';
// Use a file-based SQLite database
const client = createClient({
    url: 'file:./sqlite.db',
});

export const db = drizzle(client, { schema });

async function ensureDiscoveredJobsSchema() {
    try {
        const result = await (client as any).execute({ sql: "PRAGMA table_info('discovered_jobs');" });
        const rows = result?.rows ?? result?.data ?? [];
        const columns = Array.isArray(rows)
            ? rows.map((row: any) => ({
                name: row?.name ?? row?.[1],
                type: String(row?.type ?? row?.[2] ?? '').toLowerCase(),
                notnull: Number(row?.notnull ?? row?.[3] ?? 0),
                pk: Number(row?.pk ?? row?.[5] ?? 0),
            })).filter((row: any) => Boolean(row.name))
            : [];
        if (columns.length === 0) {
            return;
        }

        const idColumn = columns.find((column: any) => column.name === 'id');
        const hasValidIdPrimaryKey = Boolean(
            idColumn &&
            idColumn.pk === 1 &&
            idColumn.type.includes('integer'),
        );

        if (!hasValidIdPrimaryKey) {
            console.log('Repairing discovered_jobs table: fixing id primary key/autoincrement schema');
            await (client as any).execute({ sql: 'BEGIN TRANSACTION;' });
            try {
                await (client as any).execute({
                    sql: `CREATE TABLE IF NOT EXISTS discovered_jobs_new (
                        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
                        title text NOT NULL,
                        company text NOT NULL,
                        summary text NOT NULL,
                        status text DEFAULT 'pending_review' NOT NULL,
                        user_id integer NOT NULL DEFAULT 0,
                        ai_analysis text,
                        tailored_resume_section text,
                        application_note text,
                        created_at text DEFAULT CURRENT_TIMESTAMP,
                        updated_at text DEFAULT CURRENT_TIMESTAMP
                    );`,
                });

                await (client as any).execute({
                    sql: `INSERT INTO discovered_jobs_new
                        (id, title, company, summary, status, user_id, ai_analysis, tailored_resume_section, application_note, created_at, updated_at)
                        SELECT
                            COALESCE(id, rowid),
                            title,
                            company,
                            summary,
                            COALESCE(status, 'pending_review'),
                            COALESCE(user_id, 0),
                            ai_analysis,
                            tailored_resume_section,
                            application_note,
                            COALESCE(created_at, CURRENT_TIMESTAMP),
                            COALESCE(updated_at, CURRENT_TIMESTAMP)
                        FROM discovered_jobs;`,
                });

                await (client as any).execute({ sql: 'DROP TABLE discovered_jobs;' });
                await (client as any).execute({ sql: 'ALTER TABLE discovered_jobs_new RENAME TO discovered_jobs;' });
                await (client as any).execute({ sql: 'COMMIT;' });
                return;
            } catch (repairError) {
                await (client as any).execute({ sql: 'ROLLBACK;' });
                throw repairError;
            }
        }

        const columnNames = columns.map((column: any) => column.name);
        if (!columnNames.includes('user_id')) {
            console.log('Migrating discovered_jobs table: adding missing user_id column');
            await (client as any).execute({ sql: 'ALTER TABLE discovered_jobs ADD COLUMN user_id INTEGER NOT NULL DEFAULT 0;' });
        }
    } catch (error) {
        console.warn('Unable to verify discovered_jobs schema:', error);
    }
}

ensureDiscoveredJobsSchema().catch((error) => {
    console.error('Schema migration error:', error);
});

console.log("Database connection established to sqlite.db");
