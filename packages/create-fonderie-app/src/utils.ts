import { spawn } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { downloadTemplate } from 'giget';
import pc from 'picocolors';

/** The source repo cloned to scaffold a new app. */
const TEMPLATE_SOURCE = 'github:fonderiejs/template-starter';

/** True if `<cwd>/<name>` already exists on disk. */
export function directoryExists(name: string): boolean {
	return existsSync(resolve(process.cwd(), name));
}

/**
 * Clone the starter template into ./<projectName> using giget.
 * This copies the files only — it does NOT create a git submodule and does
 * not keep any git history from the template repo.
 */
export async function cloneTemplate(projectName: string): Promise<string> {
	const dir = resolve(process.cwd(), projectName);
	await downloadTemplate(TEMPLATE_SOURCE, {
		dir,
		forceClean: true,
	});
	return dir;
}

/**
 * Run `npm install` inside the given directory, inheriting stdio so the user
 * sees live install progress. Resolves on exit code 0, rejects otherwise.
 */
export function runNpmInstall(dir: string): Promise<void> {
	return new Promise((resolvePromise, reject) => {
		const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
		const child = spawn(npm, ['install'], {
			cwd: dir,
			stdio: 'inherit',
		});
		child.on('error', reject);
		child.on('close', (code) => {
			if (code === 0) {
				resolvePromise();
			} else {
				reject(new Error(`npm install exited with code ${code}`));
			}
		});
	});
}

/** Remove a partially-created project directory, ignoring errors. */
export function cleanup(dir: string): void {
	try {
		rmSync(dir, { recursive: true, force: true });
	} catch {
		// best effort — nothing more we can do
	}
}

/** Print the final success message with next steps. */
export function printSuccess(projectName: string): void {
	const lines = [
		'',
		pc.green(`✔ Created ${projectName} in ./${projectName}`),
		'',
		'Next steps:',
		pc.cyan(`  cd ${projectName}`),
		pc.cyan('  cp .env.example .env'),
		pc.cyan('  npm run dev'),
		'',
		'Then open Claude Code and say:',
		pc.dim('  "Add billing to this app."'),
		'',
		'Read the README.md for more.',
	];
	console.log(lines.join('\n'));
}
