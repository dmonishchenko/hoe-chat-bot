import type { ShutdownEvent, ShutdownCheckResult } from '../types/index.js';
import { fetchShutdownEvents } from '../providers/index.js';
import { createContentHash, logger } from '../utils/index.js';

/**
 * Formats a single shutdown event for display
 */
function formatEvent(event: ShutdownEvent, index: number): string {
  const lines: string[] = [];

  lines.push(`<b>${index + 1}. ${event.type}</b>`);
  lines.push(`📅 Початок: ${formatDateTime(event.dateStart)}`);
  lines.push(`📅 Кінець: ${formatDateTime(event.dateEnd)}`);

  if (event.status) {
    lines.push(`📋 Статус: ${event.status}`);
  }

  if (event.address) {
    lines.push(`📍 Адреса: ${event.address}`);
  }

  if (event.comment) {
    lines.push(`💬 Коментар: ${event.comment}`);
  }

  return lines.join('\n');
}

/**
 * Formats date-time string for display
 */
function formatDateTime(dateStr: string): string {
  if (!dateStr) return 'Невідомо';

  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return dateStr; // Return original if can't parse
    }

    return date.toLocaleString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Formats all shutdown events into a readable message
 */
function formatShutdownMessage(events: readonly ShutdownEvent[]): string {
  if (events.length === 0) {
    return '✅ Електрохарчування є';
  }

  const header = `⚡ <b>Заплановані відключення (${events.length})</b>\n`;
  const eventMessages = events.map((event, i) => formatEvent(event, i));

  return header + '\n' + eventMessages.join('\n\n');
}

/**
 * Checks for shutdown events and prepares result
 */
export async function checkShutdownEvents(): Promise<ShutdownCheckResult> {
  logger.info('Checking for shutdown events...');

  const events = await fetchShutdownEvents();

  const formattedMessage = formatShutdownMessage(events);
  const contentHash = createContentHash(formattedMessage);

  logger.info('Shutdown check completed', {
    eventsCount: events.length,
    hasEvents: events.length > 0,
  });

  return {
    hasEvents: events.length > 0,
    events,
    formattedMessage,
    contentHash,
  };
}

/**
 * Gets event IDs for comparison
 */
export function getEventIds(events: readonly ShutdownEvent[]): readonly string[] {
  return events.map((e) => String(e.id));
}
