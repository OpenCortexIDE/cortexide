module.exports = {
	// Run ESLint on staged TypeScript/JavaScript files
	'*.{ts,tsx,js,jsx}': [
		'eslint --fix --max-warnings=0',
		'git add'
	],
	// Format JSON files
	'*.{json,jsonc}': [
		'prettier --write',
		'git add'
	],
	// Format markdown files
	'*.md': [
		'prettier --write',
		'git add'
	],
	// Skip shell scripts (they have their own linting)
	'*.{sh,bash}': () => true,
};

