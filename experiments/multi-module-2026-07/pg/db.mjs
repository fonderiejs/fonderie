// Disposable per-sequence Postgres cluster.
// usage: node db.mjs start <dataDir> <port> | node db.mjs stop <dataDir> <port>
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';

const [, , cmd, dataDir, portArg] = process.argv;
if (!cmd || !dataDir || !portArg) {
  console.error('usage: db.mjs <start|stop> <dataDir> <port>');
  process.exit(2);
}
const port = Number(portArg);
const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'postgres',
  password: 'postgres',
  port,
  persistent: true,
});

if (cmd === 'start') {
  if (!existsSync(`${dataDir}/PG_VERSION`)) {
    await pg.initialise();
  }
  await pg.start();
  try {
    await pg.createDatabase('acme');
  } catch {
    // exists from a previous stage — fine
  }
  console.log(`postgres://postgres:postgres@localhost:${port}/acme`);
  process.exit(0);
} else if (cmd === 'stop') {
  await pg.stop();
  process.exit(0);
} else {
  console.error(`unknown command: ${cmd}`);
  process.exit(2);
}
