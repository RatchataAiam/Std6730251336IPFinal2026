const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { createApp, clusterSalaries, createToken, verifyToken } = require('../app');
const { quoteIdentifier } = require('../database');

const auth = {
  username: 'exam-admin',
  password: 'test-password',
  tokenSecret: 'test-secret-that-is-long-enough-for-tests'
};
let employees;
let repository;
let server;
let baseUrl;

before(async () => {
  employees = [
    { id: '1', name: 'John Doe', position: 'Software Engineer', status: 'Active', salary: 45000 },
    { id: '2', name: 'Jane Smith', position: 'Product Designer', status: 'Active', salary: 58000 },
    { id: '3', name: 'Alex Johnson', position: 'HR Specialist', status: 'On Leave', salary: 32000 },
    { id: '4', name: 'Mina Patel', position: 'Data Analyst', status: 'Active', salary: 72000 },
    { id: '5', name: 'Sam Wilson', position: 'Engineering Manager', status: 'Active', salary: 98000 }
  ];
  let nextId = 6;
  repository = {
    health: async () => true,
    list: async () => employees,
    create: async (employee) => {
      const created = { id: String(nextId++), ...employee, status: 'Active' };
      employees.push(created);
      return created;
    },
    toggleStatus: async (id) => {
      const employee = employees.find((item) => item.id === id);
      if (!employee) return null;
      employee.status = employee.status === 'Active' ? 'On Leave' : 'Active';
      return employee;
    },
    remove: async (id) => {
      const lengthBefore = employees.length;
      employees = employees.filter((item) => item.id !== id);
      return employees.length !== lengthBefore;
    },
    salaries: async () => employees.map((employee) => employee.salary)
  };
  server = createApp({ repository, auth }).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

test('login, employee CRUD, and salary clustering work together', async () => {
  const unauthorized = await fetch(`${baseUrl}/api/employees`);
  assert.equal(unauthorized.status, 401);

  const login = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: auth.username, password: auth.password })
  });
  assert.equal(login.status, 200);
  const { token } = await login.json();
  const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };

  const initial = await fetch(`${baseUrl}/api/employees`, { headers });
  assert.equal((await initial.json()).employees.length, 5);

  const invalid = await fetch(`${baseUrl}/api/employees`, {
    method: 'POST', headers, body: JSON.stringify({ name: '', position: 'Tester', salary: 30000 })
  });
  assert.equal(invalid.status, 400);

  const fractionalSalary = await fetch(`${baseUrl}/api/employees`, {
    method: 'POST', headers, body: JSON.stringify({ name: 'Taylor Reed', position: 'Tester', salary: 30000.5 })
  });
  assert.equal(fractionalSalary.status, 400);

  const createdResponse = await fetch(`${baseUrl}/api/employees`, {
    method: 'POST', headers, body: JSON.stringify({ name: 'Taylor Reed', position: 'Tester', salary: 40000 })
  });
  assert.equal(createdResponse.status, 201);
  const { employee } = await createdResponse.json();

  const toggled = await fetch(`${baseUrl}/api/employees/${employee.id}/status`, { method: 'PUT', headers });
  assert.equal((await toggled.json()).employee.status, 'On Leave');

  const analysis = await fetch(`${baseUrl}/api/employees/salary-clusters`, { headers });
  const clusters = (await analysis.json()).clusters;
  assert.equal(clusters.length, 3);
  assert.equal(clusters.reduce((total, cluster) => total + cluster.count, 0), 6);

  const deleted = await fetch(`${baseUrl}/api/employees/${employee.id}`, { method: 'DELETE', headers });
  assert.equal(deleted.status, 200);
  const missing = await fetch(`${baseUrl}/api/employees/${employee.id}`, { method: 'DELETE', headers });
  assert.equal(missing.status, 404);
});

test('health endpoint reports database and returns a service unavailable response on failure', async () => {
  const healthy = await fetch(`${baseUrl}/api/health`);
  assert.deepEqual(await healthy.json(), { success: true, database: 'connected' });

  const unavailableApp = createApp({
    auth,
    repository: { health: async () => { throw Object.assign(new Error('offline'), { code: 'ECONNREFUSED' }); } }
  });
  const unavailableServer = unavailableApp.listen(0, '127.0.0.1');
  await new Promise((resolve) => unavailableServer.once('listening', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${unavailableServer.address().port}/api/health`);
    assert.equal(response.status, 503);
  } finally {
    await new Promise((resolve, reject) => unavailableServer.close((error) => (error ? reject(error) : resolve())));
  }
});

test('tokens expire and database identifiers are validated', () => {
  const issuedAt = 1_800_000_000_000;
  const token = createToken('admin', auth.tokenSecret, issuedAt);
  assert.equal(verifyToken(token, auth.tokenSecret, issuedAt), true);
  assert.equal(verifyToken(token, auth.tokenSecret, issuedAt + 9 * 60 * 60 * 1000), false);
  assert.equal(verifyToken(`${token}x`, auth.tokenSecret, issuedAt), false);
  assert.equal(quoteIdentifier('Ratchata_6730251336_Employ', 'DB_TABLE'), '`Ratchata_6730251336_Employ`');
  assert.throws(() => quoteIdentifier('employees; DROP TABLE users', 'DB_TABLE'), /valid MySQL identifier/);
});

test('salary clustering handles empty and identical input', () => {
  assert.deepEqual(clusterSalaries([]), [
    { group: 'Tier 1', centroid: 0, count: 0 },
    { group: 'Tier 2', centroid: 0, count: 0 },
    { group: 'Tier 3', centroid: 0, count: 0 }
  ]);
  assert.equal(clusterSalaries([100, 100, 100]).reduce((sum, cluster) => sum + cluster.count, 0), 3);
});

test('legacy Expo login route remains available', async () => {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: auth.username, password: auth.password })
  });
  assert.equal(response.status, 200);
  assert.equal(typeof (await response.json()).token, 'string');
});