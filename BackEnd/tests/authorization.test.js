const test = require('node:test');
const assert = require('node:assert/strict');
const { authorize } = require('../middlewares/authorize');
const validateRestaurantOwnership = require('../middlewares/validateRestaurantOwnership');

const createResponse = () => {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
};

test('authorize allows matching roles', () => {
  const req = { user: { role: 'waiter' } };
  const res = createResponse();
  let nextCalled = false;

  authorize('WAITER')(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
});

test('authorize rejects wrong roles', () => {
  const req = { user: { role: 'chef' } };
  const res = createResponse();
  let nextCalled = false;

  authorize('CASHIER')(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.success, false);
});

test('restaurant ownership allows assigned restaurant', async () => {
  const req = {
    user: { userId: 'user-1', role: 'waiter', restaurantId: 'restaurant-1' },
    params: { restaurantId: 'restaurant-1' },
    body: {},
    query: {},
  };
  const res = createResponse();
  let nextCalled = false;

  await validateRestaurantOwnership()(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
});

test('restaurant ownership rejects another restaurant', async () => {
  const req = {
    user: { userId: 'user-1', role: 'waiter', restaurantId: 'restaurant-1' },
    params: { restaurantId: 'restaurant-2' },
    body: {},
    query: {},
  };
  const res = createResponse();
  let nextCalled = false;

  await validateRestaurantOwnership()(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.success, false);
});
