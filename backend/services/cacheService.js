/**
 * Multi-Level Caching Service (Redis + High-Performance In-Memory Fallback).
 * Provides sub-millisecond repeated data access, hit-rate telemetry,
 * and pattern-based cache invalidation.
 */
const Redis = require('ioredis');

class CacheService {
  constructor() {
    this.redis = null;
    this.memoryCache = new Map();
    this.ttlMap = new Map();
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0
    };
    this.isRedisReady = false;

    // Optional Redis initialization
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl || process.env.ENABLE_REDIS === 'true') {
      try {
        this.redis = new Redis(redisUrl || 'redis://127.0.0.1:6379', {
          maxRetriesPerRequest: 1,
          connectTimeout: 2000,
          lazyConnect: true,
          enableOfflineQueue: false
        });

        this.redis.connect()
          .then(() => {
            this.isRedisReady = true;
            console.log('✅ Redis Cache Connected & Active');
          })
          .catch((err) => {
            console.log(`ℹ️ Redis unavailable (${err.message}). Using high-performance in-memory cache.`);
            this.isRedisReady = false;
          });

        this.redis.on('error', () => {
          this.isRedisReady = false;
        });
      } catch (err) {
        this.isRedisReady = false;
      }
    } else {
      console.log('ℹ️ Running High-Performance In-Memory Cache Engine.');
    }
  }

  // Generate standardized cache key
  makeKey(namespace, ...parts) {
    const cleanParts = parts
      .filter(p => p !== null && p !== undefined && p !== '')
      .map(p => String(p).trim().replace(/\s+/g, '_'));
    return `${namespace}:${cleanParts.join(':')}`;
  }

  async get(key) {
    if (this.isRedisReady && this.redis) {
      try {
        const val = await this.redis.get(key);
        if (val) {
          this.metrics.hits++;
          return JSON.parse(val);
        }
      } catch (e) {
        // Fallback to memory
      }
    }

    // In-memory check
    const now = Date.now();
    const expiry = this.ttlMap.get(key);

    if (expiry && now > expiry) {
      this.memoryCache.delete(key);
      this.ttlMap.delete(key);
      this.metrics.misses++;
      return null;
    }

    if (this.memoryCache.has(key)) {
      this.metrics.hits++;
      return this.memoryCache.get(key);
    }

    this.metrics.misses++;
    return null;
  }

  async set(key, value, ttlSeconds = 300) {
    this.metrics.sets++;

    if (this.isRedisReady && this.redis) {
      try {
        await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
      } catch (e) {
        // Fallback to memory
      }
    }

    // In-memory store
    this.memoryCache.set(key, value);
    if (ttlSeconds > 0) {
      this.ttlMap.set(key, Date.now() + (ttlSeconds * 1000));
    }
    return true;
  }

  async del(key) {
    if (this.isRedisReady && this.redis) {
      try {
        await this.redis.del(key);
      } catch (e) {}
    }
    this.memoryCache.delete(key);
    this.ttlMap.delete(key);
  }

  async delPattern(pattern) {
    if (this.isRedisReady && this.redis) {
      try {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } catch (e) {}
    }

    // In-memory pattern delete
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    for (const k of this.memoryCache.keys()) {
      if (regex.test(k)) {
        this.memoryCache.delete(k);
        this.ttlMap.delete(k);
      }
    }
  }

  getMetrics() {
    const totalRequests = this.metrics.hits + this.metrics.misses;
    const hitRate = totalRequests > 0 ? ((this.metrics.hits / totalRequests) * 100).toFixed(1) + '%' : '0%';
    return {
      backend: this.isRedisReady ? 'Redis' : 'In-Memory High-Speed Cache',
      hits: this.metrics.hits,
      misses: this.metrics.misses,
      hitRate,
      activeKeysCount: this.memoryCache.size
    };
  }

  flush() {
    this.memoryCache.clear();
    this.ttlMap.clear();
  }
}

module.exports = new CacheService();

