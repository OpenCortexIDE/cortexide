/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Formats the agent's current todo list as a working-memory reminder that is
 * re-injected into the model's per-turn instructions.
 *
 * Without this, todo_write writes a plan the model can never read back
 * (getLatestTodos had no consumers), so on long-horizon tasks the agent loses
 * track of what it has done and what remains -- a capability incumbents and the
 * local-first field both ship. The reminder is folded into the per-turn
 * instructions (alongside rules/MCP), NOT the cached system message, so it stays
 * current as steps complete.
 */

export type TodoStatus = 'pending' | 'in_progress' | 'completed';
export type TodoItem = { content: string; status: TodoStatus };

function checkbox(status: TodoStatus): string {
	switch (status) {
		case 'completed': return '[x]';
		case 'in_progress': return '[~]';
		default: return '[ ]';
	}
}

/**
 * Returns a formatted reminder block, or undefined when there is nothing to
 * inject (no todos) so callers can skip injection entirely with zero impact.
 */
export function formatTodoReminder(todos: ReadonlyArray<TodoItem> | undefined | null): string | undefined {
	if (!todos || todos.length === 0) {
		return undefined;
	}
	const completed = todos.filter(t => t.status === 'completed').length;
	const lines = todos.map(t => `${checkbox(t.status)} ${t.content}`);
	return [
		`CURRENT TODO LIST (your working memory -- you maintain this with the todo_write tool).`,
		`Keep it updated as you make progress; mark items completed and set the next one in_progress. Call attempt_completion only when every item is done.`,
		`Progress: ${completed}/${todos.length} completed.`,
		...lines,
	].join('\n');
}
