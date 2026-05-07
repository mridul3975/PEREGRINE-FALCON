import { verifyAccessToken, type JwtPayload } from '../auth/auth';

declare global {
    namespace Bun {
        interface Request {
            user?: JwtPayload;
        }
    }
}

export async function authMiddleware(req: Request): Promise<Response | void> {
    const authHeader = req.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Authorization header missing or malformed.' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const token = authHeader.split(' ')[1] as string | undefined;

    if (!token) {
        return new Response(JSON.stringify({ error: 'Token not found in Authorization header.' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const decodedUser = verifyAccessToken(token);

    if (!decodedUser) {
        return new Response(JSON.stringify({ error: 'Invalid or expired access token.' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    (req as any).user = decodedUser;
}