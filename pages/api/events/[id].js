import { ensureSchema, getPool } from "../../../lib/db";

const VALID_CATEGORIES = ["work", "lunch", "dinner", "personal"];

function serializeEvent(row) {
  return {
    ...row,
    event_date:
      row.event_date instanceof Date
        ? row.event_date.toISOString().slice(0, 10)
        : String(row.event_date).slice(0, 10),
  };
}

export default async function handler(req, res) {
  try {
    await ensureSchema();
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }

  const { id } = req.query;
  const pool = getPool();

  if (!/^\d+$/.test(String(id))) {
    return res.status(400).json({ error: "Invalid id." });
  }

  if (req.method === "PUT") {
    const { eventDate, category, content } = req.body ?? {};

    if (!eventDate || !VALID_CATEGORIES.includes(category) || !content?.trim()) {
      return res.status(400).json({ error: "Invalid request body." });
    }

    const result = await pool.query(
      `
        UPDATE calendar_events
        SET event_date = $1::date,
            category = $2,
            content = $3,
            updated_at = NOW()
        WHERE id = $4
        RETURNING id, event_date, category, content, created_at, updated_at
      `,
      [eventDate, category, content.trim(), id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: "Event not found." });
    }

    return res.status(200).json({ event: serializeEvent(result.rows[0]) });
  }

  if (req.method === "DELETE") {
    const result = await pool.query(
      `
        DELETE FROM calendar_events
        WHERE id = $1
        RETURNING id
      `,
      [id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: "Event not found." });
    }

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed." });
}
