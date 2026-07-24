/**
 * Upstash Redis client singleton for serverless environments.
 * Reads UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN from environment.
 */

import { Redis } from '@upstash/redis';

let redis: Redis | null = null;

/**
 * Returns a shared Upstash Redis client instance.
 * Creates the client on first call (lazy initialization).
 */
export function getRedisClient(): Redis {
  if (!redis) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      throw new Error(
        'Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN environment variables. ' +
        'Please configure Upstash Redis in your Vercel project settings.'
      );
    }

    redis = new Redis({ url, token });
  }

  return redis;
}
