# CortexIDE Codebase Guide

This guide orients you to key areas changed or added for CortexIDE.

- Product metadata: `product.json`
- CLI wrappers: `scripts/cortex*.{sh,bat}` and shell completions in `resources/completions/`
- Linux packaging: `resources/linux/cortex.desktop`, `cortex-url-handler.desktop`, `cortex.appdata.xml`
- Provider configs: `resources/provider-config.example.json`
- LLM wiring: `src/vs/workbench/contrib/cortexide/*/llm*` (providers, settings, services)
- Settings UI: `src/vs/workbench/contrib/cortexide/browser/cortexideSettingsPane.ts`
- Chat and sidebar: `src/vs/workbench/contrib/cortexide/browser/sidebar*`

Note: Some internal identifiers may still use the `void` namespace in type names and interfaces for backward compatibility, but the folder structure uses `cortexide`.
