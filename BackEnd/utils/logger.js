const fs = require('fs');
const path = require('path');

const logsDir = path.join(__dirname, '..', 'logs');

// Create logs directory if it doesn't exist
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFile = path.join(logsDir, 'app.log');
const errorLogFile = path.join(logsDir, 'error.log');

const timestamp = () => new Date().toISOString();

const logger = {
  info: (message) => {
    const log = `[${timestamp()}] INFO: ${message}\n`;
    console.log(log);
    fs.appendFileSync(logFile, log);
  },

  error: (message) => {
    const log = `[${timestamp()}] ERROR: ${message}\n`;
    console.error(log);
    fs.appendFileSync(errorLogFile, log);
  },

  warn: (message) => {
    const log = `[${timestamp()}] WARN: ${message}\n`;
    console.warn(log);
    fs.appendFileSync(logFile, log);
  },

  debug: (message) => {
    if (process.env.NODE_ENV === 'development') {
      const log = `[${timestamp()}] DEBUG: ${message}\n`;
      console.log(log);
      fs.appendFileSync(logFile, log);
    }
  },
};

module.exports = logger;
