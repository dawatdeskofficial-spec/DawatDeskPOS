const WaitingQueue = require('../models/WaitingQueue');
const Restaurant = require('../models/Restaurant');
const Order = require('../models/Order');
const { sendSuccess, sendError } = require('../utils/responseHandler');
const logger = require('../utils/logger');

class WaitingQueueController {
  // Add customer to waiting queue
  async addToQueue(req, res) {
    try {
      const data = { ...(req.body || {}) };

      // Derive restaurantId if not provided
      if (!data.restaurantId && req.user) {
        const r = req.user.restaurantId;
        data.restaurantId = typeof r === 'string' ? r : (r && (r._id || r.id));
      }

      if (!data.restaurantId) {
        return sendError(res, 'Restaurant ID is required', 400);
      }

      const restaurant = await Restaurant.findById(data.restaurantId);
      if (!restaurant) {
        return sendError(res, 'Restaurant not found', 404);
      }

      if (req.user) {
        data.createdBy = req.user._id || req.user.id;
      }

      if (!data.queueNumber) {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const lastEntry = await WaitingQueue.findOne({
          restaurantId: data.restaurantId,
          createdAt: { $gte: startOfDay },
        }).sort({ queueNumber: -1 });

        data.queueNumber = lastEntry && lastEntry.queueNumber ? lastEntry.queueNumber + 1 : 1;
      }

      const queueEntry = new WaitingQueue(data);
      await queueEntry.save();

      logger.info(`Waiting queue entry created: ${queueEntry._id} for ${data.customerName}`);
      return sendSuccess(res, 'Customer added to waiting queue', queueEntry, 201);
    } catch (error) {
      logger.error(`Add to waiting queue error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  // Get waiting queue by restaurant
  async getQueueByRestaurant(req, res) {
    try {
      const { restaurantId } = req.params;
      const { status, all } = req.query;

      const query = { restaurantId };
      if (status) {
        query.status = status;
      } else if (!all || all === 'false') {
        // By default return active waiting list and seated table allocations
        query.status = { $in: ['WAITING', 'CALLED', 'SEATED'] };
      }

      const queue = await WaitingQueue.find(query)
        .populate('createdBy', 'name role')
        .sort({ createdAt: 1 });

      return sendSuccess(res, 'Waiting queue fetched successfully', queue);
    } catch (error) {
      logger.error(`Get waiting queue error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  // Update queue entry
  async updateQueueEntry(req, res) {
    try {
      const { id } = req.params;
      const updates = { ...(req.body || {}) };

      // Handle status timestamps
      if (updates.status === 'CALLED' && !updates.calledAt) {
        updates.calledAt = new Date();
      } else if (updates.status === 'SEATED' && !updates.seatedAt) {
        updates.seatedAt = new Date();
      } else if (updates.status === 'CANCELLED' && !updates.cancelledAt) {
        updates.cancelledAt = new Date();
      }

      const entry = await WaitingQueue.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
      if (!entry) {
        return sendError(res, 'Queue entry not found', 404);
      }

      logger.info(`Waiting queue entry updated: ${id}`);
      return sendSuccess(res, 'Queue entry updated successfully', entry);
    } catch (error) {
      logger.error(`Update queue entry error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  // Seat customer at a specific table
  async seatCustomer(req, res) {
    try {
      const { id } = req.params;
      const { tableNumber } = req.body;

      if (!tableNumber || parseInt(tableNumber, 10) < 1) {
        return sendError(res, 'Valid table number is required', 400);
      }

      const parsedTable = parseInt(tableNumber, 10);
      const entry = await WaitingQueue.findById(id);
      if (!entry) {
        return sendError(res, 'Queue entry not found', 404);
      }

      const restaurant = await Restaurant.findById(entry.restaurantId);
      if (restaurant && parsedTable > restaurant.maxTables) {
        return sendError(res, `Table number cannot exceed ${restaurant.maxTables}`, 400);
      }

      entry.status = 'SEATED';
      entry.assignedTable = parsedTable;
      entry.seatedAt = new Date();
      await entry.save();

      logger.info(`Customer ${entry.customerName} seated at table ${parsedTable}`);
      return sendSuccess(res, `Customer seated at Table ${parsedTable}`, entry);
    } catch (error) {
      logger.error(`Seat customer error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  // Delete queue entry
  async deleteQueueEntry(req, res) {
    try {
      const { id } = req.params;
      const entry = await WaitingQueue.findByIdAndDelete(id);
      if (!entry) {
        return sendError(res, 'Queue entry not found', 404);
      }

      logger.info(`Waiting queue entry deleted: ${id}`);
      return sendSuccess(res, 'Queue entry removed successfully');
    } catch (error) {
      logger.error(`Delete queue entry error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }
}

module.exports = new WaitingQueueController();
