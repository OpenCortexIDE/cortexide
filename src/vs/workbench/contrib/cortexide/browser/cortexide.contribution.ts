/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/


// register inline diffs
import './editCodeService.js'

// register Sidebar pane, state, actions (keybinds, menus) (Ctrl+L)
import './sidebarActions.js'
import './sidebarPane.js'

// register quick edit (Ctrl+K)
import './quickEditActions.js'

// register Quick Actions
import './quickActions.js'


// register Autocomplete
import './autocompleteService.js'

// register Context services
// import './contextGatheringService.js'
// import './contextUserChangesService.js'

// settings pane
import './cortexideSettingsPane.js'

// register css
import './media/cortexide.css'

// update (frontend part, also see platform/)
import './cortexideUpdateActions.js'
import './cortexideUpdateNotification.js'

import './convertToLLMMessageWorkbenchContrib.js'

// tools
import './toolsService.js'
import './terminalToolService.js'

// register Thread History
import './chatThreadService.js'

// ping
import './metricsPollService.js'

// helper services
import './helperServices/consistentItemService.js'

// register selection helper
import './cortexideSelectionHelperWidget.js'

// register tooltip service
import './tooltipService.js'

// register onboarding service
import './cortexideOnboardingService.js'

// register misc service
import './miscWokrbenchContrib.js'

// remove built-in chat surfaces we don't use
import './hideBuiltinChat.js'

// register file service (for explorer context menu)
import './fileService.js'

// register source control management
import './cortexideSCMService.js'

// ---------- common (unclear if these actually need to be imported, because they're already imported wherever they're used) ----------

// llmMessage
import '../common/sendLLMMessageService.js'

// cortexideSettings
import '../common/cortexideSettingsService.js'

// secret detection
import '../common/secretDetectionService.js'

// memories
import '../common/memoriesService.js'
import './memoriesTrackingContribution.js'

// edit risk scoring
import '../common/editRiskScoringService.js'

// code review
import '../common/codeReviewService.js'
import './codeReviewEditorContribution.js'
import './codeReviewCommands.js'

// codebase query
import './codebaseQueryCommands.js'

// NL shell parser
import '../common/nlShellParserService.js'

// error detection
import '../common/errorDetectionService.js'
import './errorDetectionEditorContribution.js'
import './errorDetectionCommands.js'

// performance guardrails
import '../common/performanceGuardrailsService.js'

// status bar contribution
import './cortexideStatusBar.js'

// first-run validation
import './firstRunValidation.js'
import '../common/secretDetectionConfiguration.js'

// refreshModel
import '../common/refreshModelService.js'

// metrics
import '../common/metricsService.js'

// updates
import '../common/cortexideUpdateService.js'

// model service
import '../common/cortexideModelService.js'

// ollama installer service (main-process proxy)
import '../common/ollamaInstallerService.js'

// repo indexer
import './repoIndexerService.js'
import './repoIndexerActions.js'

// Image QA Registry initialization
import './imageQARegistryContribution.js'
