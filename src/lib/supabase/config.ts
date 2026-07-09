export function getSupabaseUrl() {
  const raw =
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    "";

  return raw.replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
}

export function getSupabaseSecretKey() {
  return (
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    ""
  );
}

export function getSupabasePublishableKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    ""
  );
}

export function getGoogleClientId() {
  return process.env.GOOGLE_CLIENT_ID ?? "";
}

export function getGoogleClientSecret() {
  return process.env.GOOGLE_CLIENT_SECRET ?? "";
}

export function getSupabaseConfig() {
  const url = getSupabaseUrl();
  const key = getSupabaseSecretKey();

  return {
    url,
    key,
    urlHost: url ? new URL(url).host : null,
    isConfigured: Boolean(url && key),
  };
}
