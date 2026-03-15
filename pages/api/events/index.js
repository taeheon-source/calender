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

  const pool = getPool();

  if (req.method === "GET") {
    const { year = "2026", month } = req.query;
    const yearNumber = Number(year);

    if (!Number.isInteger(yearNumber)) {
      return res.status(400).json({ error: "Invalid year." });
    }

    const monthNumber = month ? Number(month) : null;
    const startDateObject = monthNumber
      ? new Date(Date.UTC(yearNumber, monthNumber - 1, 1))
      : new Date(Date.UTC(yearNumber, 0, 1));
    const endDateObject = monthNumber
      ? new Date(Date.UTC(yearNumber, monthNumber, 0))
      : new Date(Date.UTC(yearNumber, 11, 31));
    const startDate = startDateObject.toISOString().slice(0, 10);
    const endDate = endDateObject.toISOString().slice(0, 10);

    const result = await pool.query(
      `
        SELECT id, event_date, category, content, created_at, updated_at
        FROM calendar_events
        WHERE event_date BETWEEN $1::date AND $2::date
        ORDER BY event_date ASC, created_at ASC
      `,
      [startDate, endDate]
    );

    return res.status(200).json({ events: result.rows.map(serializeEvent) });
  }

  if (req.method === "POST") {
    const { eventDate, category, content } = req.body ?? {};

    if (!eventDate || !VALID_CATEGORIES.includes(category) || !content?.trim()) {
      return res.status(400).json({ error: "Invalid request body." });
    }

    const result = await pool.query(
      `
        INSERT INTO calendar_events (event_date, category, content)
        VALUES ($1::date, $2, $3)
        RETURNING id, event_date, category, content, created_at, updated_at
      `,
      [eventDate, category, content.trim()]
    );

    return res.status(201).json({ event: serializeEvent(result.rows[0]) });
  }

  return res.status(405).json({ error: "Method not allowed." });
}
