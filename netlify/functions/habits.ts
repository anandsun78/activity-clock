// /.netlify/functions/habits.ts
// GET  /.netlify/functions/habits/2025-09-25              -> { data: {...} }
// POST /.netlify/functions/habits/2025-09-25  { data:{} }  -> { ok:true, data:{...} }
// GET  /.netlify/functions/habits?from=YYYY-MM-DD&to=YYYY-MM-DD
//      -> { data: { "YYYY-MM-DD": {...}, ... } }

import type { Handler } from "@netlify/functions";
import { dbConnect, json, mongoose } from "./_db";
import {
  DATE_FORMAT,
  DATE_REGEX,
  HABITS_ROUTE_SEGMENT,
  INVALID_JSON_BODY_ERROR,
  METHOD_NOT_ALLOWED_ERROR,
  SERVER_ERROR_MESSAGE,
} from "./constants";

function isYmd(s?: string | null) {
  return typeof s === "string" && DATE_REGEX.test(s);
}

const HabitSchema = new mongoose.Schema(
  {
    date: { type: String, required: true, index: true }, // YYYY-MM-DD (Edmonton key from client)
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

const Habit = mongoose.models.Habit || mongoose.model("Habit", HabitSchema);

export const handler: Handler = async (event) => {
  try {
    await dbConnect();

    const { httpMethod, path, queryStringParameters, body } = event;

    // Support both /habits/:date and /habits?from=&to=
    const parts = path.split("/");
    const last = parts[parts.length - 1];
    const hasDateInPath = last && last !== HABITS_ROUTE_SEGMENT;

    // -------- Range GET --------
    if (httpMethod === "GET" && !hasDateInPath) {
      const from = queryStringParameters?.from;
      const to = queryStringParameters?.to;
      if (!isYmd(from) || !isYmd(to) || from > to) {
        return json(400, {
          error: `Use ?from=${DATE_FORMAT}&to=${DATE_FORMAT} with from<=to`,
        });
      }

      const docs = await Habit.find({
        date: { $gte: from, $lte: to },
      }).lean();

      // Build a map keyed by date; if a date has no doc, omit it (client merges with today anyway)
      const map: Record<string, unknown> = {};
      for (const d of docs) {
        map[d.date] = d.data || {};
      }
      return json(200, { data: map });
    }

    // For path-based calls, extract date
    const date = hasDateInPath ? last : null;
    if (!date) {
      return json(400, {
        error: `Missing date. Use /${HABITS_ROUTE_SEGMENT}/:date or ?from=&to=`,
      });
    }
    if (!isYmd(date)) {
      return json(400, { error: `Invalid date. Use ${DATE_FORMAT}` });
    }

    // -------- GET one day --------
    if (httpMethod === "GET") {
      const doc = await Habit.findOne({ date }).lean();
      return json(200, { data: doc?.data || {} });
    }

    // -------- POST upsert one day --------
    if (httpMethod === "POST") {
      let parsed: any = {};
      try {
        parsed = body ? JSON.parse(body) : {};
      } catch {
        return json(400, { error: INVALID_JSON_BODY_ERROR });
      }
      if (typeof parsed.data !== "object" || parsed.data === null) {
        return json(400, { error: "Body must be { data: { ... } }" });
      }

      const updated = await Habit.findOneAndUpdate(
        { date },
        { $set: { data: parsed.data } },
        { upsert: true, new: true }
      ).lean();

      return json(200, { ok: true, data: updated.data || {} });
    }

    return json(405, { error: METHOD_NOT_ALLOWED_ERROR });
  } catch (err) {
    console.error("habits function error:", err);
    const msg = err?.message || SERVER_ERROR_MESSAGE;
    return json(500, { error: msg });
  }
};
