<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/risk — signatures

## @fonderie/risk

Subpath exports: `@fonderie/risk/migrations`

```ts
new RiskEngine(store: Queryable, opts: RiskEngineOptions): RiskEngine
  .assess(subject: string, ctx: RiskContext): Promise<RiskVerdict>
  .record(assessmentId: string, outcome: RiskOutcome): Promise<void>
  .purgeExpired(): Promise<void>

function scoreFromFired(rs: RuleSet, fired: Iterable<string>): { score: number; reasons: RiskReason[]; }

interface Queryable {
    query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
}

const DEFAULT_RULESETS: { [x: string]: RuleSet; }

const TRIAL_START_RULESET: RuleSet

function tierFor(score: number, tiers: { medium: number; high: number; }): RiskTier

function attributeFires(sig: AttributeSignal, attributes: Record<string, string | number | boolean> | undefined): boolean

function validateRuleset(rs: RuleSet): void

function hashValue(pepper: string, kind: string, value: string): string

function ipBucket(ip: string): string

function normalizeForKind(kind: string, value: string): string

function resolvePepper(supplied?: string | undefined): string

interface Identifier {
    kind: string;
    value: string;
}

interface RiskContext {
    actorId?: string | null;
    identifiers: Identifier[];
    attributes?: Record<string, string | number | boolean>;
}

type RiskTier = 'low' | 'medium' | 'high';

interface RiskReason {
    signal: string;
    weight: number;
}

interface RiskVerdict {
    score: number;
    tier: RiskTier;
    reasons: RiskReason[];
    assessmentId: string;
}

type RiskOutcome = 'allowed' | 'challenged' | 'blocked';

interface ReuseSignal {
    weight: number;
    reuse: string;
}

interface VelocitySignal {
    weight: number;
    velocity: string;
    window: string;
    over: number;
}

interface AttributeSignal {
    weight: number;
    attr: string;
    under?: number;
    over?: number;
    equals?: string | number | boolean;
}

type RuleSignal = ReuseSignal | VelocitySignal | AttributeSignal;

interface RuleSet {
    subject: string;
    signals: Record<string, RuleSignal>;
    tiers: {
        medium: number;
        high: number;
    };
}

interface RiskEngineOptions {
    rulesets: Record<string, RuleSet>;
    pepper?: string;
    pendingTtl?: string;
    recordTtl?: string;
}
```
