// Verify the browser session with the deployment's own Supabase project.
export async function reviewAccount(request: Request): Promise<string | Response> {
  const denied = (status: number) => Response.json(
    { error: status === 401 ? "sign_in_required" : "authentication_unavailable" },
    { status, headers: { "Cache-Control": "no-store", "X-TCF-No-Retry": "1" } },
  );
  const authorization = request.headers.get("Authorization");
  if (!authorization || !/^Bearer \S+$/i.test(authorization)) return denied(401);
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)?.replace(/\/$/, "");
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return denied(503);
  try {
    const response = await fetch(url + "/auth/v1/user", {
      headers: { apikey: key, Authorization: authorization },
      signal: AbortSignal.timeout(4000), redirect: "error",
    });
    if (!response.ok) return denied([401, 403].includes(response.status) ? 401 : 503);
    const account = await response.json();
    return typeof account?.id === "string" && account.id && !account.is_anonymous
      ? account.id : denied(401);
  } catch { return denied(503); }
}
