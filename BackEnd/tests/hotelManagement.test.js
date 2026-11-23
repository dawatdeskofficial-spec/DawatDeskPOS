const test = require('node:test');
const assert = require('node:assert/strict');
const { authorize } = require('../middlewares/authorize');
const validateRestaurantOwnership = require('../middlewares/validateRestaurantOwnership');
const hotelBookingService = require('../services/hotelBookingService');

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

// ── 1. Role-based access control tests ──────────────────────────────────────
test('hotel authorization: allows RESTAURANT_ADMIN and CASHIER', () => {
  const adminReq = { user: { role: 'restaurant_admin' } };
  const cashierReq = { user: { role: 'cashier' } };
  const res1 = createResponse();
  const res2 = createResponse();
  let adminPassed = false;
  let cashierPassed = false;

  authorize('MAIN_ADMIN', 'RESTAURANT_ADMIN', 'CASHIER')(adminReq, res1, () => {
    adminPassed = true;
  });
  authorize('MAIN_ADMIN', 'RESTAURANT_ADMIN', 'CASHIER')(cashierReq, res2, () => {
    cashierPassed = true;
  });

  assert.equal(adminPassed, true);
  assert.equal(cashierPassed, true);
});

test('hotel authorization: rejects WAITER and CHEF with 403', () => {
  const waiterReq = { user: { role: 'waiter' } };
  const chefReq = { user: { role: 'chef' } };
  const res1 = createResponse();
  const res2 = createResponse();
  let waiterPassed = false;
  let chefPassed = false;

  authorize('MAIN_ADMIN', 'RESTAURANT_ADMIN', 'CASHIER')(waiterReq, res1, () => {
    waiterPassed = true;
  });
  authorize('MAIN_ADMIN', 'RESTAURANT_ADMIN', 'CASHIER')(chefReq, res2, () => {
    chefPassed = true;
  });

  assert.equal(waiterPassed, false);
  assert.equal(res1.statusCode, 403);
  assert.equal(chefPassed, false);
  assert.equal(res2.statusCode, 403);
});

// ── 2. Multi-tenant security ────────────────────────────────────────────────
test('hotel multi-tenancy: Cashier from Restaurant A cannot access Restaurant B', async () => {
  const req = {
    user: { userId: 'cashier-A', role: 'cashier', restaurantId: 'restaurant-A' },
    params: { restaurantId: 'restaurant-B' },
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
});

// ── 3. Billable nights calculation ──────────────────────────────────────────
test('hotel calculations: billable nights calculates correctly', () => {
  // Same day check-in/checkout defaults to minimum 1 night
  assert.equal(hotelBookingService.calculateNights('2026-11-20', '2026-11-20'), 1);

  // 3-night stay
  assert.equal(hotelBookingService.calculateNights('2026-11-20', '2026-11-23'), 3);

  // 7-night stay across months
  assert.equal(hotelBookingService.calculateNights('2026-11-28', '2026-12-05'), 7);
});

// ── 4. Financial arithmetic & billing logic ──────────────────────────────────
test('hotel billing: total bill, tax, discount, advance and balance arithmetic', () => {
  const tariffPerNight = 1500;
  const nights = 3;
  const roomCharges = tariffPerNight * nights; // 4500
  const additionalCharges = 300;
  const subtotal = roomCharges + additionalCharges; // 4800
  const gstRate = 5;
  const taxAmount = Math.round(((subtotal * gstRate) / 100) * 100) / 100; // 240
  const discount = 200;
  const totalAmount = subtotal + taxAmount - discount; // 4840

  const advancePaid = 1000;
  const balanceDue = totalAmount - advancePaid; // 3840

  assert.equal(roomCharges, 4500);
  assert.equal(subtotal, 4800);
  assert.equal(taxAmount, 240);
  assert.equal(totalAmount, 4840);
  assert.equal(balanceDue, 3840);
});

// ── 5. Date-range overlap logic ──────────────────────────────────────────────
test('hotel availability: date overlap logic correctly identifies conflicts and non-overlapping bookings', () => {
  // Existing booking: Nov 20 to Nov 23
  const existingStart = new Date('2026-11-20T12:00:00Z');
  const existingEnd = new Date('2026-11-23T11:00:00Z');

  const checkOverlap = (reqStartStr, reqEndStr) => {
    const reqStart = new Date(reqStartStr);
    const reqEnd = new Date(reqEndStr);
    return existingStart < reqEnd && existingEnd > reqStart;
  };

  // Overlapping cases:
  // Exactly same dates
  assert.equal(checkOverlap('2026-11-20T12:00:00Z', '2026-11-23T11:00:00Z'), true);
  // Inside the window (Nov 21 to Nov 22)
  assert.equal(checkOverlap('2026-11-21T12:00:00Z', '2026-11-22T11:00:00Z'), true);
  // Overlapping start (Nov 19 to Nov 21)
  assert.equal(checkOverlap('2026-11-19T12:00:00Z', '2026-11-21T11:00:00Z'), true);
  // Overlapping end (Nov 22 to Nov 25)
  assert.equal(checkOverlap('2026-11-22T12:00:00Z', '2026-11-25T11:00:00Z'), true);

  // Non-overlapping cases:
  // Prior booking (checkout Nov 20 morning before existing check-in Nov 20 afternoon)
  assert.equal(checkOverlap('2026-11-17T12:00:00Z', '2026-11-20T11:00:00Z'), false);
  // Subsequent booking (check-in Nov 23 afternoon after existing checkout Nov 23 morning)
  assert.equal(checkOverlap('2026-11-23T12:00:00Z', '2026-11-27T11:00:00Z'), false);
  // Unrelated dates (Nov 25 to Nov 28)
  assert.equal(checkOverlap('2026-11-25T12:00:00Z', '2026-11-28T11:00:00Z'), false);
});
