// src/auth/auth.ts
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { db } from '../../db/connection';
import { refreshTokens, users } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
const ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY || '1h';
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || '7d';

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

export interface JwtPayload {
    userId: number;
    email: string;
}

export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, saltRounds);
}

export async function comparePasswords(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
}

export function generateAccessToken(payload: JwtPayload): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY as any });
}

export function generateRefreshToken(payload: JwtPayload): string {
    return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY as any });
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
export async function SignupUser(userData: z.infer<typeof registerSchema>) {
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
    if (!user) {
        throw new Error("Invalid credentials (user not found).");
    }

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
export async function refreshAccessToken(oldToken: string) {
    // 1. Basic JWT Validation
    const decoded = verifyRefreshToken(oldToken);
    if (!decoded) throw new Error("Invalid format.");

    // 2. Look up the token in the DB
    const [tokenRecord] = await db.select()
        .from(refreshTokens)
        .where(eq(refreshTokens.token_hash, oldToken))
        .limit(1);

    if (!tokenRecord) {
        throw new Error("Token does not exist.");
    }

    // 3. Reuse Detection (The "Nuclear" Option)
    if (tokenRecord.isRevoked === 1) {
        // If someone uses a token twice, it means the old one was likely stolen.
        // Revoke EVERYTHING for this user for safety.
        await db.delete(refreshTokens).where(eq(refreshTokens.userId, decoded.userId));
        throw new Error("Security Alert: Session compromised. Please log in again.");
    }

    // 4. Mark old token as revoked (Rotate)
    await db.update(refreshTokens)
        .set({ isRevoked: 1 })
        .where(eq(refreshTokens.id, tokenRecord.id));

    // 5. Generate new pair
    const accessToken = generateAccessToken(decoded);
    const newRefreshTokenString = generateRefreshToken(decoded);

    // 6. Save the new refresh token to DB
    await db.insert(refreshTokens).values({
        userId: decoded.userId,
        token_hash: newRefreshTokenString,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // e.g., 7 days
    });

    return { accessToken, refreshToken: newRefreshTokenString };
}