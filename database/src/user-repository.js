export class PostgresUserRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async findByEmail(email) {
    const { rows } = await this.pool.query(
      `SELECT
        id,
        email,
        password_hash AS "passwordHash",
        password_salt AS "passwordSalt",
        created_at AS "createdAt"
      FROM users
      WHERE email = $1`,
      [email],
    );

    return rows[0] ?? null;
  }

  async findById(id) {
    const { rows } = await this.pool.query(
      `SELECT
        id,
        email,
        password_hash AS "passwordHash",
        password_salt AS "passwordSalt",
        created_at AS "createdAt"
      FROM users
      WHERE id = $1`,
      [id],
    );

    return rows[0] ?? null;
  }

  async create({ email, passwordHash, passwordSalt }) {
    const { rows } = await this.pool.query(
      `INSERT INTO users (email, password_hash, password_salt)
       VALUES ($1, $2, $3)
       RETURNING
         id,
         email,
         password_hash AS "passwordHash",
         password_salt AS "passwordSalt",
         created_at AS "createdAt"`,
      [email, passwordHash, passwordSalt],
    );

    return rows[0];
  }
}
