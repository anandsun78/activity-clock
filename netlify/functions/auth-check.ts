import type { Handler } from "@netlify/functions";
import { requireAuth } from "./_auth";

export const handler: Handler = async (event) => {
  if (!requireAuth(event)) {
    return {
      statusCode: 401,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false }),
    };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ok: true }),
  };
};
