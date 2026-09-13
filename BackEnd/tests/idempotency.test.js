const test = require('node:test');
const assert = require('node:assert/strict');
const idempotencyMiddleware = require('../middlewares/idempotency');
const ProcessedOperation = require('../models/ProcessedOperation');

test('Idempotency middleware ignores GET requests', async () => {
  let nextCalled = false;
  const req = { method: 'GET', headers: {}, body: {} };
  const res = {};
  const next = () => { nextCalled = true; };

  await idempotencyMiddleware(req, res, next);
  assert.equal(nextCalled, true);
});

test('Idempotency middleware allows mutating requests without client op id', async () => {
  let nextCalled = false;
  const req = { method: 'POST', headers: {}, body: {} };
  const res = {};
  const next = () => { nextCalled = true; };

  await idempotencyMiddleware(req, res, next);
  assert.equal(nextCalled, true);
});
