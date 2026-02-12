import type { HoeApiRequest, HoeApiResponse, ShutdownEvent } from '../types/index.js';
import { config } from '../config/index.js';
import { logger, withRetry } from '../utils/index.js';
import { AppError } from '../types/index.js';

/**
 * Fetches shutdown events from HOE API
 */
export async function fetchShutdownEvents(
  request?: Partial<HoeApiRequest>
): Promise<ShutdownEvent[]> {
  const requestBody = new URLSearchParams({
    streetId: String(request?.streetId ?? config.HOE_STREET_ID),
    house: String(request?.house ?? config.HOE_HOUSE),
  });

  const fetchWithRetry = async (): Promise<ShutdownEvent[]> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(config.HOE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: requestBody,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new AppError(
          `HOE API returned status ${response.status}`,
          'HOE_API_ERROR',
          true
        );
      }

      const text = await response.text();

      // Check if response is HTML
      if (isHtmlResponse(text)) {
        // Check if it's "no shutdowns" alert
        if (isNoShutdownsAlert(text)) {
          logger.info('No scheduled shutdowns found for address', {
            streetId: requestBody.get('streetId'),
            house: requestBody.get('house'),
          });
          return [];
        }

        // Try to parse HTML table
        const events = parseHtmlTable(text);
        if (events.length > 0) {
          logger.info('Parsed shutdown events from HTML table', {
            count: events.length,
          });
          return events;
        }

        logger.warn('Could not parse HTML response', {
          responsePreview: text.substring(0, 200),
        });
        return [];
      }

      // Try to parse as JSON
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        logger.warn('Failed to parse HOE API response as JSON', {
          responsePreview: text.substring(0, 100),
        });
        return [];
      }

      return parseHoeResponse(data);
    } finally {
      clearTimeout(timeout);
    }
  };

  return withRetry(fetchWithRetry, {
    attempts: config.RETRY_ATTEMPTS,
    delayMs: config.RETRY_DELAY_MS,
    onRetry: (error, attempt) => {
      logger.warn('HOE API request failed, retrying', {
        attempt,
        error: error.message,
      });
    },
  });
}

/**
 * Checks if response is HTML
 */
function isHtmlResponse(text: string): boolean {
  const trimmed = text.trim();
  return (
    trimmed.startsWith('<') ||
    trimmed.startsWith('<!DOCTYPE') ||
    trimmed.includes('<div') ||
    trimmed.includes('<html') ||
    trimmed.includes('<table')
  );
}

/**
 * Checks if HTML response indicates no shutdown events
 */
function isNoShutdownsAlert(text: string): boolean {
  return (
    text.includes('alert-info') &&
    text.includes('відсутнє зареєстроване відключення')
  );
}

/**
 * Parses shutdown events from HTML table
 */
function parseHtmlTable(html: string): ShutdownEvent[] {
  const events: ShutdownEvent[] = [];

  // Check if table exists
  if (!html.includes('table-shutdowns')) {
    return events;
  }

  // Extract tbody content
  const tbodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
  if (!tbodyMatch) {
    return events;
  }

  // Extract all rows
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const tbody = tbodyMatch[1];
  let rowMatch: RegExpExecArray | null;

  let eventId = 1;
  while ((rowMatch = rowRegex.exec(tbody)) !== null) {
    const rowHtml = rowMatch[1];

    // Extract all td values
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells: string[] = [];
    let cellMatch: RegExpExecArray | null;

    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      // Strip HTML tags and trim
      const cellValue = cellMatch[1]
        .replace(/<[^>]*>/g, '')
        .trim();
      cells.push(cellValue);
    }

    // Expected order: Вид робіт, Тип відключення, Черга (ГПВ), Черга (ГАВ), Початок, Кінець
    if (cells.length >= 6) {
      events.push({
        id: eventId++,
        type: cells[0],
        shutdownType: cells[1],
        queueGpv: cells[2],
        queueGav: cells[3],
        dateStart: cells[4],
        dateEnd: cells[5],
        status: cells[1] === 'Аварійне' ? 'Аварійне' : 'Заплановано',
      });
    }
  }

  return events;
}

/**
 * Parses and validates HOE API response
 */
function parseHoeResponse(data: unknown): ShutdownEvent[] {
  // Handle array response directly
  if (Array.isArray(data)) {
    return data.map(normalizeEvent);
  }

  // Handle object response with data property
  if (data && typeof data === 'object') {
    const response = data as HoeApiResponse;

    if (response.data && Array.isArray(response.data)) {
      return response.data.map(normalizeEvent);
    }

    // Empty response is valid
    if (response.success === true && !response.data) {
      return [];
    }
  }

  logger.warn('Unexpected HOE API response format', { data });
  return [];
}

/**
 * Normalizes event data from API
 */
function normalizeEvent(raw: unknown): ShutdownEvent {
  const event = raw as Record<string, unknown>;

  return {
    id: String(event.id ?? event.eventId ?? ''),
    dateStart: String(event.dateStart ?? event.date_start ?? event.startDate ?? ''),
    dateEnd: String(event.dateEnd ?? event.date_end ?? event.endDate ?? ''),
    type: String(event.type ?? event.eventType ?? 'Невідомо'),
    shutdownType: String(event.shutdownType ?? event.shutdown_type ?? ''),
    queueGpv: String(event.queueGpv ?? event.queue_gpv ?? '-'),
    queueGav: String(event.queueGav ?? event.queue_gav ?? '-'),
    status: String(event.status ?? 'Заплановано'),
    comment: event.comment ? String(event.comment) : undefined,
    address: event.address ? String(event.address) : undefined,
  };
}
