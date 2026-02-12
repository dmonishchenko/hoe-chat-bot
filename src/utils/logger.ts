type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  readonly level: LogLevel;
  readonly message: string;
  readonly timestamp: string;
  readonly context?: Record<string, unknown>;
}

function formatLogEntry(entry: LogEntry): string {
  const contextStr = entry.context
    ? ` ${JSON.stringify(entry.context)}`
    : '';
  return `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}${contextStr}`;
}

function createLogEntry(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>
): LogEntry {
  return {
    level,
    message,
    timestamp: new Date().toISOString(),
    context,
  };
}

export const logger = {
  debug(message: string, context?: Record<string, unknown>): void {
    const entry = createLogEntry('debug', message, context);
    console.debug(formatLogEntry(entry));
  },

  info(message: string, context?: Record<string, unknown>): void {
    const entry = createLogEntry('info', message, context);
    console.info(formatLogEntry(entry));
  },

  warn(message: string, context?: Record<string, unknown>): void {
    const entry = createLogEntry('warn', message, context);
    console.warn(formatLogEntry(entry));
  },

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    const errorContext = error
      ? { ...context, errorName: error.name, errorMessage: error.message }
      : context;
    const entry = createLogEntry('error', message, errorContext);
    console.error(formatLogEntry(entry));
  },
} as const;
