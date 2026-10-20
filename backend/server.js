require('dotenv').config({ override: true });

const { createEmployeeRepository } = require('./database');
const { createApp } = require('./app');

const PORT = Number(process.env.PORT) || 3099;
const repository = createEmployeeRepository();
const app = createApp({ repository });

async function start() {
  try {
    await repository.initialize();
  } catch (error) {
    console.warn('MySQL is not ready yet. The API will retry when a database request arrives.');
    console.warn(error.code || error.message || String(error));
  }
  return app.listen(PORT, '0.0.0.0', () => {
    console.log(`HR API listening on http://localhost:${PORT}`);
    console.log(`MySQL database: ${process.env.DB_NAME || 'ip_std6730251336'}`);
  });
}

if (require.main === module) start();

module.exports = { app, start };