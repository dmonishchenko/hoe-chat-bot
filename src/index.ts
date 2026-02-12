import cron from 'node-cron';
import { config } from './config/index.js';
import { checkAndNotify, forceNotify } from './services/index.js';
import { initializeTelegramBot, closeTelegramBot } from './providers/index.js';
import { logger } from './utils/index.js';

let scheduledTask: cron.ScheduledTask | null = null;

/**
 * Starts the scheduler
 */
function startScheduler(): void {
  logger.info('Starting scheduler', {
    schedule: config.CRON_SCHEDULE,
  });

  scheduledTask = cron.schedule(config.CRON_SCHEDULE, async () => {
    logger.info('Scheduled check triggered');
    try {
      await checkAndNotify();
    } catch (error) {
      logger.error('Scheduled check failed', error as Error);
    }
  });

  logger.info('Scheduler started successfully');
}

/**
 * Stops the scheduler
 */
function stopScheduler(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    logger.info('Scheduler stopped');
  }
}

/**
 * Graceful shutdown handler
 */
async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, shutting down gracefully...`);

  stopScheduler();
  await closeTelegramBot();

  logger.info('Shutdown complete');
  process.exit(0);
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  logger.info('HOE Shutdown Monitor Bot starting...');
  logger.info('Configuration loaded', {
    apiUrl: config.HOE_API_URL,
    streetId: config.HOE_STREET_ID,
    house: config.HOE_HOUSE,
    schedule: config.CRON_SCHEDULE,
  });

  // Register shutdown handlers
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', reason as Error);
  });

  // Initial check on startup
  const runInitialCheck = process.argv.includes('--check-now');
  if (runInitialCheck) {
    logger.info('Running initial check...');
    try {
      await forceNotify();
    } catch (error) {
      logger.error('Initial check failed', error as Error);
    }
  }

  // Initialize Telegram bot with polling for user commands
  await initializeTelegramBot();

  // Start the scheduler
  startScheduler();

  logger.info('Bot is running. Press Ctrl+C to stop.');
}

main().catch((error) => {
  logger.error('Failed to start bot', error);
  process.exit(1);
});
