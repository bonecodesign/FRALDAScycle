function mapNotification(row) {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type,
    message: row.message,
    createdAt: row.createdAt,
    readAt: row.readAt,
  };
}

export class PostgresNotificationRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async create({ userId, type, message }) {
    const { rows } = await this.pool.query(
      `INSERT INTO notifications (user_id, type, message)
       VALUES ($1, $2, $3)
       RETURNING
         id,
         user_id AS "userId",
         type,
         message,
         created_at AS "createdAt",
         read_at AS "readAt"`,
      [userId, type, message],
    );

    return mapNotification(rows[0]);
  }

  async listByUser(userId) {
    const { rows } = await this.pool.query(
      `SELECT
         id,
         user_id AS "userId",
         type,
         message,
         created_at AS "createdAt",
         read_at AS "readAt"
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId],
    );

    return rows.map(mapNotification);
  }
}
