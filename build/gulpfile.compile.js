/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

//@ts-check
'use strict';

const gulp = require('gulp');
const util = require('./lib/util');
const date = require('./lib/date');
const task = require('./lib/task');
const compilation = require('./lib/compilation');
const { execSync } = require('child_process');
const path = require('path');

/**
 * Task to build React components for production
 */
const buildReactTask = task.define('build-react', () => {
	return new Promise((resolve, reject) => {
		try {
			const reactBuildPath = path.join(__dirname, '../src/vs/workbench/contrib/cortexide/browser/react');
			// allow-any-unicode-next-line
			console.log('🔨 Building React components...');
			execSync('node build.js', {
				cwd: reactBuildPath,
				stdio: 'inherit'
			});
			// allow-any-unicode-next-line
			console.log('✅ React components built successfully');
			resolve();
		} catch (error) {
			// allow-any-unicode-next-line
			console.error('❌ Error building React components:', error);
			reject(error);
		}
	});
});

/**
 * @param {boolean} disableMangle
 */
function makeCompileBuildTask(disableMangle) {
	return task.series(
		util.rimraf('out-build'),
		date.writeISODate('out-build'),
		compilation.compileApiProposalNamesTask,
		buildReactTask, // Build React components before compiling
		compilation.compileTask('src', 'out-build', true, { disableMangle })
	);
}

// Local/PR compile, including nls and inline sources in sourcemaps, minification, no mangling
const compileBuildWithoutManglingTask = task.define('compile-build-without-mangling', makeCompileBuildTask(true));
gulp.task(compileBuildWithoutManglingTask);
exports.compileBuildWithoutManglingTask = compileBuildWithoutManglingTask;

// CI compile, including nls and inline sources in sourcemaps, mangling, minification, for build
const compileBuildWithManglingTask = task.define('compile-build-with-mangling', makeCompileBuildTask(false));
gulp.task(compileBuildWithManglingTask);
exports.compileBuildWithManglingTask = compileBuildWithManglingTask;
