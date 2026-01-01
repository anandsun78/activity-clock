import type { Handler } from "@netlify/functions";
import { requireAuth } from "./_auth";
import { CONTENT_TYPE_JSON } from "./constants";

export const handler: Handler = async (event) => {
  if (!requireAuth(event)) {
    return {
      statusCode: 401,
      headers: { "Content-Type": CONTENT_TYPE_JSON },
      body: JSON.stringify({ ok: false }),
    };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": CONTENT_TYPE_JSON },
    body: JSON.stringify({ ok: true }),
  };
};
