/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

type ChatThreadsServiceLike = {
	openNewThread: () => Promise<void>;
	focusCurrentChat: () => Promise<void>;
	listSkillNames?: () => string[];
	getSkillExpansion: (trimmed: string) => string | null;
};

type CommandServiceLike = {
	executeCommand: (id: string) => Promise<unknown>;
};

type NotificationServiceLike = {
	info: (message: string) => void;
};

export type HandleSlashCommandParams = {
	trimmedMessage: string;
	clearInput: () => void;
	chatThreadsService: ChatThreadsServiceLike;
	commandService: CommandServiceLike;
	notificationService: NotificationServiceLike;
	settingsCommandId: string;
};

export type SlashCommandResult =
	| { handled: true }
	| { handled: false; userMessage: string };

/** Intercept /command messages before sending to the LLM. */
export const handleSlashCommand = async ({
	trimmedMessage,
	clearInput,
	chatThreadsService,
	commandService,
	notificationService,
	settingsCommandId,
}: HandleSlashCommandParams): Promise<SlashCommandResult> => {
	if (!trimmedMessage.startsWith('/')) {
		return { handled: false, userMessage: trimmedMessage };
	}

	const [cmd] = trimmedMessage.slice(1).split(/\s+/);
	switch (cmd.toLowerCase()) {
		case 'clear':
		case 'new':
			clearInput();
			await chatThreadsService.openNewThread();
			await chatThreadsService.focusCurrentChat();
			return { handled: true };
		case 'settings':
		case 'model':
			clearInput();
			await commandService.executeCommand(settingsCommandId);
			return { handled: true };
		case 'help': {
			clearInput();
			const skillNames = chatThreadsService.listSkillNames?.() ?? [];
			const skillsLine = skillNames.length > 0
				? ` | skills: ${skillNames.map(n => '/' + n).join(', ')}`
				: '';
			notificationService.info(
				// allow-any-unicode-next-line
				'Slash commands: /clear — new thread | /settings — open settings | /model — change model | /help — this message' + skillsLine
			);
			return { handled: true };
		}
		default: {
			const skillExpansion = chatThreadsService.getSkillExpansion(trimmedMessage);
			if (skillExpansion !== null) {
				return { handled: false, userMessage: skillExpansion };
			}
			return { handled: false, userMessage: trimmedMessage };
		}
	}
};
