import type { Handler } from "@netlify/functions";
import crypto from "crypto";

const PASSWORD = process.env.APP_PASSWORD || "";
const SESSION_SECRET = process.env.APP_SESSION_SECRET || "";
const COOKIE_NAME = "activity_session";
const DAYS = Number(process.env.APP_SESSION_DAYS || 30);

function createToken() {
  const exp = Date.now() + DAYS * 24 * 60 * 60 * 1000;
  const sig = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(String(exp))
    .digest("hex");
  return `${exp}.${sig}`;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // 🚨 if env vars missing, return 500 (don’t crash)
  if (!PASSWORD || !SESSION_SECRET) {
    console.error(
      "APP_PASSWORD or APP_SESSION_SECRET missing in environment variables"
    );
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: false,
        error:
          "Server misconfigured (missing APP_PASSWORD or APP_SESSION_SECRET)",
      }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    body = {};
  }

  const password = body.password || "";

  if (password !== PASSWORD) {
    return {
      statusCode: 401,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, error: "Invalid password" }),
    };
  }

  const token = createToken();

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${
        DAYS * 24 * 60 * 60
      }`,
    },
    body: JSON.stringify({ ok: true }),
  };
};
