/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../../workbench/common/contributions.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions, ConfigurationScope, IConfigurationPropertySchema } from '../../../../platform/configuration/common/configurationRegistry.js';
import { CORTEXIDE_CONFIG_KEYS, CortexideConfigKeyDef, CortexideConfigScope } from './cortexideConfigKeys.js';

const scopeOf = (scope: CortexideConfigScope): ConfigurationScope => {
	switch (scope) {
		case 'application': return ConfigurationScope.APPLICATION;
		case 'resource': return ConfigurationScope.RESOURCE;
		case 'window':
		default: return ConfigurationScope.WINDOW;
	}
};

const toSchema = (def: CortexideConfigKeyDef): IConfigurationPropertySchema => {
	const schema: IConfigurationPropertySchema = {
		// honest, user-facing description sourced from the canonical key list
		description: def.experimental ? `(Experimental) ${def.description}` : def.description,
		default: def.default,
		scope: scopeOf(def.scope),
	};
	if (def.type === 'enum') {
		schema.type = 'string';
		schema.enum = def.enumValues ? [...def.enumValues] : undefined;
		if (def.enumDescriptions) { schema.enumDescriptions = [...def.enumDescriptions]; }
	} else {
		schema.type = def.type;
	}
	if (typeof def.minimum === 'number') { schema.minimum = def.minimum; }
	if (def.experimental) { schema.tags = ['experimental']; }
	return schema;
};

/**
 * Registers the CortexIDE configuration schema from the single source of truth in
 * `cortexideConfigKeys.ts`. Registering these keys makes them discoverable in the Settings
 * UI and gives them documented defaults; previously they were read by services but never
 * registered (invisible, no schema). The claim-verification test asserts that every key a
 * service reads is present in the canonical list this registration is built from.
 */
export class CortexideGlobalSettingsConfigurationContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.cortexideGlobalSettingsConfiguration';

	constructor() {
		super();

		const registry = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);

		const properties: Record<string, IConfigurationPropertySchema> = {};
		for (const def of CORTEXIDE_CONFIG_KEYS) {
			properties[def.key] = toSchema(def);
		}

		registry.registerConfiguration({
			id: 'cortexide',
			title: 'CortexIDE',
			type: 'object',
			properties,
		});
	}
}

// Register the contribution to be initialized early so the settings are registered before
// services read them.
registerWorkbenchContribution2(CortexideGlobalSettingsConfigurationContribution.ID, CortexideGlobalSettingsConfigurationContribution, WorkbenchPhase.BlockRestore);
