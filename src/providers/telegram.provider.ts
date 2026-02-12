import TelegramBot from 'node-telegram-bot-api';
import { config } from '../config/index.js';
import { addSubscriber, removeSubscriber, getSubscribers } from '../repositories/index.js';
import { logger, withRetry } from '../utils/index.js';

let botInstance: TelegramBot | null = null;
let pollingEnabled = false;

/**
 * Gets or creates Telegram bot instance
 */
export function getTelegramBot(): TelegramBot {
  if (!botInstance) {
    botInstance = new TelegramBot(config.TELEGRAM_BOT_TOKEN, {
      polling: false,
    });
    logger.info('Telegram bot instance created');
  }
  return botInstance;
}

/**
 * Initializes bot with polling and command handlers
 */
export async function initializeTelegramBot(): Promise<void> {
  const bot = getTelegramBot();

  if (pollingEnabled) {
    return;
  }

  // Start polling
  await bot.startPolling();
  pollingEnabled = true;
  logger.info('Telegram bot polling started');

  // Handle /start command
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from?.username ?? msg.from?.first_name ?? 'Unknown';

    try {
      const added = await addSubscriber(chatId);
      
      if (added) {
        await bot.sendMessage(
          chatId,
          '✅ Вы подписались на уведомления об отключениях электроэнергии.\n\n' +
          'Используйте /stop чтобы отписаться.',
          { parse_mode: 'HTML' }
        );
        logger.info('User subscribed', { chatId, username });
      } else {
        await bot.sendMessage(
          chatId,
          'ℹ️ Вы уже подписаны на уведомления.\n\n' +
          'Используйте /stop чтобы отписаться.',
          { parse_mode: 'HTML' }
        );
      }
    } catch (error) {
      logger.error('Failed to handle /start command', error as Error, { chatId });
    }
  });

  // Handle /stop command
  bot.onText(/\/stop/, async (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from?.username ?? msg.from?.first_name ?? 'Unknown';

    try {
      const removed = await removeSubscriber(chatId);
      
      if (removed) {
        await bot.sendMessage(
          chatId,
          '🔕 Вы отписались от уведомлений.\n\n' +
          'Используйте /start чтобы подписаться снова.',
          { parse_mode: 'HTML' }
        );
        logger.info('User unsubscribed', { chatId, username });
      } else {
        await bot.sendMessage(
          chatId,
          'ℹ️ Вы не были подписаны на уведомления.\n\n' +
          'Используйте /start чтобы подписаться.',
          { parse_mode: 'HTML' }
        );
      }
    } catch (error) {
      logger.error('Failed to handle /stop command', error as Error, { chatId });
    }
  });

  // Handle /status command
  bot.onText(/\/status/, async (msg) => {
    const chatId = msg.chat.id;

    try {
      const subscribers = await getSubscribers();
      const isSubscribed = subscribers.includes(chatId);
      
      await bot.sendMessage(
        chatId,
        isSubscribed
          ? '✅ Вы подписаны на уведомления.'
          : '❌ Вы не подписаны на уведомления. Используйте /start',
        { parse_mode: 'HTML' }
      );
    } catch (error) {
      logger.error('Failed to handle /status command', error as Error, { chatId });
    }
  });

  logger.info('Telegram bot command handlers registered');
}

/**
 * Sends a message to the configured Telegram chat
 */
export async function sendTelegramMessage(
  message: string,
  chatId?: string | number
): Promise<TelegramBot.Message> {
  const bot = getTelegramBot();
  const targetChatId = chatId ?? config.TELEGRAM_CHAT_ID;

  const sendWithRetry = async (): Promise<TelegramBot.Message> => {
    try {
      const result = await bot.sendMessage(targetChatId, message, {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      });

      logger.info('Telegram message sent successfully', {
        chatId: targetChatId,
        messageId: result.message_id,
      });

      return result;
    } catch (error) {
      logger.error('Failed to send Telegram message', error as Error, {
        chatId: targetChatId,
      });
      throw error;
    }
  };

  return withRetry(sendWithRetry, {
    attempts: config.RETRY_ATTEMPTS,
    delayMs: config.RETRY_DELAY_MS,
  });
}

/**
 * Sends an error notification to Telegram
 */
export async function sendErrorNotification(error: Error): Promise<void> {
  const message = `⚠️ <b>Ошибка получения данных с hoe.com.ua</b>\n\n${error.message}`;

  try {
    await sendTelegramMessage(message);
  } catch (sendError) {
    logger.error('Failed to send error notification', sendError as Error);
  }
}

/**
 * Sends a message to all subscribers
 */
export async function sendMessageToAllSubscribers(message: string): Promise<void> {
  const subscribers = await getSubscribers();
  
  // Also send to default chat if configured and not in subscribers list
  const defaultChatId = parseInt(config.TELEGRAM_CHAT_ID, 10);
  const allRecipients = subscribers.includes(defaultChatId)
    ? subscribers
    : [...subscribers, defaultChatId];

  if (allRecipients.length === 0) {
    logger.warn('No subscribers to send message to');
    return;
  }

  logger.info('Sending message to all subscribers', {
    subscribersCount: allRecipients.length,
  });

  const results = await Promise.allSettled(
    allRecipients.map((chatId) => sendTelegramMessage(message, chatId))
  );

  const successful = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  logger.info('Message broadcast completed', {
    successful,
    failed,
    total: allRecipients.length,
  });

  if (failed > 0) {
    const errors = results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map((r) => r.reason);
    logger.warn('Some messages failed to send', { errors });
  }
}

/**
 * Gracefully closes the bot connection
 */
export async function closeTelegramBot(): Promise<void> {
  if (botInstance) {
    if (pollingEnabled) {
      await botInstance.stopPolling();
      pollingEnabled = false;
      logger.info('Telegram bot polling stopped');
    }
    await botInstance.close();
    botInstance = null;
    logger.info('Telegram bot connection closed');
  }
}
