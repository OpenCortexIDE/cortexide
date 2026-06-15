/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ServicesAccessor } from '../../../../editor/browser/editorExtensions.js';
import { localize2 } from '../../../../nls.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IAuditLogService } from '../common/auditLogService.js';
import { formatAuditEvents } from '../common/auditLogFormat.js';

/**
 * Phase 8: a user-facing view of the append-only audit log (the tamper-evident record of every dangerous
 * action). Reads the recorded events back through the audit service (which flushes pending writes and
 * tolerates a truncated trailing line via parseJsonl), renders them with the pure formatter, and opens the
 * result in an editor so the user can inspect -- and save/export -- the log.
 */
registerAction2(class extends Action2 {
	constructor() {
		super({
			f1: true,
			id: 'cortexide.showAuditLog',
			title: localize2('cortexideShowAuditLog', 'CortexIDE: Show Audit Log'),
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const notificationService = accessor.get(INotificationService);
		const auditLogService = accessor.get(IAuditLogService);
		const editorService = accessor.get(IEditorService);
		try {
			if (!auditLogService.isEnabled()) {
				notificationService.info('CortexIDE audit logging is disabled (enable it via the cortexide.audit settings).');
				return;
			}
			const { events, skipped } = await auditLogService.readEvents();
			const path = auditLogService.getLogPath();
			const header = path ? `# ${path.fsPath}\n\n` : '';
			await editorService.openEditor({
				resource: undefined,
				contents: header + formatAuditEvents(events, skipped),
				languageId: 'text',
				options: { pinned: true },
			});
			if (skipped > 0) {
				notificationService.warn(`Audit log: ${skipped} corrupt/truncated line(s) were skipped while reading.`);
			}
		} catch (err) {
			notificationService.error(`Failed to show the CortexIDE audit log: ${err instanceof Error ? err.message : String(err)}`);
		}
	}
});
