// src/db/schema.ts
import { sql } from 'drizzle-orm';
import { text, integer, sqliteTable } from 'drizzle-orm/sqlite-core';

export const discoveredJobs = sqliteTable('discovered_jobs', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    title: text('title').notNull(),
    company: text('company').notNull(),
    summary: text('summary').notNull(),
    status: text('status', { enum: ['pending_review', 'good_match', 'bad_match', 'applied'] }).default('pending_review').notNull(),
    userId: integer('user_id').notNull(),
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

export const users = sqliteTable('users', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    email: text('email').unique().notNull(), // Unique email for login
    passwordHash: text('password_hash').notNull(), // Store hashed password, NOT plain text!
    name: text('name'), // User's display name
    // Add other profile fields if needed, e.g., resume storage, preferred tech stack, etc.
    createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const refreshTokens = sqliteTable('refresh_tokens', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id').notNull(),
    token_hash: text('token').notNull(),
    expiresAt: text('expires_at').notNull(),
    isRevoked: integer('is_revoked').default(0).notNull(), // 0 = false, 1 = true
    replacedBy: text('replaced_by'), // Store the new token that replaces this one (for rotation tracking)
});    