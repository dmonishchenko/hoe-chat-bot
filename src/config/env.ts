import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';

// Load .env file
dotenvConfig();

const envSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'TELEGRAM_BOT_TOKEN is required'),
  TELEGRAM_CHAT_ID: z.string().min(1, 'TELEGRAM_CHAT_ID is required'),
  HOE_API_URL: z.string().url().default('https://hoe.com.ua/shutdown-events'),
  HOE_STREET_ID: z.coerce.number().int().positive().default(280782),
  HOE_HOUSE: z.string().default('33'),
  CRON_SCHEDULE: z.string().default('*/30 * * * *'),
  RETRY_ATTEMPTS: z.coerce.number().int().min(1).default(3),
  RETRY_DELAY_MS: z.coerce.number().int().min(100).default(5000),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).default(30000),
});

type EnvConfig = z.infer<typeof envSchema>;

function loadEnvConfig(): EnvConfig {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.errors
      .map((e) => `  - ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    throw new Error(`Environment validation failed:\n${errors}`);
  }

  return result.data;
}

export const config = loadEnvConfig();

export type { EnvConfig };
