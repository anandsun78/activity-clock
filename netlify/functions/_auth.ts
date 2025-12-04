import crypto from "crypto";
import type { HandlerEvent } from "@netlify/functions";

const SECRET = process.env.APP_SESSION_SECRET || "";
const COOKIE = "activity_session";

function parseCookies(header?: string) {
  const output: Record<string, string> = {};
  if (!header) return output;

  header.split(";").forEach((p) => {
    const [k, v] = p.trim().split("=");
    if (k) output[k] = v;
  });

  return output;
}

function verify(token?: string) {
  if (!token || !SECRET) return false;

  const [exp, sig] = token.split(".");
  if (!exp || !sig) return false;

  if (Number(exp) < Date.now()) return false;

  const expected = crypto.createHmac("sha256", SECRET).update(exp).digest("hex");

  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

export function requireAuth(event: HandlerEvent) {
  const cookies = parseCookies(event.headers.cookie || (event.headers as any).Cookie);
  return verify(cookies[COOKIE]);
}
