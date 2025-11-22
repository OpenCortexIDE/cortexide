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
- void/
  - ...currentPath/ (defined globally)
  - ...localDesiredPath/ (defined locally)

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

// Fix import paths in bundled files
function fixImportPaths() {
	const outDir = path.join(__dirname, 'out');
	if (!fs.existsSync(outDir)) return;

	// Calculate the base path for absolute imports
	// From: out/vs/workbench/contrib/cortexide/browser/react/out/
	// To: vs/workbench/contrib/cortexide/browser/react/out/
	const outBasePath = path.relative(path.join(__dirname, '../../../../../../out'), outDir);
	const baseModulePath = outBasePath.replace(/\\/g, '/'); // Normalize to forward slashes

	try {
		function processFile(fullPath) {
			if (!fullPath.endsWith('.js')) return;

			let content = fs.readFileSync(fullPath, 'utf8');
			const original = content;

			// Helper to resolve relative import to absolute path from base URL
			function resolveToAbsolutePath(relativePath, fromFile) {
				// Get the directory of the current file relative to out/
				const fileRelPath = path.relative(path.join(__dirname, '../../../../../../out'), fromFile);
				const fileDir = path.dirname(fileRelPath).replace(/\\/g, '/');
				// Resolve the relative path
				const resolved = path.resolve(fileDir, relativePath).replace(/\\/g, '/');
				// Make it relative to out/ and ensure it starts with vs/
				if (resolved.startsWith('../')) {
					// This shouldn't happen, but handle it
					return relativePath;
				}
				// Return as absolute path from base URL (e.g., vs/workbench/...)
				return resolved;
			}

			// Fix imports like '../../../../common/...' -> '../../../common/...'
			// The bundle is at out/vs/workbench/contrib/cortexide/browser/react/out/
			// To reach out/vs/workbench/contrib/cortexide/common/, we need 3 levels up (not 4)
			content = content.replace(
				/(?:from\s+)?['"]((?:\.\.\/){4})(common\/[^'"]+)['"]/g,
				(match, dots, rest) => {
					return match.replace(dots, dots.replace(/^\.\.\//, ''));
				}
			);

			// Convert bare module specifiers to relative paths
			// The React bundle is at: vs/workbench/contrib/cortexide/browser/react/out/
			// Browser files are at: vs/workbench/contrib/cortexide/browser/
			// So from chunk location, we need to go up 2 levels: ../../actionIDs.js

			// Convert vs/workbench/contrib/cortexide/browser/... to ../../...
			content = content.replace(
				/from\s+['"]vs\/workbench\/contrib\/cortexide\/browser\/(actionIDs|cortexideSettingsPane|terminalToolService)\.js['"]/g,
				(match, filename) => {
					const quote = match.includes("'") ? "'" : '"';
					return `from ${quote}../../${filename}.js${quote}`;
				}
			);

			// Fix circular dependency: convert imports of CORTEXIDE_OPEN_SETTINGS_ACTION_ID from cortexideSettingsPane to actionIDs
			content = content.replace(
				/from\s+['"]\.\.\/\.\.\/cortexideSettingsPane\.js['"]/g,
				(match) => {
					// Only replace if this import is used for CORTEXIDE_OPEN_SETTINGS_ACTION_ID or CORTEXIDE_TOGGLE_SETTINGS_ACTION_ID
					// Check the line before and after to see if these constants are imported
					const quote = match.includes("'") ? "'" : '"';
					// For now, we'll replace all imports from cortexideSettingsPane that might import action IDs
					// This is safe because we moved those exports to actionIDs.js
					return match; // Keep as is for now, we'll handle this differently
				}
			);

			// Fix circular dependency: if a file imports CORTEXIDE_OPEN_SETTINGS_ACTION_ID or CORTEXIDE_TOGGLE_SETTINGS_ACTION_ID
			// from cortexideSettingsPane, change it to import from actionIDs instead
			// Check if this file uses these action IDs and imports from cortexideSettingsPane
			if ((content.includes('CORTEXIDE_OPEN_SETTINGS_ACTION_ID') || content.includes('CORTEXIDE_TOGGLE_SETTINGS_ACTION_ID')) &&
				(content.includes("from '../../cortexideSettingsPane.js'") || content.includes('from "../../cortexideSettingsPane.js"'))) {
				// Replace the import - these action IDs are now in actionIDs.js
				content = content.replace(
					/from\s+['"]\.\.\/\.\.\/cortexideSettingsPane\.js['"]/g,
					(match) => {
						const quote = match.includes("'") ? "'" : '"';
						return `from ${quote}../../actionIDs.js${quote}`;
					}
				);
			}

			// Convert relative imports to absolute paths from base URL for import maps
			// This is necessary because vscode-file:// protocol doesn't resolve relative imports from chunks correctly
			// We'll convert relative imports to absolute paths (e.g., ../../actionIDs.js -> vs/workbench/contrib/cortexide/browser/actionIDs.js)
			// These will be resolved via import maps that map them to the correct vscode-file:// URLs

			// Get the file's path relative to out/ directory to calculate correct absolute paths
			// The build script is at: src/vs/workbench/contrib/cortexide/browser/react/build.js
			// The local out directory is at: src/vs/workbench/contrib/cortexide/browser/react/out
			// The workspace out directory is at: out/vs/workbench/contrib/cortexide/browser/react/out
			// We need to map from local out/ to workspace out/ directory
			// The file is in: src/vs/workbench/contrib/cortexide/browser/react/out/...
			// It should be treated as: out/vs/workbench/contrib/cortexide/browser/react/out/...
			const localOutDir = path.join(__dirname, 'out');
			const workspaceOutDir = path.join(__dirname, '../../../../../../out');
			const relativeFromLocalOut = path.relative(localOutDir, fullPath);
			const fileRelPath = path.join('vs/workbench/contrib/cortexide/browser/react/out', relativeFromLocalOut).replace(/\\/g, '/');
			const fileDir = path.dirname(fileRelPath);

			// Convert all relative imports (starting with ../) to absolute paths
			// Use a function to resolve each relative import
			function resolveRelativeImport(relativePath) {
				if (!relativePath.startsWith('../')) {
					return relativePath; // Already absolute or relative to current dir
				}
				const dotCount = (relativePath.match(/\.\.\//g) || []).length;
				const rest = relativePath.replace(/^(\.\.\/)+/, '');
				const currentDirParts = fileDir.split('/').filter(p => p && p !== '.');
				const targetDirParts = currentDirParts.slice(0, Math.max(0, currentDirParts.length - dotCount));
				let resolvedPath;
				if (targetDirParts.length > 0) {
					resolvedPath = `${targetDirParts.join('/')}/${rest}`;
				} else {
					// If we went beyond vs/, the path should still start with vs/
					// This happens when going up many levels (e.g., ../../../../../../../base/...)
					// The rest should be the module path under vs/
					resolvedPath = `vs/${rest}`;
				}
				return resolvedPath.startsWith('vs/') ? resolvedPath : relativePath;
			}

			// Replace all relative imports with absolute paths
			// BUT keep chunk imports relative (they're part of the bundle)
			const convertRelativeFromImport = (match, quote, dots, rest) => {
				if (rest.startsWith('./') || rest.startsWith('vs/') || rest.startsWith('chunk-')) {
					return match;
				}
				const resolved = resolveRelativeImport(`${dots}${rest}`);
				if (resolved !== `${dots}${rest}`) {
					return `from ${quote}${resolved}${quote}`;
				}
				return match;
			};
			content = content.replace(
				/from\s+(['"])((?:\.\.\/)+)([^'";\n]+)\1/g,
				convertRelativeFromImport
			);

			// Handle side-effect imports: import '../../../base/...'
			content = content.replace(
				/import\s+(['"])((?:\.\.\/)+)([^'";\n]+)\1/g,
				(match, quote, dots, rest) => {
					if (rest.startsWith('./') || rest.startsWith('vs/') || rest.startsWith('chunk-')) {
						return match;
					}
					const resolved = resolveRelativeImport(`${dots}${rest}`);
					if (resolved !== `${dots}${rest}`) {
						return `import ${quote}${resolved}${quote}`;
					}
					return match;
				}
			);

			// Also fix any absolute chunk imports that were incorrectly converted
			// Convert them back to relative imports
			content = content.replace(
				/from\s+(['"])vs\/workbench\/contrib\/cortexide\/browser\/react\/out\/(chunk-[^'"]+)\1/g,
				(match, quote, chunkName) => {
					// Get the directory of the current file relative to react/out/
					const currentFileDir = path.dirname(fileRelPath);
					// Chunks are in react/out/, entry points are in react/out/subdir/
					if (currentFileDir === 'vs/workbench/contrib/cortexide/browser/react/out') {
						return `from ${quote}./${chunkName}${quote}`;
					}
					// If in a subdirectory (e.g., void-settings-tsx/), use relative path
					return `from ${quote}../${chunkName}${quote}`;
				}
			);

			// Ensure browser-level modules always point to the browser directory
			content = content
				.replace(/vs\/workbench\/contrib\/cortexide\/actionIDs\.js/g, 'vs/workbench/contrib/cortexide/browser/actionIDs.js')
				.replace(/vs\/workbench\/contrib\/cortexide\/cortexideSettingsPane\.js/g, 'vs/workbench/contrib/cortexide/browser/cortexideSettingsPane.js')
				.replace(/vs\/workbench\/contrib\/cortexide\/terminalToolService\.js/g, 'vs/workbench/contrib/cortexide/browser/terminalToolService.js')
				.replace(/vs\/workbench\/contrib\/cortexide\/browser\/common\//g, 'vs/workbench/contrib/cortexide/common/');

			// Also fix any incorrect relative paths (3+ levels should be 2 levels for browser files)
			content = content.replace(
				/from\s+['"]((?:\.\.\/){3,})(actionIDs|cortexideSettingsPane|terminalToolService)\.js['"]/g,
				(match, dots, filename) => {
					const quote = match.includes("'") ? "'" : '"';
					return `from ${quote}../../${filename}.js${quote}`;
				}
			);

			// Fix circular dependency: replace imports from cortexideSettingsPane.js that import action IDs
			// with imports from actionIDs.js instead
			if ((content.includes('CORTEXIDE_OPEN_SETTINGS_ACTION_ID') || content.includes('CORTEXIDE_TOGGLE_SETTINGS_ACTION_ID')) &&
				(content.includes("from '../../cortexideSettingsPane.js'") || content.includes('from "../../cortexideSettingsPane.js"'))) {
				const quote = content.includes("'../../cortexideSettingsPane.js'") ? "'" : '"';
				content = content.replace(
					new RegExp(`from\\s+${quote}\\.\\./\\.\\./cortexideSettingsPane\\.js${quote}`, 'g'),
					`from ${quote}../../actionIDs.js${quote}`
				);
			}

			// Fix absolute-style imports like '../../../../../../workbench/contrib/cortexide/...'
			// These should be relative paths from the bundle location
			// The bundle is at out/vs/workbench/contrib/cortexide/browser/react/out/
			// So workbench/contrib/cortexide/common/ should be ../../../common/
			content = content.replace(
				/(?:from\s+)?['"]((?:\.\.\/){6,})workbench\/contrib\/cortexide\/(common\/[^'"]+)['"]/g,
				(match, dots, rest) => {
					// Replace with correct relative path: ../../../common/...
					return match.replace(`${dots}workbench/contrib/cortexide/${rest}`, `../../../${rest}`);
				}
			);

			if (content !== original) {
				fs.writeFileSync(fullPath, content, 'utf8');
				const relativePath = path.relative(outDir, fullPath);
				console.log(`  Fixed imports in ${relativePath}`);
			}
		}

		function processDir(dir) {
			const entries = fs.readdirSync(dir, { withFileTypes: true });
			for (const entry of entries) {
				const fullPath = path.join(dir, entry.name);
				if (entry.isDirectory()) {
					processDir(fullPath);
				} else if (entry.isFile()) {
					processFile(fullPath);
				}
			}
		}
		processDir(outDir);
	} catch (err) {
		console.error('[fix-import-paths] Error:', err);
	}
}

// hack to refresh styles automatically
function saveStylesFile() {
	setTimeout(() => {
		try {
			const pathToCssFile = findDesiredPathFromLocalPath('./src/vs/workbench/contrib/cortexide/browser/react/src2/styles.css', __dirname);

			if (pathToCssFile === undefined) {
				console.error('[scope-tailwind] Error finding styles.css');
				return;
			}

			// Or re-write with the same content:
			const content = fs.readFileSync(pathToCssFile, 'utf8');
			fs.writeFileSync(pathToCssFile, content, 'utf8');
			console.log('[scope-tailwind] Force-saved styles.css');
		} catch (err) {
			console.error('[scope-tailwind] Error saving styles.css:', err);
		}
	}, 6000);
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
		// If the output mentions "styles.css", trigger the save:
		if (data.toString().includes('styles.css')) {
			saveStylesFile();
		}
	});

	scopeTailwindWatcher.stderr.on('data', (data) => {
		console.error(`[scope-tailwind] ${data}`);
	});

	// Handle tsup watcher output
	tsupWatcher.stdout.on('data', (data) => {
		console.log(`[tsup] ${data}`);
		// Fix import paths after tsup rebuilds
		setTimeout(() => fixImportPaths(), 500);
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

	// Run scope-tailwind once
	execSync('npx scope-tailwind ./src -o src2/ -s void-scope -c styles.css -p "void-"', { stdio: 'inherit' });

	// Run tsup once
	execSync('npx tsup', { stdio: 'inherit' });

	// Fix import paths in bundled files
	console.log('🔧 Fixing import paths...');
	fixImportPaths();

	// Copy fixed files to out/ and out-build/ directories
	// IMPORTANT: fixImportPaths() must run BEFORE this copy step
	// The files in src/vs/.../react/out/ have been fixed with absolute imports
	// We need to copy those fixed files to both out/ and out-build/ directories
	// Production builds use out-build/, while development uses out/
	// allow-any-unicode-next-line
	console.log('📋 Copying files to out/ and out-build/ directories...');
	const srcOutDir = path.join(__dirname, 'out');
	const outReactOutDir = path.join(__dirname, '../../../../../../../out/vs/workbench/contrib/cortexide/browser/react/out');
	const outBuildReactOutDir = path.join(__dirname, '../../../../../../../out-build/vs/workbench/contrib/cortexide/browser/react/out');

	if (!fs.existsSync(srcOutDir)) {
		console.log('  Source out directory does not exist, skipping copy');
	} else {
		// Copy function that copies all files, not just .js files
		function copyDir(src, dest) {
			if (!fs.existsSync(dest)) {
				fs.mkdirSync(dest, { recursive: true });
			}
			const entries = fs.readdirSync(src, { withFileTypes: true });
			for (const entry of entries) {
				const srcPath = path.join(src, entry.name);
				const destPath = path.join(dest, entry.name);
				if (entry.isDirectory()) {
					copyDir(srcPath, destPath);
				} else if (entry.isFile()) {
					// Copy all files (not just .js) - includes chunks, CSS, source maps, etc.
					fs.copyFileSync(srcPath, destPath);
				}
			}
		}

		// Copy to out/ directory (for development)
		if (!fs.existsSync(outReactOutDir)) {
			fs.mkdirSync(outReactOutDir, { recursive: true });
		}
		copyDir(srcOutDir, outReactOutDir);
		// allow-any-unicode-next-line
		console.log('  ✓ Copied fixed files to out/ directory');

		// Copy to out-build/ directory (for production builds)
		if (!fs.existsSync(outBuildReactOutDir)) {
			fs.mkdirSync(outBuildReactOutDir, { recursive: true });
		}
		copyDir(srcOutDir, outBuildReactOutDir);
		// allow-any-unicode-next-line
		console.log('  ✓ Copied fixed files to out-build/ directory');
	}

	// allow-any-unicode-next-line
	console.log('✅ Build complete!');
}
