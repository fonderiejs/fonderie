# @fonderie-js/logger

Structured logging: pluggable transports, child loggers with inherited
context, and a request-logging middleware — the brick that makes the other
bricks observable.

## Install

```sh
npm install @fonderie-js/logger
```

## Use

```ts
import { FonderieApp, defineConfig } from '@fonderie-js/core';
import { LoggerModule } from '@fonderie-js/logger';

const app = await new FonderieApp(defineConfig({}))
  .register(new LoggerModule())
  .boot();
```

```ts
import { Logger, ConsoleTransport, FileTransport } from '@fonderie-js/logger';

const log = new Logger({ transports: [new ConsoleTransport()] });
```

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie-js/core`](https://github.com/fonderie-js/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** how you see inside. Structured, transport-pluggable logging for
everything the other bricks do.

Browse the whole set at
[fonderie-js/sdk](https://github.com/fonderie-js/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
