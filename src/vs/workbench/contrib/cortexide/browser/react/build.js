/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { execSync } from 'child_process';
import { spawn } from 'cross-spawn'
// Added lines below
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function doesPathExist(filePath) {
	try {
		const stats = fs.statSync(filePath);

		return stats.isFile();
	} catch (err) {
		if (err.code === 'ENOENT') {
			return false;
		}
		throw err;
	}
}

/*

This function finds `globalDesiredPath` given `localDesiredPath` and `currentPath`

Diagram:

...basePath/
// allow-any-unicode-next-line
└── void/
	// allow-any-unicode-next-line
	├── ...currentPath/ (defined globally)
	// allow-any-unicode-next-line
	└── ...localDesiredPath/ (defined locally)

*/
function findDesiredPathFromLocalPath(localDesiredPath, currentPath) {

	// walk upwards until currentPath + localDesiredPath exists
	while (!doesPathExist(path.join(currentPath, localDesiredPath))) {
		const parentDir = path.dirname(currentPath);

		if (parentDir === currentPath) {
			return undefined;
		}

		currentPath = parentDir;
	}

	// return the `globallyDesiredPath`
	const globalDesiredPath = path.join(currentPath, localDesiredPath)
	return globalDesiredPath;
}

// Watch for styles.css to be written by scope-tailwind, then re-touch it so tsup picks it up.
// allow-any-unicode-next-line
// Using fs.watch instead of a hardcoded timeout — fires deterministically when the file changes.
function watchAndResaveStylesFile() {
	const pathToCssFile = findDesiredPathFromLocalPath(
		'./src/vs/workbench/contrib/cortexide/browser/react/src2/styles.css',
		__dirname
	);

	if (pathToCssFile === undefined) {
		console.error('[scope-tailwind] Error finding styles.css for watch-resave');
		return;
	}

	// One-shot watcher: fires when scope-tailwind finishes writing, then closes itself.
	let watcher;
	const onChanged = () => {
		watcher?.close();
		// Short debounce to let the OS flush any buffered writes
		setTimeout(() => {
			try {
				const content = fs.readFileSync(pathToCssFile, 'utf8');
				fs.writeFileSync(pathToCssFile, content, 'utf8');
				console.log('[scope-tailwind] Force-saved styles.css');
			} catch (err) {
				console.error('[scope-tailwind] Error saving styles.css:', err);
			}
		}, 150);
	};

	try {
		watcher = fs.watch(pathToCssFile, { persistent: false }, onChanged);
		watcher.on('error', () => {
			watcher?.close();
			// allow-any-unicode-next-line
			console.error('[scope-tailwind] Watch error on styles.css — falling back to 2s timeout');
			setTimeout(onChanged, 2000);
		});
	} catch {
		// styles.css may not exist yet on first run; fall back to a short timeout
		setTimeout(onChanged, 2000);
	}
}

const args = process.argv.slice(2);
const isWatch = args.includes('--watch') || args.includes('-w');

if (isWatch) {
	// this just builds it if it doesn't exist instead of waiting for the watcher to trigger
	// Check if src2/ exists; if not, do an initial scope-tailwind build
	if (!fs.existsSync('src2')) {
		try {
			// allow-any-unicode-next-line
			console.log('🔨 Running initial scope-tailwind build to create src2 folder...');
			execSync(
				'npx scope-tailwind ./src -o src2/ -s void-scope -c styles.css -p "void-"',
				{ stdio: 'inherit' }
			);
			// allow-any-unicode-next-line
			console.log('✅ src2/ created successfully.');
		} catch (err) {
			// allow-any-unicode-next-line
			console.error('❌ Error running initial scope-tailwind build:', err);
			process.exit(1);
		}
	}

	// Watch mode
	const scopeTailwindWatcher = spawn('npx', [
		'nodemon',
		'--watch', 'src',
		'--ext', 'ts,tsx,css',
		'--exec',
		'npx scope-tailwind ./src -o src2/ -s void-scope -c styles.css -p "void-"'
	]);

	const tsupWatcher = spawn('npx', [
		'tsup',
		'--watch'
	]);

	scopeTailwindWatcher.stdout.on('data', (data) => {
		console.log(`[scope-tailwind] ${data}`);
		// When scope-tailwind announces a styles.css write, set up a one-shot watcher to re-touch it
		if (data.toString().includes('styles.css')) {
			watchAndResaveStylesFile();
		}
	});

	scopeTailwindWatcher.stderr.on('data', (data) => {
		console.error(`[scope-tailwind] ${data}`);
	});

	// Handle tsup watcher output
	tsupWatcher.stdout.on('data', (data) => {
		console.log(`[tsup] ${data}`);
	});

	tsupWatcher.stderr.on('data', (data) => {
		console.error(`[tsup] ${data}`);
	});

	// Handle process termination
	process.on('SIGINT', () => {
		scopeTailwindWatcher.kill();
		tsupWatcher.kill();
		process.exit();
	});

	// allow-any-unicode-next-line
	console.log('🔄 Watchers started! Press Ctrl+C to stop both watchers.');
} else {
	// Build mode
	// allow-any-unicode-next-line
	console.log('📦 Building...');

	// Transform TSX/JSX class names and compile Tailwind CSS (requires postcss@^8 in root node_modules)
	execSync('npx scope-tailwind ./src -o src2/ -s void-scope -c styles.css -p "void-"', { stdio: 'inherit' });

	// Run tsup once
	execSync('npx tsup', { stdio: 'inherit' });

	// allow-any-unicode-next-line
	console.log('✅ Build complete!');
}
