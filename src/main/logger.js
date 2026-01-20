const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class Logger {
  constructor() {
    this.logDir = path.join(app.getPath('userData'), 'logs');
    this.ensureLogDir();
    this.logFile = path.join(this.logDir, `idec-${new Date().toISOString().split('T')[0]}.log`);
  }

  ensureLogDir() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  getTimestamp() {
    return new Date().toISOString();
  }

  write(level, message, data = null) {
    const timestamp = this.getTimestamp();
    let logMessage = `[${timestamp}] [${level}] ${message}`;
    if (data) {
      logMessage += ` ${JSON.stringify(data)}`;
    }
    logMessage += '\n';

    try {
      fs.appendFileSync(this.logFile, logMessage);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }

    // Also log to console
    console.log(logMessage.trim());
  }

  info(message, data) {
    this.write('INFO', message, data);
  }

  error(message, data) {
    this.write('ERROR', message, data);
  }

  warn(message, data) {
    this.write('WARN', message, data);
  }

  debug(message, data) {
    this.write('DEBUG', message, data);
  }

  getLogPath() {
    return this.logFile;
  }

  clearOldLogs(daysToKeep = 7) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const files = fs.readdirSync(this.logDir);
      files.forEach(file => {
        if (file.startsWith('idec-') && file.endsWith('.log')) {
          const filePath = path.join(this.logDir, file);
          const stats = fs.statSync(filePath);
          if (stats.mtime < cutoffDate) {
            fs.unlinkSync(filePath);
            console.log(`[Logger] Deleted old log: ${file}`);
          }
        }
      });
    } catch (error) {
      console.error('Failed to clear old logs:', error);
    }
  }
}

module.exports = new Logger();
