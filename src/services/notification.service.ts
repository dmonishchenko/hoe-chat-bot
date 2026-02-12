import { sendMessageToAllSubscribers, sendErrorNotification } from '../providers/index.js';
import { getLastMessageHash, updateLastMessageHash } from '../repositories/index.js';
import { checkShutdownEvents } from './shutdown.service.js';
import { hashesEqual, logger } from '../utils/index.js';

/**
 * Checks for updates and sends notification if content changed
 */
export async function checkAndNotify(): Promise<void> {
  try {
    const result = await checkShutdownEvents();
    const lastHash = await getLastMessageHash();

    // Check if message content has changed
    if (lastHash && hashesEqual(lastHash, result.contentHash)) {
      logger.info('No changes detected, skipping notification');
      return;
    }

    // Send the notification to all subscribers
    await sendMessageToAllSubscribers(result.formattedMessage);

    // Update the stored hash
    await updateLastMessageHash(result.contentHash);

    logger.info('Notification sent successfully', {
      hasEvents: result.hasEvents,
      eventsCount: result.events.length,
    });
  } catch (error) {
    logger.error('Failed to check and notify', error as Error);
    await sendErrorNotification(error as Error);
    throw error;
  }
}

/**
 * Forces a notification regardless of changes
 */
export async function forceNotify(): Promise<void> {
  try {
    const result = await checkShutdownEvents();
    await sendMessageToAllSubscribers(result.formattedMessage);
    await updateLastMessageHash(result.contentHash);

    logger.info('Force notification sent', {
      hasEvents: result.hasEvents,
      eventsCount: result.events.length,
    });
  } catch (error) {
    logger.error('Failed to force notify', error as Error);
    await sendErrorNotification(error as Error);
    throw error;
  }
}
