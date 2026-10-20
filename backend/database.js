const mysql = require('mysql2/promise');

function quoteIdentifier(value, name) {
  if (typeof value !== 'string' || !/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(value)) {
    throw new Error(`${name} must be a valid MySQL identifier.`);
  }
  return `\`${value}\``;
}

function createEmployeeRepository(env = process.env) {
  const schema = {
    database: quoteIdentifier(env.DB_NAME || 'ip_std6730251336', 'DB_NAME'),
    table: quoteIdentifier(env.DB_TABLE || 'Ratchata_6730251336_Employ', 'DB_TABLE'),
    id: quoteIdentifier(env.DB_COLUMN_ID || 'Ratchata_6730251336_id', 'DB_COLUMN_ID'),
    name: quoteIdentifier(env.DB_COLUMN_NAME || 'Ratchata_6730251336_name', 'DB_COLUMN_NAME'),
    position: quoteIdentifier(env.DB_COLUMN_POSITION || 'Ratchata_6730251336_position', 'DB_COLUMN_POSITION'),
    status: quoteIdentifier(env.DB_COLUMN_STATUS || 'Ratchata_6730251336_status', 'DB_COLUMN_STATUS'),
    salary: quoteIdentifier(env.DB_COLUMN_SALARY || 'Ratchata_6730251336_salary', 'DB_COLUMN_SALARY')
  };

  // กำหนด Host ให้รองรับทั้ง Localhost และ IP ภายนอก
  const dbHost = (env.DB_HOST === 'localhost' || !env.DB_HOST) ? '127.0.0.1' : env.DB_HOST;

  const pool = mysql.createPool({
    host: dbHost,
    port: Number(env.DB_PORT) || 3306,
    user: env.DB_USER !== undefined ? env.DB_USER : 'root',
    password: env.DB_PASSWORD !== undefined ? env.DB_PASSWORD : '',
    database: env.DB_NAME || 'ip_std6730251336',
    waitForConnections: true,
    connectionLimit: Number(env.DB_CONNECTION_LIMIT) || 10,
    queueLimit: 0,
    charset: 'utf8mb4',
    decimalNumbers: true
  });

  const selectColumns = `${schema.id} AS id, ${schema.name} AS name, ${schema.position} AS position, ${schema.status} AS status, ${schema.salary} AS salary`;
  let initializationPromise;

  async function initialize() {
    if (!initializationPromise) {
      initializationPromise = (async () => {
        const connection = await pool.getConnection();
        try {
          await connection.query(
            `CREATE TABLE IF NOT EXISTS ${schema.table} (` +
            `${schema.id} INT NOT NULL AUTO_INCREMENT PRIMARY KEY, ` +
            `${schema.name} VARCHAR(255) NOT NULL, ` +
            `${schema.position} VARCHAR(255) NOT NULL, ` +
            `${schema.status} VARCHAR(50) NOT NULL DEFAULT 'Active', ` +
            `${schema.salary} INT NOT NULL)`
          );
          await connection.query('SELECT 1');
        } finally {
          connection.release();
        }
      })().catch((error) => {
        initializationPromise = null;
        throw error;
      });
    }
    return initializationPromise;
  }

  return {
    initialize,
    async health() {
      await initialize();
      await pool.query('SELECT 1');
      return true;
    },
    async list() {
      await initialize();
      const [rows] = await pool.query(`SELECT ${selectColumns} FROM ${schema.table} ORDER BY ${schema.id} ASC`);
      return rows.map((row) => ({ ...row, id: String(row.id), salary: Number(row.salary) }));
    },
    async create(employee) {
      await initialize();
      const [result] = await pool.execute(
        `INSERT INTO ${schema.table} (${schema.name}, ${schema.position}, ${schema.status}, ${schema.salary}) VALUES (?, ?, 'Active', ?)`,
        [employee.name, employee.position, employee.salary]
      );
      const [rows] = await pool.execute(`SELECT ${selectColumns} FROM ${schema.table} WHERE ${schema.id} = ?`, [result.insertId]);
      return { ...rows[0], id: String(rows[0].id), salary: Number(rows[0].salary) };
    },
    async toggleStatus(id) {
      await initialize();
      const [result] = await pool.execute(
        `UPDATE ${schema.table} SET ${schema.status} = IF(${schema.status} = 'Active', 'On Leave', 'Active') WHERE ${schema.id} = ?`,
        [id]
      );
      if (result.affectedRows === 0) return null;
      const [rows] = await pool.execute(`SELECT ${selectColumns} FROM ${schema.table} WHERE ${schema.id} = ?`, [id]);
      return rows[0] ? { ...rows[0], id: String(rows[0].id), salary: Number(rows[0].salary) } : null;
    },
    async remove(id) {
      await initialize();
      const [result] = await pool.execute(`DELETE FROM ${schema.table} WHERE ${schema.id} = ?`, [id]);
      return result.affectedRows > 0;
    },
    async salaries() {
      await initialize();
      const [rows] = await pool.query(`SELECT ${schema.salary} AS salary FROM ${schema.table}`);
      return rows.map((row) => Number(row.salary));
    },
    close() {
      return pool.end();
    }
  };
}

module.exports = { createEmployeeRepository, quoteIdentifier };