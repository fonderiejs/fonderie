import { appendFileSync } from 'node:fs';
import type { ILogEntry, ILogTransport } from '../types';

export class FileTransport implements ILogTransport {
	constructor(private path: string) {}

	write(entry: ILogEntry): void {
		appendFileSync(this.path, JSON.stringify(entry) + '\n');
	}
}
