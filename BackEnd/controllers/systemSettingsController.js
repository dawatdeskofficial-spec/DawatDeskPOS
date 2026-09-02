const systemSettingsService = require('../services/systemSettingsService');
const { sendSuccess, sendError } = require('../utils/responseHandler');
const logger = require('../utils/logger');

class SystemSettingsController {
  async getSettings(req, res) {
    try {
      const settings = await systemSettingsService.getSettings();
      return sendSuccess(res, 'System settings fetched successfully', settings);
    } catch (error) {
      logger.error(`Get system settings error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  async updateSettings(req, res) {
    try {
      const settings = await systemSettingsService.updateSettings(req.body);
      return sendSuccess(res, 'System settings updated successfully', settings);
    } catch (error) {
      logger.error(`Update system settings error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  async getLogs(req, res) {
    try {
      const fs = require('fs');
      const path = require('path');
      const logType = req.query.type || 'info';
      const limit = parseInt(req.query.limit) || 100;

      const logsDir = path.join(__dirname, '..', 'logs');
      const logFile = path.join(logsDir, logType === 'error' ? 'error.log' : 'app.log');

      if (!fs.existsSync(logFile)) {
        return sendSuccess(res, 'Logs fetched successfully', { logs: [] });
      }

      const content = fs.readFileSync(logFile, 'utf8');
      const lines = content.trim().split('\n');
      // If content is completely empty
      if (lines.length === 1 && lines[0] === '') {
        return sendSuccess(res, 'Logs fetched successfully', { logs: [] });
      }
      const slicedLines = lines.slice(-limit).reverse();

      return sendSuccess(res, 'Logs fetched successfully', { logs: slicedLines });
    } catch (error) {
      logger.error(`Get logs error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }
}

module.exports = new SystemSettingsController();
