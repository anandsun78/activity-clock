import type { Handler } from "@netlify/functions";
import { dbConnect, json, devErrorPayload, mongoose } from "./_db";
import {
  DATE_FORMAT,
  DATE_REGEX,
  INVALID_JSON_BODY_ERROR,
  METHOD_NOT_ALLOWED_ERROR,
} from "./constants";

export const handler: Handler = async (event) => {
  try {
    await dbConnect(); // wait until fully connected

    // Define models only after connection is ready
    const SessionSchema = new mongoose.Schema(
      { start: Date, end: Date, activity: { type: String, index: true } },
      { _id: false }
    );
    const ActivityLog =
      mongoose.models.ActivityLog ||
      mongoose.model(
        "ActivityLog",
        new mongoose.Schema({
          date: { type: String, index: true }, // YYYY-MM-DD
          sessions: { type: [SessionSchema], default: [] },
        })
      );

    const { httpMethod, queryStringParameters, body } = event;
    const date = queryStringParameters?.date;
    if (!date || !DATE_REGEX.test(date)) {
      return json(400, {
        error: `Missing or invalid date. Use ?date=${DATE_FORMAT}`,
      });
    }

    // ---------- GET: fetch one day's log ----------
    if (httpMethod === "GET") {
      const doc = await ActivityLog.findOne({ date }).lean();
      return json(200, doc || { date, sessions: [] });
    }

    // ---------- POST: append a new session ----------
    if (httpMethod === "POST") {
      let parsed: any = {};
      try {
        parsed = body ? JSON.parse(body) : {};
      } catch {
        return json(400, { error: INVALID_JSON_BODY_ERROR });
      }

      const s = parsed.session || {};
      const start = new Date(s.start);
      const end = new Date(s.end);
      const activity = String(s.activity || "").trim();
      if (!activity || isNaN(start) || isNaN(end) || end <= start) {
        return json(400, {
          error: "Invalid session { start, end, activity }",
        });
      }

      const updated = await ActivityLog.findOneAndUpdate(
        { date },
        { $push: { sessions: { start, end, activity } } },
        { upsert: true, new: true }
      ).lean();
      return json(200, updated);
    }

    // ---------- DELETE: remove a previously saved session (for Undo) ----------
    if (httpMethod === "DELETE") {
      let parsed: any = {};
      try {
        parsed = body ? JSON.parse(body) : {};
      } catch {
        return json(400, { error: INVALID_JSON_BODY_ERROR });
      }

      // allow either { session: { ... } } or { start, end, activity }
      const s = parsed.session || parsed;

      const start = s.start ? new Date(s.start) : null;
      const end = s.end ? new Date(s.end) : null;
      const activity = typeof s.activity === "string" ? s.activity.trim() : "";

      if (!activity || !start || !end || isNaN(start) || isNaN(end)) {
        return json(400, {
          error:
            "Invalid session { start, end, activity } for DELETE. You must send the exact values that were saved.",
        });
      }

      // Pull matching session out of the sessions array
      const updated = await ActivityLog.findOneAndUpdate(
        { date },
        {
          $pull: {
            sessions: {
              start,
              end,
              activity,
            },
          },
        },
        { new: true }
      ).lean();

      return json(200, updated || { date, sessions: [] });
    }

    // ---------- Fallback ----------
    return json(405, { error: METHOD_NOT_ALLOWED_ERROR });
  } catch (err) {
    console.error("activityLogs error:", err);
    return json(500, devErrorPayload(err));
  }
};
