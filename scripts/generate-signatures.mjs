#!/usr/bin/env node
// Generates .claude/skills/fonderie/SIGNATURES.md — the exact public API of
// every package, extracted from source with the TypeScript checker. Run via
// `npm run docs:signatures` after changing any package's public surface;
// CI can enforce freshness with `npm run docs:signatures && git diff --exit-code`.
//
// Output design: compact enough to sit in an AI assistant's context (the
// fonderie skill), exact enough that nobody needs to read package source to
// learn a constructor or config shape.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Publishable packages, in reading order (foundation first).
const PACKAGES = [
	'core', 'store', 'events', 'auth', 'courier', 'workspaces', 'billing',
	'permissions', 'config', 'customers', 'audit', 'webhooks', 'logger',
	'client', 'adapter-express', 'adapter-hono', 'adapter-koa',
];

const printer = ts.createPrinter({ removeComments: true });

function loadProgram(pkgDir) {
	const configPath = join(pkgDir, 'tsconfig.json');
	const parsed = ts.parseJsonConfigFileContent(
		ts.readConfigFile(configPath, ts.sys.readFile).config,
		ts.sys,
		pkgDir,
	);
	return ts.createProgram([join(pkgDir, 'src/index.ts')], {
		...parsed.options,
		noEmit: true,
		skipLibCheck: true,
	});
}

// Render one exported symbol as a compact signature line/block.
function renderSymbol(checker, name, symbol) {
	const target = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
	const decl = target.valueDeclaration ?? target.declarations?.[0];
	if (!decl) return null;
	const sf = decl.getSourceFile();

	// Namespace re-exports (export * as ns from './x'): list the members —
	// zod schema types are too verbose to print, but the names are the contract.
	if (symbol.declarations?.some((d) => ts.isNamespaceExport(d))) {
		const members = checker
			.getExportsOfModule(target)
			.map((m) => m.getName())
			.sort();
		return `namespace ${name} — exports: ${members.join(', ')}`;
	}

	// Interfaces, type aliases, enums: the declaration text IS the signature.
	if (ts.isInterfaceDeclaration(decl) || ts.isTypeAliasDeclaration(decl) || ts.isEnumDeclaration(decl)) {
		return printer.printNode(ts.EmitHint.Unspecified, decl, sf)
			.replace(/^export\s+(declare\s+)?/, '');
	}

	if (ts.isClassDeclaration(decl)) {
		const type = checker.getTypeOfSymbolAtLocation(target, decl);
		const lines = [];
		for (const sig of type.getConstructSignatures()) {
			lines.push(`new ${name}${checker.signatureToString(sig).replace(/^\(/, '(')}`);
		}
		const instance = checker.getDeclaredTypeOfSymbol(target);
		for (const prop of checker.getPropertiesOfType(instance)) {
			const pd = prop.valueDeclaration ?? prop.declarations?.[0];
			if (!pd || !pd.getSourceFile) continue;
			const mods = ts.canHaveModifiers(pd) ? (ts.getModifiers(pd) ?? []) : [];
			if (mods.some((m) => m.kind === ts.SyntaxKind.PrivateKeyword || m.kind === ts.SyntaxKind.ProtectedKeyword)) continue;
			if (prop.getName().startsWith('_') || prop.getName().startsWith('#')) continue;
			const pt = checker.getTypeOfSymbolAtLocation(prop, pd);
			const call = pt.getCallSignatures()[0];
			lines.push(call
				? `  .${prop.getName()}${checker.signatureToString(call)}`
				: `  .${prop.getName()}: ${checker.typeToString(pt)}`);
		}
		return lines.join('\n');
	}

	if (ts.isFunctionDeclaration(decl) || ts.isMethodDeclaration(decl)) {
		const type = checker.getTypeOfSymbolAtLocation(target, decl);
		const sig = type.getCallSignatures()[0];
		return sig ? `function ${name}${checker.signatureToString(sig)}` : null;
	}

	if (ts.isVariableDeclaration(decl)) {
		const type = checker.getTypeOfSymbolAtLocation(target, decl);
		const call = type.getCallSignatures()[0];
		if (call) return `function ${name}${checker.signatureToString(call)}`;
		const str = checker.typeToString(type, decl, ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.InTypeAlias);
		return `const ${name}: ${str}`;
	}

	return null;
}

function renderPackage(pkg) {
	const pkgDir = join(root, 'packages', pkg);
	const pkgJson = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
	const program = loadProgram(pkgDir);
	const checker = program.getTypeChecker();
	const entry = program.getSourceFile(join(pkgDir, 'src/index.ts'));
	if (!entry) throw new Error(`no src/index.ts for ${pkg}`);

	const moduleSymbol = checker.getSymbolAtLocation(entry);
	if (!moduleSymbol) throw new Error(`no module symbol for ${pkg}`);

	const blocks = [];
	for (const exp of checker.getExportsOfModule(moduleSymbol)) {
		const rendered = renderSymbol(checker, exp.getName(), exp);
		if (rendered) blocks.push(rendered);
	}

	const subpaths = Object.keys(pkgJson.exports ?? {}).filter((k) => k !== '.');
	const header = [`## ${pkgJson.name}`];
	if (subpaths.length) header.push(`Subpath exports: ${subpaths.map((s) => `\`${pkgJson.name}${s.slice(1)}\``).join(', ')}`);

	return `${header.join('\n\n')}\n\n\`\`\`ts\n${blocks.join('\n\n')}\n\`\`\``;
}

const sections = PACKAGES
	.filter((p) => existsSync(join(root, 'packages', p, 'src/index.ts')))
	.map((p) => {
		process.stdout.write(`  ${p}\n`);
		return renderPackage(p);
	});

const out = `# Fonderie — generated API signatures

<!-- GENERATED FILE — do not edit. Regenerate with: npm run docs:signatures -->

Exact public signatures extracted from source by \`scripts/generate-signatures.mjs\`.
For the curated wiring guide (composition rules, golden example, routes), see
[API.md](API.md). If a signature here disagrees with API.md, this file wins.

${sections.join('\n\n')}
`;

writeFileSync(join(root, '.claude/skills/fonderie/SIGNATURES.md'), out);
console.log(`wrote .claude/skills/fonderie/SIGNATURES.md (${out.length} bytes)`);
