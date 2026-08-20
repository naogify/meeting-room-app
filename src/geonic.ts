import GeonicDB from '@geolonia/geonicdb-sdk';

const DEFAULT_URL = 'https://geonicdb.geolonia.com';

/**
 * The SDK concatenates paths onto the base URL verbatim, so a trailing slash
 * produces requests like `//auth/login`. The server routes that outside the
 * auth-exempt prefix and the policy engine rejects it with
 * `403 Access denied: no applicable policy` — which looks like a permissions
 * problem but is only a malformed URL. Normalize before handing it over.
 */
function normalizeBaseUrl(raw: string | undefined): string {
  const value = (raw ?? DEFAULT_URL).trim();
  return (value || DEFAULT_URL).replace(/\/+$/, '');
}

const baseUrl = normalizeBaseUrl(import.meta.env.VITE_GEONICDB_URL);
const tenant = (import.meta.env.VITE_GEONICDB_TENANT ?? 'ohashi').trim();

/**
 * Single shared client. The SDK sender-constrains the session with DPoP on
 * login by itself, and caches reads with ETag/304, so one long-lived instance
 * is what we want rather than one per component.
 */
export const db = new GeonicDB({ baseUrl, tenant });

export { tenant, baseUrl, normalizeBaseUrl };
