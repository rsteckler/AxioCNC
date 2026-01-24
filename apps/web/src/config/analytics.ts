/**
 * Analytics configuration for frontend
 * Reads Aptabase key from environment variable (injected at build time)
 */

export const getAptabaseKey = (): string => {
  // Vite replaces import.meta.env.VITE_* at build time
  const key = import.meta.env.VITE_APTABASE_KEY;
  return typeof key === 'string' ? key : '';
};

export const isAnalyticsEnabled = (key: string, userEnabled: boolean): boolean => {
  return !!key && userEnabled;
};
