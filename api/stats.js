import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

export default async function handler(req, res) {
  await pool.query(`
    INSERT INTO stats (id, total)
    VALUES ('requests', 1)
    ON CONFLICT (id)
    DO UPDATE SET total = stats.total + 1
  `)

  if (req.headers.accept?.includes('application/json')) {
    const result = await pool.query("SELECT total FROM stats WHERE id = 'requests'")
    const total = result.rows[0]?.total ?? 0

    return res.status(200).json({
      totalRequests: total,
      seriesData: []
    })
  }

  return res.redirect(302, '/')
}
