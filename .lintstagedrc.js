module.exports = {
	// Run ESLint on staged TypeScript/JavaScript files
	'*.{ts,tsx,js,jsx}': [
		'eslint --fix --max-warnings=0',
		'git add'
	],
	// Format JSON files (prettier optional - will skip if not installed)
	'*.{json,jsonc}': (files) => {
		const { execSync } = require('child_process');
		try {
			execSync(`npx --no prettier --write ${files.join(' ')}`, { stdio: 'inherit' });
		} catch (e) {
			console.warn('Prettier not available, skipping JSON formatting');
		}
		return `git add ${files.join(' ')}`;
	},
	// Format markdown files (prettier optional - will skip if not installed)
	'*.md': (files) => {
		const { execSync } = require('child_process');
		try {
			execSync(`npx --no prettier --write ${files.join(' ')}`, { stdio: 'inherit' });
		} catch (e) {
			console.warn('Prettier not available, skipping markdown formatting');
		}
		return `git add ${files.join(' ')}`;
	},
	// Skip shell scripts (they have their own linting)
	'*.{sh,bash}': () => true,
};

