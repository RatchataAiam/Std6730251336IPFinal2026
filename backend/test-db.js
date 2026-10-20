// test-db.js
require('dotenv').config();
const mysql = require('mysql2/promise');

async function testDB() {
  console.log('--- กำลังทดสอบเชื่อมต่อ DB ---');
  console.log(`HOST: ${process.env.DB_HOST}`);
  console.log(`USER: ${process.env.DB_USER}`);
  console.log(`DATABASE: ${process.env.DB_NAME}`);
  console.log(`TABLE: ${process.env.DB_TABLE}`);

  try {
    const host = process.env.DB_HOST === 'localhost' ? '127.0.0.1' : process.env.DB_HOST;
    const conn = await mysql.createConnection({
      host: host,
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    console.log('✅ 1. เชื่อมต่อ MySQL Server สำเร็จ!');

    const table = process.env.DB_TABLE || 'Ratchata_6730251336_Employ';
    const [rows] = await conn.execute(`SELECT * FROM \`${table}\``);
    console.log(`✅ 2. ดึงข้อมูลสำเร็จ! พบพนักงานทั้งหมด: ${rows.length} คน`);
    console.log(rows);

    await conn.end();
  } catch (err) {
    console.error('\n❌ เกิดข้อผิดพลาด (ERROR DETAILS):');
    console.error(`Error Code: ${err.code}`);
    console.error(`Message: ${err.message}`);
  }
}

testDB();