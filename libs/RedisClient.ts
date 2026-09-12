import Redis from "ioredis";

const globalForRedis = globalThis as unknown as { redisClient?: Redis };

const redisClient = globalForRedis.redisClient ?? new Redis(process.env.REDIS_URL!);

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redisClient = redisClient;
}

export default redisClient;
