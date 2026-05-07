// src/auth/auth.ts
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { db } from '../../db/connection';
import { users } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
const ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY || '1h';
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || '7d';

// Ensure secrets are defined (will throw if not, good for development)
if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
    throw new Error("JWT_SECRET and JWT_REFRESH_SECRET must be defined in .env");
}

const saltRounds = 10; 
export const registerSchema = z.object({
    email: z.email(),
    password: z.string().min(8), 
    name: z.string().optional(),
});

export const loginSchema = z.object({
    email: z.email(),
    password: z.string(),
});

// Type for JWT payload
export interface JwtPayload {
    userId: number;
    email: string;
}

// --- Password Hashing ---
export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, saltRounds);
}

export async function comparePasswords(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
}

// --- JWT Generation ---
export function generateAccessToken(payload: JwtPayload): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

export function generateRefreshToken(payload: JwtPayload): string {
    return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
}

// --- JWT Verification ---
export function verifyAccessToken(token: string): JwtPayload | null {
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
        return decoded;
    } catch (error) {
        return null; // Token is invalid or expired
    }
}

export function verifyRefreshToken(token: string): JwtPayload | null {
    try {
        const decoded = jwt.verify(token, JWT_REFRESH_SECRET) as JwtPayload;
        return decoded;
    } catch (error) {
        return null; // Token is invalid or expired
    }
}

// --- User Registration ---
export async function registerUser(userData: z.infer<typeof registerSchema>) {
    const { email, password, name } = userData;

    // Check if user already exists
    const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existingUser.length > 0) {
        throw new Error("User with this email already exists.");
    }

    const passwordHash = await hashPassword(password);

    const newUser = await db.insert(users).values({
        email,
        passwordHash,
        name,
    }).returning({ id: users.id, email: users.email });

    return newUser[0];
}

// --- User Login ---
export async function loginUser(credentials: z.infer<typeof loginSchema>) {
    const { email, password } = credentials;

    const userRecord = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (userRecord.length === 0) {
        throw new Error("Invalid credentials (user not found).");
    }

    const user = userRecord[0];
    const isPasswordValid = await comparePasswords(password, user.passwordHash);

    if (!isPasswordValid) {
        throw new Error("Invalid credentials (password mismatch).");
    }

    const payload: JwtPayload = { userId: user.id, email: user.email };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload); // For rotation

    return { accessToken, refreshToken, userId: user.id, email: user.email, name: user.name };
}

// --- Token Refresh (Basic Rotation) ---
export async function refreshAccessToken(refreshToken: string) {
    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) {
        throw new Error("Invalid or expired refresh token.");
    }

    // Optionally check if user still exists in DB
    const userRecord = await db.select().from(users).where(eq(users.id, decoded.userId)).limit(1);
    if (userRecord.length === 0) {
        throw new Error("User associated with refresh token no longer exists.");
    }

    const newAccessToken = generateAccessToken(decoded);
    // For proper rotation, you might also generate a new refresh token and invalidate the old one in a DB.
    // For this simple example, we'll just return a new access token.
    return { accessToken: newAccessToken, userId: decoded.userId, email: decoded.email };
}