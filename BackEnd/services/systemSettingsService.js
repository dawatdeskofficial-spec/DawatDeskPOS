const SystemSettings = require('../models/SystemSettings');
const logger = require('../utils/logger');

class SystemSettingsService {
  async getSettings() {
    try {
      let settings = await SystemSettings.findOne();
      if (!settings) {
        settings = await SystemSettings.create({});
      }
      return settings;
    } catch (error) {
      logger.error(`Get settings error: ${error.message}`);
      throw error;
    }
  }

  async updateSettings(updateData) {
    try {
      let settings = await SystemSettings.findOne();
      if (!settings) {
        settings = new SystemSettings(updateData);
      } else {
        Object.assign(settings, updateData);
      }
      await settings.save();
      logger.info('System settings updated');
      return settings;
    } catch (error) {
      logger.error(`Update settings error: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new SystemSettingsService();
