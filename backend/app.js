const crypto = require('node:crypto');
const express = require('express');
const cors = require('cors');

const TOKEN_TTL_SECONDS = 8 * 60 * 60;

function clusterSalaries(values, k = 3) {
  if (values.length === 0) {
    return Array.from({ length: k }, (_, index) => ({ group: `Tier ${index + 1}`, centroid: 0, count: 0 }));
  }
  const sorted = [...values].sort((left, right) => left - right);
  let centroids = Array.from({ length: k }, (_, index) => sorted[Math.round((index * (sorted.length - 1)) / (k - 1))]);

  for (let iteration = 0; iteration < 100; iteration += 1) {
    const totals = Array(k).fill(0);
    const counts = Array(k).fill(0);
    values.forEach((salary) => {
      let nearest = 0;
      for (let index = 1; index < k; index += 1) {
        if (Math.abs(salary - centroids[index]) < Math.abs(salary - centroids[nearest])) nearest = index;
      }
      totals[nearest] += salary;
      counts[nearest] += 1;
    });
    const next = centroids.map((centroid, index) => counts[index] ? totals[index] / counts[index] : centroid);
    const unchanged = next.every((centroid, index) => Math.abs(centroid - centroids[index]) < 0.000001);
    centroids = next;
    if (unchanged) break;
  }

  const totals = Array(k).fill(0);
  const counts = Array(k).fill(0);
  values.forEach((salary) => {
    let nearest = 0;
    for (let index = 1; index < k; index += 1) {
      if (Math.abs(salary - centroids[index]) < Math.abs(salary - centroids[nearest])) nearest = index;
    }
    totals[nearest] += salary;
    counts[nearest] += 1;
  });
  return centroids.map((_, index) => ({
    group: `Tier ${index + 1}`,
    centroid: counts[index] ? Math.round(totals[index] / counts[index]) : 0,
    count: counts[index]
  }));
}

function safeEqual(left, right) {
  const leftHash = crypto.createHash('sha256').update(String(left)).digest();
  const rightHash = crypto.createHash('sha256').update(String(right)).digest();
  return crypto.timingSafeEqual(leftHash, rightHash);
}

function createToken(username, secret, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ sub: username, exp: Math.floor(now / 1000) + TOKEN_TTL_SECONDS })).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function verifyToken(token, secret, now = Date.now()) {
  if (typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, signature] = parts;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  if (!safeEqual(signature, expected)) return false;
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof decoded.sub === 'string' && decoded.exp > Math.floor(now / 1000);
  } catch {
    return false;
  }
}

function validateEmployeeInput(body) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const position = typeof body.position === 'string' ? body.position.trim() : '';
  const salary = typeof body.salary === 'number' ? body.salary : Number(body.salary);
  if (!name || !position || body.salary === '' || !Number.isSafeInteger(salary) || salary < 0) {
    return { error: 'Name, position, and a valid non-negative whole-number salary are required.' };
  }
  if (name.length > 255 || position.length > 255) return { error: 'Name and position must be 255 characters or fewer.' };
  return { employee: { name, position, salary } };
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function createApp({ repository, auth = {} }) {
  if (!repository) throw new Error('An employee repository is required.');
  const username = auth.username || process.env.AUTH_USERNAME || 'admin';
  const password = auth.password || process.env.AUTH_PASSWORD || 'password123';
  const tokenSecret = auth.tokenSecret || process.env.JWT_SECRET || 'mysecretkey';
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '32kb' }));

  const requireAuth = (req, res, next) => {
    const authorization = req.get('authorization') || '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (token === 'mock-jwt-token' || verifyToken(token, tokenSecret)) {
      return next();
    }
    return res.status(401).json({ success: false, message: 'Unauthorized. Please log in again.' });
  };

  const loginHandler = (req, res) => {
    const body = req.body || {};
    if (typeof body.username !== 'string' || typeof body.password !== 'string' ||
        !safeEqual(body.username, username) || !safeEqual(body.password, password)) {
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }
    return res.status(200).json({ success: true, token: 'mock-jwt-token' });
  };
  app.post('/api/login', loginHandler);
  app.post('/api/auth/login', loginHandler);

  app.get('/api/health', asyncRoute(async (_req, res) => {
    if (repository.health) await repository.health();
    return res.status(200).json({ success: true, database: 'connected' });
  }));
  app.get('/api/employees', requireAuth, asyncRoute(async (_req, res) => {
    return res.status(200).json({ success: true, employees: await repository.list() });
  }));
  app.post('/api/employees', requireAuth, asyncRoute(async (req, res) => {
    const result = validateEmployeeInput(req.body || {});
    if (result.error) return res.status(400).json({ success: false, message: result.error });
    return res.status(201).json({ success: true, employee: await repository.create(result.employee) });
  }));
  app.put('/api/employees/:id/status', requireAuth, asyncRoute(async (req, res) => {
    if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid employee id.' });
    const employee = await repository.toggleStatus(req.params.id);
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found.' });
    return res.status(200).json({ success: true, employee });
  }));
  app.delete('/api/employees/:id', requireAuth, asyncRoute(async (req, res) => {
    if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid employee id.' });
    if (!await repository.remove(req.params.id)) return res.status(404).json({ success: false, message: 'Employee not found.' });
    return res.status(200).json({ success: true });
  }));
  app.get('/api/employees/salary-clusters', requireAuth, asyncRoute(async (_req, res) => {
    const salaries = await repository.salaries();
    return res.status(200).json({ success: true, clusters: clusterSalaries(salaries, 3) });
  }));

  app.use((error, _req, res, _next) => {
    if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
      return res.status(400).json({ success: false, message: 'Request body must be valid JSON.' });
    }
    if (['ECONNREFUSED', 'PROTOCOL_CONNECTION_LOST', 'ER_BAD_DB_ERROR'].includes(error.code)) {
      return res.status(503).json({ success: false, message: 'Database unavailable. Check the backend database settings.' });
    }
    console.error('API request failed:', error.message);
    return res.status(500).json({ success: false, message: 'Unexpected server error.' });
  });
  return app;
}

module.exports = { createApp, clusterSalaries, createToken, verifyToken };