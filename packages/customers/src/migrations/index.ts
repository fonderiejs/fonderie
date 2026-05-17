import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function sql(name: string): string {
	return readFileSync(join(__dirname, 'sql', name), 'utf-8');
}

export const migrations = [{ name: '001_customers', sql: sql('001_customers.sql') }];
