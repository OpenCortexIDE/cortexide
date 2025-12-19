# Required Checks Policy - Regression Guard System

**This document defines the hard gates that prevent regressions from being merged or released.**

## Overview

This policy enforces **non-negotiable** checks that must pass before:
- Pull requests can be merged to `main`
- Releases can be published
- Artifacts can be distributed

**No exceptions.** If a check fails, the merge/release is blocked.

---

## Repository: `cortexide` (Main App)

### PR to `main` - Required Checks

These checks **MUST** pass before a PR can be merged:

#### 1. **Lint** (`lint`)
- **Command:** `npm run eslint`
- **Purpose:** Catches code style issues, potential bugs, and enforces coding standards
- **Failure:** Blocks merge
- **Timeout:** 10 minutes
- **Caching:** ESLint cache enabled

#### 2. **Typecheck** (`typecheck`)
- **Command:** `npm run compile-check-ts-native && npm run valid-layers-check && npm run vscode-dts-compile-check && npm run tsec-compile-check`
- **Purpose:** Ensures TypeScript compiles without errors, validates layer architecture, and security checks
- **Failure:** Blocks merge
- **Timeout:** 15 minutes
- **Caching:** TypeScript incremental build cache

#### 3. **Unit Tests** (`test-unit`)
- **Command:** `npm run test-node`
- **Purpose:** Validates core functionality doesn't break
- **Failure:** Blocks merge
- **Timeout:** 15 minutes
- **Caching:** Test results cache (if applicable)

#### 4. **Build Compilation** (`build-compile`)
- **Command:** `npm run compile` (in build/) + `npm run core-ci-pr`
- **Purpose:** Ensures code compiles and basic hygiene passes
- **Failure:** Blocks merge
- **Timeout:** 20 minutes
- **Caching:** Build cache, node_modules cache

#### 5. **Headless Launch Smoke** (`smoke-headless`)
- **Command:** `npm run smoketest-no-compile -- --headless --quick`
- **Purpose:** Validates app can launch without crashing
- **Failure:** Blocks merge
- **Timeout:** 5 minutes
- **Caching:** None (must run fresh)

#### 6. **E2E Sanity** (`e2e-sanity`)
- **Command:** Playwright suite (launch → open file → open chat → mock tool call)
- **Purpose:** Validates critical user flows work
- **Failure:** Blocks merge
- **Timeout:** 10 minutes
- **Caching:** Playwright browser cache

**Platform Coverage:**
- At minimum: Linux (fastest)
- Optional but recommended: macOS, Windows (can run in parallel)

### Post-Merge to `main` - Required Checks

These checks run **after** merge to `main`:

#### 7. **Full Packaging Matrix** (`package-all`)
- **Platforms:** Windows x64, macOS arm64, Linux x64
- **Purpose:** Ensures all platforms build successfully
- **Failure:** Blocks release (but doesn't block main branch)
- **Timeout:** 60 minutes per platform
- **Artifacts:** Uploaded to workflow artifacts

#### 8. **Extended E2E** (`e2e-extended`) - Optional/Nightly
- **Command:** Full Playwright suite
- **Purpose:** Comprehensive regression testing
- **Failure:** Logs warning, doesn't block (can be made required later)
- **Timeout:** 30 minutes
- **Schedule:** Nightly or on-demand

---

## Repository: `cortexide-website`

### PR to `main` - Required Checks

#### 1. **Lint** (`lint`)
- **Command:** `npm run lint`
- **Failure:** Blocks merge

#### 2. **Typecheck** (`typecheck`)
- **Command:** `npx tsc --noEmit`
- **Failure:** Blocks merge

#### 3. **Build** (`build`)
- **Command:** `npm run build`
- **Failure:** Blocks merge

#### 4. **Deploy Preview** (`deploy-preview`) - Optional but Recommended
- **Command:** Vercel/Netlify preview deployment
- **Failure:** Warns but doesn't block (can be made required)

---

## Repository: `cortexide-builder`

### PR to `main` - Required Checks

#### 1. **Manifest Validation** (`validate-manifest`)
- **Command:** Validate `product.json`, build scripts, patch files
- **Failure:** Blocks merge

#### 2. **Version Bump Logic** (`validate-version`)
- **Command:** Ensure version format is valid (semver)
- **Failure:** Blocks merge

### Release Workflow - Required Checks

#### 1. **Checksum Generation** (`generate-checksums`)
- **Command:** Generate SHA256 checksums for all artifacts
- **Failure:** Blocks release

#### 2. **Artifact Upload** (`upload-artifacts`)
- **Command:** Upload to `cortexide-binaries` release
- **Failure:** Blocks release

#### 3. **Version Update** (`update-versions`)
- **Command:** Update `cortexide-versions` with new version
- **Failure:** Blocks release

---

## Repository: `cortexide-binaries`

### PR/Release - Required Checks

#### 1. **Checksum Validation** (`validate-checksums`)
- **Command:** Verify all artifacts have matching checksums
- **Failure:** Blocks merge/release

#### 2. **Artifact Integrity** (`validate-integrity`)
- **Command:** Verify artifacts are not corrupted, can be extracted
- **Failure:** Blocks merge/release

#### 3. **Version Format** (`validate-version-format`)
- **Command:** Ensure version follows semver
- **Failure:** Blocks merge/release

---

## Repository: `cortexide-versions`

### PR to `main` - Required Checks

#### 1. **Version Format** (`validate-version-format`)
- **Command:** Ensure version is valid semver
- **Failure:** Blocks merge

#### 2. **Monotonic Increase** (`validate-monotonic`)
- **Command:** Ensure new version > current version
- **Failure:** Blocks merge

#### 3. **Checksum Match** (`validate-checksums`)
- **Command:** Verify checksums match artifacts in `cortexide-binaries`
- **Failure:** Blocks merge

#### 4. **Link Validation** (`validate-links`)
- **Command:** Verify download links point to existing artifacts
- **Failure:** Blocks merge

---

## Branch Protection Rules

**These must be configured in GitHub repository settings:**

### For `cortexide` (main branch)

1. **Require status checks to pass before merging:**
   - `lint`
   - `typecheck`
   - `test-unit`
   - `build-compile`
   - `smoke-headless`
   - `e2e-sanity` (at least Linux)

2. **Require branches to be up to date before merging:** ✅ Enabled

3. **Require pull request reviews before merging:**
   - At least 1 approval
   - Dismiss stale reviews when new commits are pushed: ✅ Enabled

4. **Restrict who can push to matching branches:**
   - Only organization members with write access

5. **Require linear history:** Optional (recommended)

### For `cortexide-website`, `cortexide-builder`, etc.

Similar rules apply with their respective required checks.

---

## Fork Safety

All PR checks must work **without secrets** for forks:
- ✅ Use `GITHUB_TOKEN` (automatically provided)
- ✅ Skip steps that require organization secrets
- ✅ Provide clear error messages if secrets are missing
- ✅ Allow maintainers to re-run workflows with secrets if needed

---

## Escape Hatches

### For Maintainers

1. **Local Development:**
   - `SKIP_VERIFY=1` environment variable bypasses local hooks
   - CI still blocks merge (no bypass)

2. **Emergency Fixes:**
   - Branch protection can be temporarily disabled by org admins
   - Must be re-enabled immediately after

3. **Flaky Tests:**
   - Retry logic built into workflows (3 attempts)
   - If still flaky, test must be fixed or made non-blocking

---

## Enforcement

- **GitHub Branch Protection:** Enforces required checks at merge time
- **GitHub Actions:** Runs checks and reports status
- **Local Hooks:** Prevents bad commits locally (can be bypassed with `SKIP_VERIFY=1`)

**No code changes can bypass these checks.** They are enforced at the GitHub level.

---

## Review and Updates

This policy should be reviewed:
- Quarterly
- When new critical paths are added
- When regressions slip through (policy gap analysis)

**Last Updated:** 2025-01-27

