import type { IConsumeResult, IRateLimitRule, IRateLimitStore, IRedisEvalClient } from '../types';

// High-throughput distributed store. Accepts any client exposing eval()
// (ioredis and node-redis both do) — this package depends on no Redis
// library. Refill-then-consume runs as one Lua script: Redis executes
// scripts atomically, so cross-instance races are impossible by
// construction. PEXPIRE gives free key expiry at full-refill time.

const CONSUME_LUA = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local now_ms = tonumber(ARGV[2])
local cost = tonumber(ARGV[3])
local refill_per_sec = tonumber(ARGV[4])
local ttl_ms = tonumber(ARGV[5])

local state = redis.call('HMGET', key, 'tokens', 'last_refill_ms')
local tokens = tonumber(state[1])
local last_refill = tonumber(state[2])

if tokens == nil then
  tokens = capacity
  last_refill = now_ms
end

local elapsed_sec = math.max(0, now_ms - last_refill) / 1000
local refilled = math.min(capacity, tokens + elapsed_sec * refill_per_sec)

local allowed = 0
local new_tokens = refilled
if refilled >= cost then
  allowed = 1
  new_tokens = refilled - cost
end

redis.call('HSET', key, 'tokens', new_tokens, 'last_refill_ms', now_ms)
redis.call('PEXPIRE', key, ttl_ms)

return { allowed, tostring(new_tokens) }
`;

export class RedisStore implements IRateLimitStore {
	constructor(
		private client: IRedisEvalClient,
		private keyPrefix = 'fonderie:rl:',
	) {}

	async consume(key: string, rule: IRateLimitRule): Promise<IConsumeResult> {
		const cost = rule.cost ?? 1;
		const ttlMs = Math.ceil((rule.capacity / rule.refillPerSec) * 1000);

		const raw = (await this.client.eval(
			CONSUME_LUA,
			1,
			this.keyPrefix + key,
			rule.capacity,
			Date.now(),
			cost,
			rule.refillPerSec,
			ttlMs,
		)) as [number, string];

		const allowed = raw[0] === 1;
		const tokens = Number(raw[1]);

		if (allowed) {
			return { allowed: true, remaining: Math.floor(tokens), retryAfterMs: 0 };
		}
		return {
			allowed: false,
			remaining: 0,
			retryAfterMs: Math.ceil(((cost - tokens) / rule.refillPerSec) * 1000),
		};
	}
}
