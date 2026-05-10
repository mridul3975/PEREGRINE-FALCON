export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE_URL_DEV || window.location.origin;

export function buildApiUrl(path: string) {
    return new URL(path, API_BASE_URL).toString();
}
