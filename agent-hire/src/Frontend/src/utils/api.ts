const env = import.meta.env;
export const API_BASE_URL = env.VITE_API_BASE_URL || (env.MODE === 'development' ? env.VITE_API_BASE_URL_DEV : window.location.origin);

export function buildApiUrl(path: string) {
    return new URL(path, API_BASE_URL).toString();
}
