import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export interface AuthUser {
    userId: number;
    email: string;
    name?: string | null;
}

export interface AuthContextValue {
    accessToken: string | null;
    refreshToken: string | null;
    user: AuthUser | null;
    isAuthenticated: boolean;
    login: (accessToken: string, refreshToken: string, userId: number, email: string, name?: string | null) => void;
    logout: () => void;
    getAuthHeaders: () => Record<string, string>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [refreshToken, setRefreshToken] = useState<string | null>(null);
    const [user, setUser] = useState<AuthUser | null>(null);

    useEffect(() => {
        const storedAccessToken = localStorage.getItem('agenthire_accessToken');
        const storedRefreshToken = localStorage.getItem('agenthire_refreshToken');
        const storedUser = localStorage.getItem('agenthire_user');

        if (storedAccessToken) {
            setAccessToken(storedAccessToken);
        }
        if (storedRefreshToken) {
            setRefreshToken(storedRefreshToken);
        }
        if (storedUser) {
            try {
                setUser(JSON.parse(storedUser));
            } catch {
                setUser(null);
            }
        }
    }, []);

    const login = (newAccessToken: string, newRefreshToken: string, userId: number, email: string, name?: string | null) => {
        const payload: AuthUser = { userId, email, name };
        setAccessToken(newAccessToken);
        setRefreshToken(newRefreshToken);
        setUser(payload);
        localStorage.setItem('agenthire_accessToken', newAccessToken);
        localStorage.setItem('agenthire_refreshToken', newRefreshToken);
        localStorage.setItem('agenthire_user', JSON.stringify(payload));
    };

    const logout = () => {
        setAccessToken(null);
        setRefreshToken(null);
        setUser(null);
        localStorage.removeItem('agenthire_accessToken');
        localStorage.removeItem('agenthire_refreshToken');
        localStorage.removeItem('agenthire_user');
        window.history.replaceState({}, '', '/login');
    };

    const getAuthHeaders = () => {
        if (!accessToken) return {};
        return { Authorization: `Bearer ${accessToken}` };
    };

    const value = useMemo(
        () => ({
            accessToken,
            refreshToken,
            user,
            isAuthenticated: Boolean(accessToken),
            login,
            logout,
            getAuthHeaders,
        }),
        [accessToken, refreshToken, user]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used inside AuthProvider');
    }
    return context;
}
