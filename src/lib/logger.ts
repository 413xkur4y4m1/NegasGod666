type LogLevel = 'info' | 'warning' | 'error' | 'debug';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  type: 'admin' | 'student' | 'system'; // Added 'system' type for general actions
  action: string;
  details: any;
  userId?: string;
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000;

  private createLogEntry(
    level: LogLevel,
    type: 'admin' | 'student' | 'system',
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

  /**
   * Logs an interaction with a chatbot.
   */
  public chatbot(
    type: 'admin' | 'student',
    action: string, // This is the chatbot's intent
    details: any,
    level: LogLevel = 'info',
  ) {
    const entry = this.createLogEntry(level, type, `chatbot:${action}`, details, details.matricula);
    this.addLog(entry);
  }

  /**
   * Logs a system action, like a database write.
   */
  public action(
    type: 'admin' | 'student' | 'system',
    action: string,
    details: any,
    level: LogLevel = 'info'
  ) {
    const entry = this.createLogEntry(level, type, `action:${action}`, details, details.matricula);
    this.addLog(entry);
  }

  /**
   * Logs an error.
   */
  public error(
    type: 'admin' | 'student' | 'system',
    action: string,
    error: Error | unknown,
    details: any = {}
  ) {
    const errorDetails = error instanceof Error 
      ? { ...details, message: error.message, stack: error.stack }
      : { ...details, error };
    
    const entry = this.createLogEntry('error', type, `error:${action}`, errorDetails, details.matricula);
    this.addLog(entry);
  }

  public getLogs(
    options?: {
      level?: LogLevel;
      type?: 'admin' | 'student' | 'system';
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