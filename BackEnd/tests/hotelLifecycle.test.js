const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const HotelRoomType = require('../models/HotelRoomType');
const HotelRoom = require('../models/HotelRoom');
const HotelBooking = require('../models/HotelBooking');
const HotelPayment = require('../models/HotelPayment');
const HotelInvoice = require('../models/HotelInvoice');
const Restaurant = require('../models/Restaurant');
const hotelRoomService = require('../services/hotelRoomService');
const hotelBookingService = require('../services/hotelBookingService');

test('Hotel Lifecycle & Billing E2E Service Integration Suite', async (t) => {
  // Ensure DB connection
  const connectDB = require('../config/database');
  await connectDB();

  const testRestaurantId = new mongoose.Types.ObjectId();
  const testUserId = new mongoose.Types.ObjectId();

  // 1. Create a dummy test restaurant with hotel enabled
  const restaurant = new Restaurant({
    _id: testRestaurantId,
    name: `Test Luxury Resort ${Date.now()}`,
    location: 'Goa Beach',
    phone: '9876543210',
    email: `hotel.${Date.now()}@test.com`,
    gstPercentage: 5,
    facilities: {
      hotelRoomManagement: true,
    },
  });
  await restaurant.save();

  let roomType1 = null;
  let room101 = null;
  let booking1 = null;
  let bookingB = null;

  await t.test('1. Ensure default room types seeding and category creation', async () => {
    await hotelRoomService.ensureDefaultRoomTypes(testRestaurantId);
    const types = await hotelRoomService.getRoomTypes(testRestaurantId);
    assert.ok(types.length >= 3, 'Should seed at least 3 default room types');
    roomType1 = types[0];
    assert.equal(roomType1.isActive, true);
  });

  await t.test('2. Room creation and duplicate room number rejection', async () => {
    room101 = await hotelRoomService.createRoom(testRestaurantId, {
      roomNumber: '101',
      roomTypeId: roomType1._id,
      floor: '1',
      baseTariff: 2000,
      capacity: 2,
      extraPersonCharge: 500,
      description: 'Deluxe sea-facing room',
    });
    assert.equal(room101.roomNumber, '101');
    assert.equal(room101.status, 'AVAILABLE');

    // Attempting duplicate room number in same property must throw
    await assert.rejects(async () => {
      await hotelRoomService.createRoom(testRestaurantId, {
        roomNumber: '101',
        roomTypeId: roomType1._id,
        baseTariff: 2000,
      });
    }, /already exists/);
  });

  await t.test('3. Non-overlapping reservations on the same room', async () => {
    // Booking A: Nov 20 to Nov 23
    booking1 = await hotelBookingService.createBooking(
      testRestaurantId,
      {
        roomId: room101._id,
        guest: {
          name: 'Rahul Sharma',
          phone: '9820011223',
          email: 'rahul@example.com',
          idType: 'Aadhaar',
          idNumber: '1234-5678-9012',
        },
        checkInDate: '2026-11-20',
        checkOutDate: '2026-11-23',
        adults: 2,
        agreedTariff: 2000,
        advancePayment: 1500,
        paymentMethod: 'UPI',
        isWalkIn: false,
      },
      { _id: testUserId, name: 'Cashier Alice' }
    );

    assert.equal(booking1.status, 'RESERVED');
    assert.equal(booking1.totalNights, 3);
    assert.equal(booking1.advancePayment, 1500);
    assert.equal(booking1.paidAmount, 1500);
    assert.ok(booking1.outstandingBalance > 0);

    // Booking B: Nov 25 to Nov 28 (non-overlapping) must succeed!
    bookingB = await hotelBookingService.createBooking(
      testRestaurantId,
      {
        roomId: room101._id,
        guest: {
          name: 'Pooja Verma',
          phone: '9820099887',
        },
        checkInDate: '2026-11-25',
        checkOutDate: '2026-11-28',
        adults: 1,
        agreedTariff: 2000,
        advancePayment: 0,
        isWalkIn: false,
      },
      { _id: testUserId, name: 'Cashier Alice' }
    );
    assert.equal(bookingB.status, 'RESERVED');
    assert.equal(bookingB.totalNights, 3);
  });

  await t.test('4. Double-booking prevention: overlapping reservation is strictly rejected', async () => {
    // Attempt Booking C: Nov 21 to Nov 24 (overlaps with Booking A which is Nov 20-23)
    await assert.rejects(async () => {
      await hotelBookingService.createBooking(
        testRestaurantId,
        {
          roomId: room101._id,
          guest: {
            name: 'Overlapping Guest',
            phone: '9811122233',
          },
          checkInDate: '2026-11-21',
          checkOutDate: '2026-11-24',
          adults: 1,
          agreedTariff: 2000,
        },
        { _id: testUserId }
      );
    }, /already reserved/);
  });

  await t.test('5. Check-in reserved guest: room status becomes OCCUPIED', async () => {
    const checkedIn = await hotelBookingService.checkInGuest(
      testRestaurantId,
      booking1._id,
      { additionalAdvance: 500, paymentMethod: 'CASH' },
      { _id: testUserId }
    );
    assert.equal(checkedIn.status, 'CHECKED_IN');
    assert.equal(checkedIn.paidAmount, 2000); // 1500 advance + 500 additional

    const roomAfterCheckin = await HotelRoom.findById(room101._id);
    assert.equal(roomAfterCheckin.status, 'OCCUPIED');
  });

  await t.test('6. Stay extension availability check: rejects extension if conflicting with Booking B', async () => {
    // Booking B starts on Nov 25. Attempting to extend Booking A to Nov 26 should be rejected!
    await assert.rejects(async () => {
      await hotelBookingService.extendStay(
        testRestaurantId,
        booking1._id,
        { newCheckOutDate: '2026-11-26' },
        { _id: testUserId }
      );
    }, /Cannot extend stay/);

    // Extending to Nov 24 (before Nov 25) should succeed
    const extended = await hotelBookingService.extendStay(
      testRestaurantId,
      booking1._id,
      { newCheckOutDate: '2026-11-24' },
      { _id: testUserId }
    );
    assert.equal(extended.totalNights, 4);
  });

  await t.test('7. Additional charge addition and financial recalculation', async () => {
    const updated = await hotelBookingService.addAdditionalCharge(
      testRestaurantId,
      booking1._id,
      { title: 'Airport Taxi Service', amount: 800 },
      { _id: testUserId }
    );
    assert.equal(updated.additionalCharges.length, 1);
    assert.equal(updated.additionalCharges[0].amount, 800);
  });

  await t.test('8. Checkout guest, settle bill, generate immutable invoice and move room to CLEANING', async () => {
    const result = await hotelBookingService.checkoutGuest(
      testRestaurantId,
      booking1._id,
      { paymentMethod: 'CASH', discount: 200 },
      { _id: testUserId }
    );

    assert.equal(result.booking.status, 'CHECKED_OUT');
    assert.equal(result.booking.outstandingBalance, 0);

    // Verify invoice generated
    assert.ok(result.invoice, 'Invoice must be generated');
    assert.ok(result.invoice.invoiceNumber.startsWith('INV-HTL-'));
    assert.equal(result.invoice.guestName, 'Rahul Sharma');
    assert.equal(result.invoice.paymentStatus, 'PAID');

    // Verify room status is CLEANING
    const roomAfterCheckout = await HotelRoom.findById(room101._id);
    assert.equal(roomAfterCheckout.status, 'CLEANING');
  });

  await t.test('9. Housekeeping workflow: cleaning room restored to AVAILABLE', async () => {
    const cleaned = await hotelRoomService.updateHousekeepingStatus(
      testRestaurantId,
      room101._id,
      'AVAILABLE'
    );
    assert.equal(cleaned.status, 'AVAILABLE');
  });

  await t.test('10. Historical preservation: historical bookings and invoices remain intact', async () => {
    const bookings = await HotelBooking.find({ restaurantId: testRestaurantId });
    assert.ok(bookings.length >= 2, 'All historical bookings preserved');

    const invoices = await HotelInvoice.find({ restaurantId: testRestaurantId });
    assert.equal(invoices.length, 1, 'Invoice record preserved');
  });

  await t.test('11. Room management: add room and remove room logic', async () => {
    // 11a. Add a new unused room
    const tempRoom = await hotelRoomService.createRoom(testRestaurantId, {
      roomNumber: '999',
      roomTypeId: roomType1._id,
      floor: '9',
      baseTariff: 2000,
      capacity: 3,
    });
    assert.equal(tempRoom.roomNumber, '999');

    // 11b. Remove room with zero bookings -> should be permanently deleted
    const deleteRes = await hotelRoomService.deleteRoom(testRestaurantId, tempRoom._id);
    assert.equal(deleteRes.action, 'DELETED');
    const checkedRoom = await HotelRoom.findById(tempRoom._id);
    assert.equal(checkedRoom, null);

    // 11c. Attempting to remove room101 while Booking B is active must throw error
    await assert.rejects(
      async () => {
        await hotelRoomService.deleteRoom(testRestaurantId, room101._id);
      },
      /Cannot remove Room 101/
    );

    // 11d. Cancel Booking B so no active bookings remain on room 101
    await hotelBookingService.cancelBooking(testRestaurantId, bookingB._id, 'Guest requested cancellation');

    // 11e. Remove room101 (has past bookings & invoice) -> should be deactivated to preserve historical data
    const archiveRes = await hotelRoomService.deleteRoom(testRestaurantId, room101._id);
    assert.equal(archiveRes.action, 'DEACTIVATED');
    assert.ok(archiveRes.historicalCount >= 1);
    const room101Archived = await HotelRoom.findById(room101._id);
    assert.equal(room101Archived.isActive, false);
  });

  // Cleanup test data
  await HotelBooking.deleteMany({ restaurantId: testRestaurantId });
  await HotelInvoice.deleteMany({ restaurantId: testRestaurantId });
  await HotelPayment.deleteMany({ restaurantId: testRestaurantId });
  await HotelRoom.deleteMany({ restaurantId: testRestaurantId });
  await HotelRoomType.deleteMany({ restaurantId: testRestaurantId });
  await Restaurant.findByIdAndDelete(testRestaurantId);
});
