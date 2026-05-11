const env = import.meta.env;
export const API_BASE_URL =
    env.VITE_API_BASE_URL ||
    (env.DEV ? (env.VITE_API_BASE_URL_DEV || '') : window.location.origin);

console.log('ACTIVE_API_BASE_URL', API_BASE_URL, 'VITE_API_BASE_URL', env.VITE_API_BASE_URL, 'VITE_API_BASE_URL_DEV', env.VITE_API_BASE_URL_DEV, 'DEV', env.DEV);

export function buildApiUrl(path: string) {
    if (env.DEV && !env.VITE_API_BASE_URL) {
        return path;
    }
    return new URL(path, API_BASE_URL).toString();
}
