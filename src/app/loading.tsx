// Intentionally minimal. The previous full-screen "Loading…" spinner could
// linger if a server component awaited a slow Supabase call. Each route
// (dashboard, admin, etc.) now renders its own UI shell synchronously and
// streams data client-side, so this root loading boundary should rarely
// fire and when it does, it shows nothing rather than hiding the app.
export default function Loading() {
  return null;
}
