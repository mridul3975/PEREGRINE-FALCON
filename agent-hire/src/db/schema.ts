// src/db/schema.ts
import { sql } from 'drizzle-orm';
import { text, integer, sqliteTable } from 'drizzle-orm/sqlite-core';

export const discoveredJobs = sqliteTable('discovered_jobs', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    title: text('title').notNull(),
    company: text('company').notNull(),
    summary: text('summary').notNull(),
    status: text('status', { enum: ['pending_review', 'good_match', 'bad_match', 'applied'] }).default('pending_review').notNull(),
    aiAnalysis: text('ai_analysis'),
    tailoredResumeSection: text('tailored_resume_section'),
    applicationNote: text('application_note'),
    createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});


export const tailoredResumes = sqliteTable('tailored_resumes', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    jobId: integer('job_id').notNull(),
    tailoredSection: text('tailored_section').notNull(),
    createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});