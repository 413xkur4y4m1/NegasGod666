type LogLevel = 'info' | 'warning' | 'error' | 'debug';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  type: 'admin' | 'student';
  action: string;
  details: any;
  userId?: string;
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000;

  private createLogEntry(
    level: LogLevel,
    type: 'admin' | 'student',
    action: string,
    details: any,
    userId?: string
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      type,
      action,
      details,
      userId
    };
  }

  private addLog(entry: LogEntry) {
    this.logs.unshift(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }
    
    // También enviamos a console para desarrollo
    const logMessage = `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.type}] ${entry.action}`;
    switch (entry.level) {
      case 'error':
        console.error(logMessage, entry.details);
        break;
      case 'warning':
        console.warn(logMessage, entry.details);
        break;
      case 'debug':
        console.debug(logMessage, entry.details);
        break;
      default:
        console.log(logMessage, entry.details);
    }
  }

  public chatbot(
    type: 'admin' | 'student',
    action: string,
    details: any,
    level: LogLevel = 'info',
    userId?: string
  ) {
    const entry = this.createLogEntry(level, type, action, details, userId);
    this.addLog(entry);
  }

  public error(
    type: 'admin' | 'student',
    action: string,
    error: Error | unknown,
    userId?: string
  ) {
    const details = error instanceof Error 
      ? { message: error.message, stack: error.stack }
      : { error };
    
    const entry = this.createLogEntry('error', type, action, details, userId);
    this.addLog(entry);
  }

  public getLogs(
    options?: {
      level?: LogLevel;
      type?: 'admin' | 'student';
      userId?: string;
      limit?: number;
    }
  ): LogEntry[] {
    let filtered = this.logs;

    if (options?.level) {
      filtered = filtered.filter(log => log.level === options.level);
    }

    if (options?.type) {
      filtered = filtered.filter(log => log.type === options.type);
    }

    if (options?.userId) {
      filtered = filtered.filter(log => log.userId === options.userId);
    }

    return filtered.slice(0, options?.limit || filtered.length);
  }
}

export const logger = new Logger();