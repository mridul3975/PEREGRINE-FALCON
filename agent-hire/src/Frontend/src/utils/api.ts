const env = import.meta.env;
export const API_BASE_URL = env.VITE_API_BASE_URL || (env.MODE === 'development' ? '' : window.location.origin);

export function buildApiUrl(path: string) {
    if (env.MODE === 'development' && !env.VITE_API_BASE_URL) {
        return path;
    }
    return new URL(path, API_BASE_URL).toString();
}
