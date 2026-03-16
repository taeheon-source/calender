import { ensureSchema, getPool } from "../../../lib/db";

const VALID_CATEGORIES = ["work", "lunch", "dinner", "personal"];
const VALID_FREQUENCIES = ["weekly", "monthly", "quarterly", "yearly"];
const VALID_PATTERN_TYPES = ["weekday", "businessday"];

function serializeRule(row) {
  return {
    ...row,
    start_date:
      row.start_date instanceof Date
        ? row.start_date.toISOString().slice(0, 10)
        : String(row.start_date).slice(0, 10),
    occurrence_number: Number(row.occurrence_number),
    weekday: row.weekday === null ? null : Number(row.weekday),
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
    const result = await pool.query(
      `
        SELECT id, start_date, category, content, frequency, pattern_type,
               occurrence_number, weekday, created_at, updated_at
        FROM recurring_rules
        ORDER BY created_at ASC
      `
    );

    return res.status(200).json({ rules: result.rows.map(serializeRule) });
  }

  if (req.method === "POST") {
    const {
      startDate,
      category,
      content,
      frequency,
      patternType,
      occurrenceNumber,
      weekday,
    } = req.body ?? {};

    if (
      !startDate ||
      !VALID_CATEGORIES.includes(category) ||
      !content?.trim() ||
      !VALID_FREQUENCIES.includes(frequency) ||
      !VALID_PATTERN_TYPES.includes(patternType) ||
      !Number.isInteger(Number(occurrenceNumber)) ||
      Number(occurrenceNumber) < 1
    ) {
      return res.status(400).json({ error: "Invalid recurring rule." });
    }

    if (patternType === "weekday" && !Number.isInteger(Number(weekday))) {
      return res.status(400).json({ error: "Weekday is required." });
    }

    const result = await pool.query(
      `
        INSERT INTO recurring_rules (
          start_date,
          category,
          content,
          frequency,
          pattern_type,
          occurrence_number,
          weekday
        )
        VALUES ($1::date, $2, $3, $4, $5, $6, $7)
        RETURNING id, start_date, category, content, frequency, pattern_type,
                  occurrence_number, weekday, created_at, updated_at
      `,
      [
        startDate,
        category,
        content.trim(),
        frequency,
        patternType,
        Number(occurrenceNumber),
        patternType === "weekday" ? Number(weekday) : null,
      ]
    );

    return res.status(201).json({ rule: serializeRule(result.rows[0]) });
  }

  return res.status(405).json({ error: "Method not allowed." });
}
