import { Command } from 'commander';
import pc from 'picocolors';
import {
	cleanup,
	cloneTemplate,
	directoryExists,
	printSuccess,
	runNpmInstall,
} from './utils.js';

async function run(projectName: string | undefined): Promise<void> {
	if (!projectName) {
		console.log('Usage: npx create-fonderie-app <project-name>');
		process.exit(1);
	}

	if (directoryExists(projectName)) {
		console.log(pc.red(`Error: Directory "${projectName}" already exists.`));
		process.exit(1);
	}

	let dir: string | undefined;
	try {
		console.log(pc.dim(`Creating ${projectName}...`));
		dir = await cloneTemplate(projectName);

		console.log(pc.dim('Installing dependencies...'));
		await runNpmInstall(dir);
	} catch (err) {
		console.log(pc.red(`\nError: ${err instanceof Error ? err.message : String(err)}`));
		// Never leave a half-created directory behind.
		if (dir) cleanup(dir);
		process.exit(1);
	}

	printSuccess(projectName);
}

const program = new Command();

program
	.name('create-fonderie-app')
	.description('Scaffold a Fonderie-powered SaaS backend.')
	.argument('[project-name]', 'name of the app to create')
	.action((projectName?: string) => run(projectName));

program.parseAsync(process.argv).catch((err) => {
	console.log(pc.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
	process.exit(1);
});
