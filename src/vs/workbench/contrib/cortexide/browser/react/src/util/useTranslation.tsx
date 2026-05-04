/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt in the project root.
 *--------------------------------------------------------------------------------------*/

import { useCallback } from 'react';
import { TranslationKey, SUPPORTED_LOCALES } from '../../../../common/i18n/i18nService.js';
import { useAccessor, useLocale } from './services.js';

/**
 * React hook that provides a stable `t(key, fallback?)` translation function
 * and re-renders when the locale changes.
 *
 * Usage:
 * ```tsx
 * const { t, locale, setLocale } = useTranslation();
 * return <button>{t('common.cancel')}</button>
 * ```
 */
export function useTranslation() {
	const accessor = useAccessor()
	const i18nService = accessor.get('ICortexideI18nService')
	const locale = useLocale()

	const t = useCallback(
		(key: TranslationKey, fallback?: string): string => {
			return i18nService.t(key, fallback);
		},
		// re-memoize when locale changes so translated strings update
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[i18nService, locale]
	);

	const setLocale = useCallback(
		(newLocale: typeof locale) => {
			i18nService.setLocale(newLocale);
		},
		[i18nService]
	);

	return { t, locale, setLocale, supportedLocales: SUPPORTED_LOCALES };
}
