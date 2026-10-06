/**
 * A panel asks the admin to do something (admin-plan-authoring A39): POST
 * JSON, and either the server's body or, when it refuses, why — its
 * `{ error }`, else its status, else why the request never arrived. Each
 * panel decides what to do with the answer; this only says what it was.
 *
 * promise: one-definition-per-shared-rule
 */

export type Posted<T> = { ok: true; body: T } | { ok: false; error: string };

export async function postJson<T = Record<string, unknown>>(
  url: string,
  body: unknown,
): Promise<Posted<T>> {
  let r: Response;
  try {
    r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
  const parsed = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) return { ok: false, error: parsed.error ?? `HTTP ${r.status}` };
  return { ok: true, body: parsed };
}
