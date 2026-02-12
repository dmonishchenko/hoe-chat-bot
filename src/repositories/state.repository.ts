import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { logger } from '../utils/index.js';

interface StateData {
  readonly lastMessageHash: string | null;
  readonly lastCheckTime: string | null;
  readonly lastEventIds: readonly string[];
  readonly subscribers: readonly number[];
}

const DEFAULT_STATE: StateData = {
  lastMessageHash: null,
  lastCheckTime: null,
  lastEventIds: [],
  subscribers: [],
};

const STATE_FILE_PATH = './.state/state.json';

/**
 * Loads state from file
 */
export async function loadState(): Promise<StateData> {
  try {
    if (!existsSync(STATE_FILE_PATH)) {
      return DEFAULT_STATE;
    }

    const content = await readFile(STATE_FILE_PATH, 'utf-8');
    const data = JSON.parse(content) as StateData;

    return {
      lastMessageHash: data.lastMessageHash ?? null,
      lastCheckTime: data.lastCheckTime ?? null,
      lastEventIds: data.lastEventIds ?? [],
      subscribers: data.subscribers ?? [],
    };
  } catch (error) {
    logger.warn('Failed to load state, using defaults', {
      error: (error as Error).message,
    });
    return DEFAULT_STATE;
  }
}

/**
 * Saves state to file
 */
export async function saveState(state: StateData): Promise<void> {
  try {
    const dir = dirname(STATE_FILE_PATH);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    await writeFile(STATE_FILE_PATH, JSON.stringify(state, null, 2), 'utf-8');
    logger.debug('State saved successfully');
  } catch (error) {
    logger.error('Failed to save state', error as Error);
    throw error;
  }
}

/**
 * Gets the last message hash
 */
export async function getLastMessageHash(): Promise<string | null> {
  const state = await loadState();
  return state.lastMessageHash;
}

/**
 * Updates the last message hash
 */
export async function updateLastMessageHash(hash: string): Promise<void> {
  const state = await loadState();
  await saveState({
    ...state,
    lastMessageHash: hash,
    lastCheckTime: new Date().toISOString(),
  });
}

/**
 * Updates the last event IDs
 */
export async function updateLastEventIds(ids: readonly string[]): Promise<void> {
  const state = await loadState();
  await saveState({
    ...state,
    lastEventIds: ids,
    lastCheckTime: new Date().toISOString(),
  });
}

/**
 * Gets list of subscriber chat IDs
 */
export async function getSubscribers(): Promise<readonly number[]> {
  const state = await loadState();
  return state.subscribers;
}

/**
 * Adds a subscriber chat ID
 */
export async function addSubscriber(chatId: number): Promise<boolean> {
  const state = await loadState();
  
  if (state.subscribers.includes(chatId)) {
    return false; // Already subscribed
  }
  
  await saveState({
    ...state,
    subscribers: [...state.subscribers, chatId],
  });
  
  logger.info('Subscriber added', { chatId });
  return true;
}

/**
 * Removes a subscriber chat ID
 */
export async function removeSubscriber(chatId: number): Promise<boolean> {
  const state = await loadState();
  
  if (!state.subscribers.includes(chatId)) {
    return false; // Not subscribed
  }
  
  await saveState({
    ...state,
    subscribers: state.subscribers.filter((id) => id !== chatId),
  });
  
  logger.info('Subscriber removed', { chatId });
  return true;
}
