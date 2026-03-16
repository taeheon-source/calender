import { ensureSchema, getPool } from "../../../lib/db";

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

  if (req.method === "DELETE") {
    const result = await pool.query(
      `
        DELETE FROM recurring_rules
        WHERE id = $1
        RETURNING id
      `,
      [id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: "Recurring rule not found." });
    }

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed." });
}
