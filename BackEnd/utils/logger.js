const fs = require('fs');
const path = require('path');

const logsDir = path.join(__dirname, '..', 'logs');

// Create logs directory if it doesn't exist (fail gracefully on read-only systems)
try {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
} catch (error) {
  // Ignored in serverless environments
}

const logFile = path.join(logsDir, 'app.log');
const errorLogFile = path.join(logsDir, 'error.log');

const timestamp = () => new Date().toISOString();

const appendLog = (file, message) => {
  try {
    fs.appendFileSync(file, message);
  } catch (error) {
    // Ignore file write errors on serverless
  }
};

const logger = {
  info: (message) => {
    const log = `[${timestamp()}] INFO: ${message}\n`;
    console.log(log);
    appendLog(logFile, log);
  },

  error: (message) => {
    const log = `[${timestamp()}] ERROR: ${message}\n`;
    console.error(log);
    appendLog(errorLogFile, log);
  },

  warn: (message) => {
    const log = `[${timestamp()}] WARN: ${message}\n`;
    console.warn(log);
    appendLog(logFile, log);
  },

  debug: (message) => {
    if (process.env.NODE_ENV === 'development') {
      const log = `[${timestamp()}] DEBUG: ${message}\n`;
      console.log(log);
      appendLog(logFile, log);
    }
  },
};

module.exports = logger;
