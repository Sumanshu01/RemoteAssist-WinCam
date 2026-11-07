import { Request, Response, NextFunction } from "express";

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

export function createRateLimiter(options: { maxRequests: number; windowMs: number }) {
  const store = new Map<string, RateLimitRecord>();

  // Cleanup expired entries periodically
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      if (record.resetAt <= now) {
        store.delete(key);
      }
    }
  }, 60000);

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || "unknown_ip";
    const now = Date.now();
    const record = store.get(ip);

    if (!record || record.resetAt <= now) {
      store.set(ip, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }

    if (record.count >= options.maxRequests) {
      const retryAfterSeconds = Math.ceil((record.resetAt - now) / 1000);
      res.setHeader("Retry-After", retryAfterSeconds);
      res.status(429).json({
        error: "Too Many Requests",
        message: `Rate limit exceeded. Please retry in ${retryAfterSeconds} seconds.`
      });
      return;
    }

    record.count++;
    next();
  };
}
