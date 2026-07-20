/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// Normally you'd want to put these exports in the files that register them, but if you do that you'll get an import order error if you import them in certain cases.
// (importing them runs the whole file to get the ID, causing an import error). I guess it's best practice to separate out IDs, pretty annoying...

export const CORTEXIDE_ATTACH_FILE_TO_CHAT_ACTION_ID = 'cortexide.attachFileToChat';

export const CORTEXIDE_CTRL_L_ACTION_ID = 'cortexide.ctrlLAction';

export const CORTEXIDE_CTRL_K_ACTION_ID = 'cortexide.ctrlKAction';

export const CORTEXIDE_ACCEPT_DIFF_ACTION_ID = 'cortexide.acceptDiff';

export const CORTEXIDE_REJECT_DIFF_ACTION_ID = 'cortexide.rejectDiff';

export const CORTEXIDE_GOTO_NEXT_DIFF_ACTION_ID = 'cortexide.goToNextDiff';

export const CORTEXIDE_GOTO_PREV_DIFF_ACTION_ID = 'cortexide.goToPrevDiff';

export const CORTEXIDE_GOTO_NEXT_URI_ACTION_ID = 'cortexide.goToNextUri';

export const CORTEXIDE_GOTO_PREV_URI_ACTION_ID = 'cortexide.goToPrevUri';

export const CORTEXIDE_ACCEPT_FILE_ACTION_ID = 'cortexide.acceptFile';

export const CORTEXIDE_REJECT_FILE_ACTION_ID = 'cortexide.rejectFile';

export const CORTEXIDE_ACCEPT_ALL_DIFFS_ACTION_ID = 'cortexide.acceptAllDiffs';

export const CORTEXIDE_REJECT_ALL_DIFFS_ACTION_ID = 'cortexide.rejectAllDiffs';
