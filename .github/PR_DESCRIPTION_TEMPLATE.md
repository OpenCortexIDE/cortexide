# Regression Guard System Implementation

## Overview

This PR implements a comprehensive regression guard system across the CortexIDE organization. It adds **hard gates** that prevent regressions from being merged or released.

## What's Included

### ✅ Required Checks (Gateable Jobs)

All PRs to `main` must pass these checks:

1. **`lint`** - ESLint validation
2. **`typecheck`** - TypeScript compilation + layer validation + security checks
3. **`test-unit`** - Node.js unit tests
4. **`build-compile`** - Build compilation + hygiene
5. **`smoke-headless`** - Headless launch smoke test
6. **`e2e-sanity`** - Playwright E2E sanity checks

### ✅ Local Developer Gates

- **Pre-commit hook:** Fast lint/format on staged files
- **Pre-push hook:** Typecheck + targeted tests
- **Verify script:** `./scripts/verify.sh` runs all CI checks locally
- **Escape hatch:** `SKIP_VERIFY=1` for maintainers (CI still blocks)

### ✅ Reusable Workflows

Created reusable workflows for:
- Node.js setup with caching
- Lint checks
- Typecheck
- Smoke tests
- E2E tests

### ✅ Post-Merge Packaging

- Cross-platform packaging workflow (Win/macOS/Linux)
- Checksum generation
- Artifact upload

### ✅ Documentation

- `REGRESSION_GUARD_AUDIT.md` - Gap analysis
- `REQUIRED_CHECKS_POLICY.md` - Policy definition
- `REGRESSION_GUARD_IMPLEMENTATION.md` - Implementation summary
- `.github/BRANCH_PROTECTION_SETUP.md` - Setup instructions

## Setup Required

### 1. Install Dependencies

```bash
npm install --save-dev lint-staged prettier
npx husky install
```

### 2. Set Up Branch Protection

Follow `.github/BRANCH_PROTECTION_SETUP.md` to:
- Enable required status checks
- Require PR reviews
- Restrict pushes to `main`

### 3. Update CODEOWNERS

Replace `@OpenCortexIDE/maintainers` in `.github/CODEOWNERS` with actual team names.

## Testing

### Local

```bash
# Run all checks
./scripts/verify.sh

# Test hooks
git commit -m "test"  # Pre-commit runs
git push              # Pre-push runs
```

### CI

1. Create a test PR
2. Verify all required checks run
3. Verify checks are gateable in branch protection

## Next Steps (Future PRs)

- [ ] Implement workflows for `cortexide-website`
- [ ] Implement validation for `cortexide-builder`
- [ ] Implement validation for `cortexide-binaries`
- [ ] Create and configure `cortexide-versions` repo
- [ ] Refine E2E test selectors based on actual UI
- [ ] Configure actual packaging commands

## Breaking Changes

None. This is additive only.

## Notes

- E2E tests may need selector adjustments based on actual CortexIDE UI
- Packaging workflow needs actual packaging commands configured
- Some checks may be marked as `continue-on-error: true` initially for stability

---

**See `REGRESSION_GUARD_IMPLEMENTATION.md` for full details.**

