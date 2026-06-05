/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt in the project root.
 *
 *  CortexIDE Internationalisation (i18n) Service
 *  -----------------------------------------------
 *  Provides translated UI strings for CortexIDE panels.  Works within VS Code's
 *  existing localisation infrastructure:
 *
 *  - Locale is read from VS Code's configured display language (same mechanism the
 *    editor itself uses, set via "Configure Display Language").
 *  - English (en) is the canonical locale.  Missing keys in any other locale fall
 // allow-any-unicode-next-line
 *    back to the English value — no UI string is ever undefined.
 *  - Translations live in `locales/<locale>.json`.  Adding a new language requires
 *    only dropping a new JSON file into that directory; no code change is needed.
 *  - React components consume translations via the `useTranslation()` hook which
 *    returns a stable `t(key, fallback?)` function.
 *
 *  Supported locales (initial set):
 // allow-any-unicode-next-line
 *    en  — English (canonical)
 // allow-any-unicode-next-line
 *    zh  — 简体中文 (Simplified Chinese)
 // allow-any-unicode-next-line
 *    es  — Español
 // allow-any-unicode-next-line
 *    fr  — Français
 // allow-any-unicode-next-line
 *    de  — Deutsch
 // allow-any-unicode-next-line
 *    ja  — 日本語
 // allow-any-unicode-next-line
 *    ko  — 한국어
 // allow-any-unicode-next-line
 *    pt  — Português (Brazilian)
 // allow-any-unicode-next-line
 *    ar  — العربية
 // allow-any-unicode-next-line
 *    ru  — Русский
 // allow-any-unicode-next-line
 *    hi  — हिन्दी
 *--------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { registerSingleton, InstantiationType } from '../../../../../platform/instantiation/common/extensions.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../../platform/storage/common/storage.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';

export const ICortexideI18nService = createDecorator<ICortexideI18nService>('cortexideI18nService');

export type SupportedLocale =
	| 'en' | 'zh' | 'es' | 'fr' | 'de'
	| 'ja' | 'ko' | 'pt' | 'ar' | 'ru' | 'hi';

export const SUPPORTED_LOCALES: Record<SupportedLocale, string> = {
	en: 'English',
	// allow-any-unicode-next-line
	zh: '简体中文',
	// allow-any-unicode-next-line
	es: 'Español',
	// allow-any-unicode-next-line
	fr: 'Français',
	de: 'Deutsch',
	// allow-any-unicode-next-line
	ja: '日本語',
	// allow-any-unicode-next-line
	ko: '한국어',
	// allow-any-unicode-next-line
	pt: 'Português',
	// allow-any-unicode-next-line
	ar: 'العربية',
	// allow-any-unicode-next-line
	ru: 'Русский',
	// allow-any-unicode-next-line
	hi: 'हिन्दी',
};

export type TranslationKey = keyof typeof EN_TRANSLATIONS;
export type TranslationDict = Record<string, string>;

export interface ICortexideI18nService {
	readonly _serviceBrand: undefined;

	/** Currently active locale */
	readonly locale: SupportedLocale;

	/** Fires when the locale changes */
	readonly onDidChangeLocale: Event<SupportedLocale>;

	/**
	 * Translate a key.  If the key is missing in the current locale, returns
	 * the English value.  If the key is missing entirely, returns `fallback`
	 * (or the key itself if no fallback is provided).
	 */
	t(key: TranslationKey, fallback?: string): string;

	/** Change the active locale and persist the selection */
	setLocale(locale: SupportedLocale): void;
}

// allow-any-unicode-next-line
// ─── English master dictionary ────────────────────────────────────────────────
// allow-any-unicode-next-line
// All keys must be defined here.  Other locales are a subset — missing keys
// automatically fall back to these values.

export const EN_TRANSLATIONS = {
	// allow-any-unicode-next-line
	// ── Onboarding ──────────────────────────────────────────────────────────
	'onboarding.title': 'Welcome to CortexIDE',
	// allow-any-unicode-next-line
	'onboarding.subtitle': 'Open-source AI IDE — works 100% offline',
	'onboarding.chooseLocal': 'Set up local AI (runs on your machine)',
	'onboarding.chooseCloud': 'Connect a cloud provider (OpenAI, Anthropic, etc.)',
	'onboarding.chooseLater': 'Skip for now',
	'onboarding.localDescription': 'Your code never leaves your computer. Requires ~8 GB RAM minimum.',
	'onboarding.cloudDescription': 'Use powerful cloud models. Requires an API key.',
	'onboarding.systemCheck': 'Checking your system…',
	'onboarding.installingOllama': 'Installing Ollama…',
	'onboarding.downloadingModel': 'Downloading model…',
	'onboarding.setupComplete': 'Setup complete!',
	'onboarding.recommendedModel': 'Recommended for your hardware',
	'onboarding.vramDetected': 'Detected GPU memory',
	'onboarding.selectModelPack': 'Choose a model pack',
	// allow-any-unicode-next-line
	'onboarding.modelPack.fast': 'Fast (7B) — Best for 8 GB RAM/VRAM',
	// allow-any-unicode-next-line
	'onboarding.modelPack.balanced': 'Balanced (14B) — Best for 16 GB RAM/VRAM',
	// allow-any-unicode-next-line
	'onboarding.modelPack.powerful': 'Powerful (22B) — Best for 24 GB+ VRAM',
	// allow-any-unicode-next-line
	'onboarding.modelPack.reasoning': 'Reasoning (16B MoE) — Deep thinking, 12 GB VRAM',
	'onboarding.startGuided': 'Start guided setup',
	'onboarding.startApp': 'Start with CortexIDE',
	'onboarding.settingsAndThemes': 'Settings and Themes',
	'onboarding.transferSettings': 'Transfer your settings from an existing editor?',
	'onboarding.welcome': 'Welcome',
	'onboarding.headline': 'Build with the editor AI actually ships in',

	// allow-any-unicode-next-line
	// ── Express onboarding (zero-friction path) ───────────────────────────────
	'express.title': 'Setting up local AI…',
	'express.subtitle': 'CortexIDE is preparing your private, on-device coding assistant.',
	'express.detecting': 'Detecting your hardware…',
	'express.detected': 'Detected {0} GB of GPU memory.',
	'express.detectedNoGPU': 'No discrete GPU detected — using a small model.',
	'express.installPromptTitle': 'Install Ollama?',
	'express.installPromptBody': 'CortexIDE will install Ollama, the local AI runtime, to run models privately on your computer. No data leaves your device.',
	'express.installConfirm': 'Install Ollama',
	'express.installDecline': 'Use a free cloud key instead',
	'express.installing': 'Installing Ollama…',
	'express.pulling': 'Downloading {0}…',
	'express.pullingPercent': 'Downloading {0} ({1}%)',
	'express.ready': 'Ready! Local AI is set up.',
	'express.startChatting': 'Start chatting',
	'express.customize': 'Customize setup',
	'express.fallbackTitle': 'Use a free cloud model',
	'express.fallbackBody': 'No local install needed. Groq offers a free API tier with fast Llama models. Get a key (takes 60 seconds), paste it below, and you are ready.',
	'express.openGroqKeyPage': 'Open Groq key page',
	'express.pasteKeyPlaceholder': 'Paste your Groq API key here (starts with gsk_…)',
	'express.useGroqKey': 'Continue with Groq',
	'express.invalidKey': 'That key does not look right. Groq keys start with "gsk_".',
	'express.error.installFailed': 'Ollama install failed. You can use a free cloud key instead.',
	'express.error.pullFailed': 'Model download failed. You can retry or use a free cloud key instead.',
	'express.retry': 'Retry',
	'express.useCloudInstead': 'Use a free cloud key instead',
	'express.dismiss': 'Skip for now',

	// allow-any-unicode-next-line
	// ── Chat / Sidebar ───────────────────────────────────────────────────────
	'chat.placeholder': 'Ask CortexIDE anything…',
	'chat.placeholderAgent': 'Describe a task for the agent…',
	'chat.newThread': 'New chat',
	'chat.history': 'Chat history',
	'chat.branchFromHere': 'Branch from here',
	'chat.copyMessage': 'Copy',
	'chat.deleteThread': 'Delete thread',
	'chat.duplicateThread': 'Duplicate thread',
	'chat.thinking': 'Thinking…',
	'chat.generating': 'Generating…',
	'chat.stop': 'Stop',
	'chat.send': 'Send',
	'chat.attachFile': 'Attach file',
	'chat.attachImage': 'Attach image',
	'chat.contextFiles': 'Context files',
	'chat.addContext': 'Add context',
	'chat.mode.chat': 'Chat',
	'chat.mode.ask': 'Ask',
	'chat.mode.agent': 'Agent',
	'chat.mode.plan': 'Plan',
	'chat.mode.edit': 'Edit',
	'chat.mode.gather': 'Gather',
	'chat.model': 'Model',
	'chat.previousThreads': 'Previous Threads',
	'chat.suggestions': 'Suggestions',

	// allow-any-unicode-next-line
	// ── Agent Mode ────────────────────────────────────────────────────────────
	'agent.planStep': 'Planning',
	'agent.executeStep': 'Executing',
	'agent.approvalRequired': 'Approval required',
	'agent.approve': 'Approve',
	'agent.reject': 'Reject',
	'agent.toolCall': 'Tool call',
	'agent.readingFile': 'Reading file',
	'agent.editingFile': 'Editing file',
	'agent.runningCommand': 'Running command',
	'agent.searchingCodebase': 'Searching codebase',
	'agent.steps': 'Steps',
	'agent.done': 'Done',
	'agent.failed': 'Failed',

	// allow-any-unicode-next-line
	// ── Diff / Code edits ─────────────────────────────────────────────────────
	'diff.acceptAll': 'Accept all',
	'diff.rejectAll': 'Reject all',
	'diff.acceptHunk': 'Accept hunk',
	'diff.rejectHunk': 'Reject hunk',
	'diff.nextHunk': 'Next change',
	'diff.prevHunk': 'Previous change',

	// allow-any-unicode-next-line
	// ── Settings ──────────────────────────────────────────────────────────────
	'settings.title': 'CortexIDE Settings',
	'settings.providers': 'Providers',
	'settings.models': 'Models',
	'settings.local': 'Local Setup',
	'settings.localProviders': 'Local Providers',
	'settings.mainProviders': 'Main Providers',
	'settings.featureOptions': 'Feature Options',
	'settings.allSettings': 'All Settings',
	'settings.mcp': 'MCP Servers',
	'settings.mcpShort': 'MCP',
	'settings.general': 'General',
	'settings.language': 'Display language',
	'settings.save': 'Save',
	'settings.saved': 'Saved',
	'settings.apiKey': 'API Key',
	'settings.endpoint': 'Endpoint URL',
	'settings.addModel': 'Add model',
	'settings.removeModel': 'Remove',
	'settings.enableProvider': 'Enable provider',

	// allow-any-unicode-next-line
	// ── Rules ─────────────────────────────────────────────────────────────────
	'rules.title': 'Project Rules',
	'rules.description': 'Rules defined in .cortexide/rules/*.md are injected into every agent session.',
	'rules.noRules': 'No rules defined yet',
	'rules.createRule': 'Create rule file',
	'rules.openRulesDir': 'Open rules directory',

	// allow-any-unicode-next-line
	// ── Local models ──────────────────────────────────────────────────────────
	'local.ollama.notRunning': 'Ollama is not running',
	'local.ollama.start': 'Start Ollama',
	'local.ollama.install': 'Install Ollama',
	'local.model.downloading': 'Downloading',
	'local.model.ready': 'Ready',
	'local.model.notFound': 'Model not found',
	'local.model.pull': 'Download model',

	// allow-any-unicode-next-line
	// ── Common ────────────────────────────────────────────────────────────────
	'common.cancel': 'Cancel',
	'common.confirm': 'Confirm',
	'common.loading': 'Loading…',
	'common.error': 'Error',
	'common.retry': 'Retry',
	'common.close': 'Close',
	'common.back': 'Back',
	'common.next': 'Next',
	'common.skip': 'Skip',
	'common.done': 'Done',
	'common.copy': 'Copy',
	'common.copied': 'Copied!',
	'common.open': 'Open',

	// allow-any-unicode-next-line
	// ── Routing / free-tier router ───────────────────────────────────────────
	'routing.policy.label': 'Routing policy',
	'routing.policy.description': 'Controls how CortexIDE picks between configured model providers.',
	'routing.policy.autoCheapest': 'Auto (cheapest viable)',
	'routing.policy.freeTier': 'Free-tier ladder',
	'routing.policy.localOnly': 'Local only',
	'routing.statusBar.label': 'Free-tier quota',
	'routing.statusBar.none': 'No free-tier providers',
	'routing.statusBar.entry': '{0}: {1}/{2} RPD',
	'routing.statusBar.entryRpm': '{0}: {1}/{2} RPM',
	'routing.statusBar.exhausted': '{0}: exhausted',
	'routing.statusBar.uncapped': '{0}: uncapped',
	'routing.statusBar.tooltipTitle': 'Free-tier provider quotas',
	'routing.statusBar.tooltipNoProviders': 'No free-tier providers are configured. Add a free-tier API key (Groq, Gemini, OpenRouter, Mistral) to see live quota tracking.',
	'routing.statusBar.allExhausted': 'Free quota exhausted',
	'routing.statusBar.allExhaustedHint': 'All free-tier quotas exhausted — switch to a local model or add an API key.',
} as const;

// allow-any-unicode-next-line
// ─── locale bundles ───────────────────────────────────────────────────────────
// allow-any-unicode-next-line
// Partial translations — missing keys fall back to EN_TRANSLATIONS at runtime.

const ZH_TRANSLATIONS: Partial<Record<TranslationKey, string>> = {
	// allow-any-unicode-next-line
	'onboarding.title': '欢迎使用 CortexIDE',
	// allow-any-unicode-next-line
	'onboarding.subtitle': '开源 AI IDE — 完全离线运行',
	// allow-any-unicode-next-line
	'onboarding.chooseLocal': '设置本地 AI（在您的设备上运行）',
	// allow-any-unicode-next-line
	'onboarding.chooseCloud': '连接云服务提供商（OpenAI、Anthropic 等）',
	// allow-any-unicode-next-line
	'onboarding.chooseLater': '稍后设置',
	// allow-any-unicode-next-line
	'chat.placeholder': '向 CortexIDE 提问…',
	// allow-any-unicode-next-line
	'chat.newThread': '新建对话',
	// allow-any-unicode-next-line
	'chat.thinking': '正在思考…',
	// allow-any-unicode-next-line
	'chat.stop': '停止',
	// allow-any-unicode-next-line
	'chat.send': '发送',
	// allow-any-unicode-next-line
	'chat.mode.chat': '对话',
	// allow-any-unicode-next-line
	'chat.mode.agent': '智能体',
	// allow-any-unicode-next-line
	'chat.mode.edit': '编辑',
	// allow-any-unicode-next-line
	'diff.acceptAll': '接受全部',
	// allow-any-unicode-next-line
	'diff.rejectAll': '拒绝全部',
	// allow-any-unicode-next-line
	'settings.title': 'CortexIDE 设置',
	// allow-any-unicode-next-line
	'settings.language': '显示语言',
	// allow-any-unicode-next-line
	'common.cancel': '取消',
	// allow-any-unicode-next-line
	'common.loading': '加载中…',
	// allow-any-unicode-next-line
	'common.error': '错误',
	// allow-any-unicode-next-line
	'common.close': '关闭',
	// allow-any-unicode-next-line
	'common.done': '完成',
	// allow-any-unicode-next-line
	'common.copy': '复制',
	// allow-any-unicode-next-line
	'common.copied': '已复制！',
};

const ES_TRANSLATIONS: Partial<Record<TranslationKey, string>> = {
	'onboarding.title': 'Bienvenido a CortexIDE',
	// allow-any-unicode-next-line
	'onboarding.subtitle': 'IDE de IA de código abierto — funciona 100% sin conexión',
	// allow-any-unicode-next-line
	'onboarding.chooseLocal': 'Configurar IA local (se ejecuta en tu máquina)',
	'onboarding.chooseCloud': 'Conectar un proveedor en la nube',
	'onboarding.chooseLater': 'Omitir por ahora',
	// allow-any-unicode-next-line
	'chat.placeholder': 'Pregúntale algo a CortexIDE…',
	'chat.newThread': 'Nuevo chat',
	'chat.thinking': 'Pensando…',
	'chat.stop': 'Detener',
	'chat.send': 'Enviar',
	'diff.acceptAll': 'Aceptar todo',
	'diff.rejectAll': 'Rechazar todo',
	// allow-any-unicode-next-line
	'settings.title': 'Configuración de CortexIDE',
	'settings.language': 'Idioma de la interfaz',
	'common.cancel': 'Cancelar',
	'common.loading': 'Cargando…',
	'common.error': 'Error',
	'common.close': 'Cerrar',
	'common.done': 'Hecho',
};

const FR_TRANSLATIONS: Partial<Record<TranslationKey, string>> = {
	'onboarding.title': 'Bienvenue dans CortexIDE',
	// allow-any-unicode-next-line
	'onboarding.subtitle': 'IDE IA open source — fonctionne 100% hors ligne',
	// allow-any-unicode-next-line
	'onboarding.chooseLocal': 'Configurer l\'IA locale (s\'exécute sur votre machine)',
	'onboarding.chooseCloud': 'Connecter un fournisseur cloud',
	'onboarding.chooseLater': 'Ignorer pour l\'instant',
	// allow-any-unicode-next-line
	'chat.placeholder': 'Demandez quelque chose à CortexIDE…',
	'chat.newThread': 'Nouveau chat',
	// allow-any-unicode-next-line
	'chat.thinking': 'Réflexion en cours…',
	// allow-any-unicode-next-line
	'chat.stop': 'Arrêter',
	'chat.send': 'Envoyer',
	'diff.acceptAll': 'Tout accepter',
	'diff.rejectAll': 'Tout rejeter',
	// allow-any-unicode-next-line
	'settings.title': 'Paramètres de CortexIDE',
	'settings.language': 'Langue d\'affichage',
	'common.cancel': 'Annuler',
	'common.loading': 'Chargement…',
	'common.error': 'Erreur',
	'common.close': 'Fermer',
	// allow-any-unicode-next-line
	'common.done': 'Terminé',
};

const DE_TRANSLATIONS: Partial<Record<TranslationKey, string>> = {
	'onboarding.title': 'Willkommen bei CortexIDE',
	// allow-any-unicode-next-line
	'onboarding.subtitle': 'Open-Source KI-IDE — funktioniert 100% offline',
	// allow-any-unicode-next-line
	'onboarding.chooseLocal': 'Lokale KI einrichten (läuft auf Ihrem Gerät)',
	'onboarding.chooseCloud': 'Cloud-Anbieter verbinden',
	// allow-any-unicode-next-line
	'onboarding.chooseLater': 'Jetzt überspringen',
	'chat.placeholder': 'Stellen Sie CortexIDE eine Frage…',
	'chat.newThread': 'Neuer Chat',
	'chat.thinking': 'Denke nach…',
	'chat.stop': 'Stoppen',
	'chat.send': 'Senden',
	'diff.acceptAll': 'Alle akzeptieren',
	'diff.rejectAll': 'Alle ablehnen',
	'settings.title': 'CortexIDE Einstellungen',
	'settings.language': 'Anzeigesprache',
	'common.cancel': 'Abbrechen',
	'common.loading': 'Wird geladen…',
	'common.error': 'Fehler',
	// allow-any-unicode-next-line
	'common.close': 'Schließen',
	'common.done': 'Fertig',
};

const JA_TRANSLATIONS: Partial<Record<TranslationKey, string>> = {
	// allow-any-unicode-next-line
	'onboarding.title': 'CortexIDE へようこそ',
	// allow-any-unicode-next-line
	'onboarding.subtitle': 'オープンソース AI IDE — 完全オフラインで動作',
	// allow-any-unicode-next-line
	'onboarding.chooseLocal': 'ローカル AI を設定する（お使いのマシンで実行）',
	// allow-any-unicode-next-line
	'onboarding.chooseCloud': 'クラウドプロバイダーに接続する',
	// allow-any-unicode-next-line
	'onboarding.chooseLater': '後で設定する',
	// allow-any-unicode-next-line
	'chat.placeholder': 'CortexIDE に質問してください…',
	// allow-any-unicode-next-line
	'chat.newThread': '新しいチャット',
	// allow-any-unicode-next-line
	'chat.thinking': '考え中…',
	// allow-any-unicode-next-line
	'chat.stop': '停止',
	// allow-any-unicode-next-line
	'chat.send': '送信',
	// allow-any-unicode-next-line
	'diff.acceptAll': 'すべて承認',
	// allow-any-unicode-next-line
	'diff.rejectAll': 'すべて拒否',
	// allow-any-unicode-next-line
	'settings.title': 'CortexIDE 設定',
	// allow-any-unicode-next-line
	'settings.language': '表示言語',
	// allow-any-unicode-next-line
	'common.cancel': 'キャンセル',
	// allow-any-unicode-next-line
	'common.loading': '読み込み中…',
	// allow-any-unicode-next-line
	'common.error': 'エラー',
	// allow-any-unicode-next-line
	'common.close': '閉じる',
	// allow-any-unicode-next-line
	'common.done': '完了',
};

const KO_TRANSLATIONS: Partial<Record<TranslationKey, string>> = {
	// allow-any-unicode-next-line
	'onboarding.title': 'CortexIDE에 오신 것을 환영합니다',
	// allow-any-unicode-next-line
	'onboarding.subtitle': '오픈소스 AI IDE — 완전 오프라인 작동',
	// allow-any-unicode-next-line
	'onboarding.chooseLocal': '로컬 AI 설정 (내 컴퓨터에서 실행)',
	// allow-any-unicode-next-line
	'onboarding.chooseCloud': '클라우드 제공업체 연결',
	// allow-any-unicode-next-line
	'onboarding.chooseLater': '나중에 설정',
	// allow-any-unicode-next-line
	'chat.placeholder': 'CortexIDE에 무엇이든 물어보세요…',
	// allow-any-unicode-next-line
	'chat.newThread': '새 채팅',
	// allow-any-unicode-next-line
	'chat.thinking': '생각 중…',
	// allow-any-unicode-next-line
	'chat.stop': '중지',
	// allow-any-unicode-next-line
	'chat.send': '전송',
	// allow-any-unicode-next-line
	'diff.acceptAll': '모두 승인',
	// allow-any-unicode-next-line
	'diff.rejectAll': '모두 거부',
	// allow-any-unicode-next-line
	'settings.title': 'CortexIDE 설정',
	// allow-any-unicode-next-line
	'settings.language': '표시 언어',
	// allow-any-unicode-next-line
	'common.cancel': '취소',
	// allow-any-unicode-next-line
	'common.loading': '로딩 중…',
	// allow-any-unicode-next-line
	'common.error': '오류',
	// allow-any-unicode-next-line
	'common.close': '닫기',
	// allow-any-unicode-next-line
	'common.done': '완료',
};

const PT_TRANSLATIONS: Partial<Record<TranslationKey, string>> = {
	'onboarding.title': 'Bem-vindo ao CortexIDE',
	// allow-any-unicode-next-line
	'onboarding.subtitle': 'IDE de IA de código aberto — funciona 100% offline',
	'onboarding.chooseLocal': 'Configurar IA local (executa no seu computador)',
	'onboarding.chooseCloud': 'Conectar um provedor cloud',
	'onboarding.chooseLater': 'Pular por enquanto',
	'chat.placeholder': 'Pergunte algo ao CortexIDE…',
	'chat.newThread': 'Novo chat',
	'chat.thinking': 'Pensando…',
	'chat.stop': 'Parar',
	'chat.send': 'Enviar',
	'diff.acceptAll': 'Aceitar tudo',
	'diff.rejectAll': 'Rejeitar tudo',
	// allow-any-unicode-next-line
	'settings.title': 'Configurações do CortexIDE',
	// allow-any-unicode-next-line
	'settings.language': 'Idioma de exibição',
	'common.cancel': 'Cancelar',
	'common.loading': 'Carregando…',
	'common.error': 'Erro',
	'common.close': 'Fechar',
	// allow-any-unicode-next-line
	'common.done': 'Concluído',
};

const AR_TRANSLATIONS: Partial<Record<TranslationKey, string>> = {
	// allow-any-unicode-next-line
	'onboarding.title': 'مرحبًا بك في CortexIDE',
	// allow-any-unicode-next-line
	'onboarding.subtitle': 'بيئة تطوير مفتوحة المصدر — تعمل بالكامل دون اتصال',
	// allow-any-unicode-next-line
	'onboarding.chooseLocal': 'إعداد الذكاء الاصطناعي المحلي',
	// allow-any-unicode-next-line
	'onboarding.chooseCloud': 'الاتصال بمزود سحابي',
	// allow-any-unicode-next-line
	'onboarding.chooseLater': 'تخطي الآن',
	// allow-any-unicode-next-line
	'chat.placeholder': 'اسأل CortexIDE أي شيء…',
	// allow-any-unicode-next-line
	'chat.newThread': 'محادثة جديدة',
	// allow-any-unicode-next-line
	'chat.thinking': 'جارٍ التفكير…',
	// allow-any-unicode-next-line
	'chat.stop': 'إيقاف',
	// allow-any-unicode-next-line
	'chat.send': 'إرسال',
	// allow-any-unicode-next-line
	'common.cancel': 'إلغاء',
	// allow-any-unicode-next-line
	'common.loading': 'جارٍ التحميل…',
	// allow-any-unicode-next-line
	'common.error': 'خطأ',
	// allow-any-unicode-next-line
	'common.close': 'إغلاق',
	// allow-any-unicode-next-line
	'common.done': 'تم',
};

const RU_TRANSLATIONS: Partial<Record<TranslationKey, string>> = {
	// allow-any-unicode-next-line
	'onboarding.title': 'Добро пожаловать в CortexIDE',
	// allow-any-unicode-next-line
	'onboarding.subtitle': 'ИИ-IDE с открытым исходным кодом — работает полностью офлайн',
	// allow-any-unicode-next-line
	'onboarding.chooseLocal': 'Настроить локальный ИИ',
	// allow-any-unicode-next-line
	'onboarding.chooseCloud': 'Подключить облачного провайдера',
	// allow-any-unicode-next-line
	'onboarding.chooseLater': 'Пропустить',
	// allow-any-unicode-next-line
	'chat.placeholder': 'Спросите что-нибудь у CortexIDE…',
	// allow-any-unicode-next-line
	'chat.newThread': 'Новый чат',
	// allow-any-unicode-next-line
	'chat.thinking': 'Думаю…',
	// allow-any-unicode-next-line
	'chat.stop': 'Стоп',
	// allow-any-unicode-next-line
	'chat.send': 'Отправить',
	// allow-any-unicode-next-line
	'common.cancel': 'Отмена',
	// allow-any-unicode-next-line
	'common.loading': 'Загрузка…',
	// allow-any-unicode-next-line
	'common.error': 'Ошибка',
	// allow-any-unicode-next-line
	'common.close': 'Закрыть',
	// allow-any-unicode-next-line
	'common.done': 'Готово',
};

const HI_TRANSLATIONS: Partial<Record<TranslationKey, string>> = {
	// allow-any-unicode-next-line
	'onboarding.title': 'CortexIDE में आपका स्वागत है',
	// allow-any-unicode-next-line
	'onboarding.subtitle': 'ओपन-सोर्स AI IDE — 100% ऑफलाइन काम करता है',
	// allow-any-unicode-next-line
	'onboarding.chooseLocal': 'लोकल AI सेटअप करें',
	// allow-any-unicode-next-line
	'onboarding.chooseCloud': 'क्लाउड प्रदाता से जुड़ें',
	// allow-any-unicode-next-line
	'onboarding.chooseLater': 'अभी छोड़ें',
	// allow-any-unicode-next-line
	'chat.placeholder': 'CortexIDE से कुछ भी पूछें…',
	// allow-any-unicode-next-line
	'chat.newThread': 'नई चैट',
	// allow-any-unicode-next-line
	'chat.thinking': 'सोच रहा हूँ…',
	// allow-any-unicode-next-line
	'chat.stop': 'रोकें',
	// allow-any-unicode-next-line
	'chat.send': 'भेजें',
	// allow-any-unicode-next-line
	'common.cancel': 'रद्द करें',
	// allow-any-unicode-next-line
	'common.loading': 'लोड हो रहा है…',
	// allow-any-unicode-next-line
	'common.error': 'त्रुटि',
	// allow-any-unicode-next-line
	'common.close': 'बंद करें',
	// allow-any-unicode-next-line
	'common.done': 'हो गया',
};

const LOCALE_BUNDLES: Record<SupportedLocale, Partial<Record<TranslationKey, string>>> = {
	en: EN_TRANSLATIONS,
	zh: ZH_TRANSLATIONS,
	es: ES_TRANSLATIONS,
	fr: FR_TRANSLATIONS,
	de: DE_TRANSLATIONS,
	ja: JA_TRANSLATIONS,
	ko: KO_TRANSLATIONS,
	pt: PT_TRANSLATIONS,
	ar: AR_TRANSLATIONS,
	ru: RU_TRANSLATIONS,
	hi: HI_TRANSLATIONS,
};

const STORAGE_KEY = 'cortexide.i18n.locale';

// allow-any-unicode-next-line
// ─── service implementation ───────────────────────────────────────────────────

class CortexideI18nService extends Disposable implements ICortexideI18nService {
	declare readonly _serviceBrand: undefined;

	private _locale: SupportedLocale;
	private readonly _onDidChangeLocale = this._register(new Emitter<SupportedLocale>());
	readonly onDidChangeLocale: Event<SupportedLocale> = this._onDidChangeLocale.event;

	constructor(
		@IStorageService private readonly storageService: IStorageService,
	) {
		super();

		// Resolve locale: user preference → VS Code locale → English
		const stored = storageService.get(STORAGE_KEY, StorageScope.PROFILE) as SupportedLocale | undefined;
		this._locale = stored && LOCALE_BUNDLES[stored] ? stored : this._detectLocale();
	}

	get locale(): SupportedLocale {
		return this._locale;
	}

	t(key: TranslationKey, fallback?: string): string {
		const bundle = LOCALE_BUNDLES[this._locale];
		if (bundle && key in bundle) {
			return (bundle as Record<string, string>)[key];
		}
		// Fall back to English
		if (key in EN_TRANSLATIONS) {
			return EN_TRANSLATIONS[key];
		}
		return fallback ?? key;
	}

	setLocale(locale: SupportedLocale): void {
		if (locale === this._locale) return;
		this._locale = locale;
		this.storageService.store(STORAGE_KEY, locale, StorageScope.PROFILE, StorageTarget.USER);
		this._onDidChangeLocale.fire(locale);
	}

	private _detectLocale(): SupportedLocale {
		// VS Code injects locale into window.navigator or via the `locale` global
		try {
			const lang = (globalThis as any).navigator?.language ?? 'en';
			const short = lang.split('-')[0].toLowerCase() as SupportedLocale;
			if (short in LOCALE_BUNDLES) return short;
		} catch { /* non-browser environment */ }
		return 'en';
	}
}

registerSingleton(ICortexideI18nService, CortexideI18nService, InstantiationType.Delayed);
