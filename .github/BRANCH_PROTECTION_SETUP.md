# Branch Protection Setup Instructions

This document provides **exact instructions** for configuring GitHub branch protection rules to enforce the regression guard system.

## Prerequisites

- You must be an organization owner or have admin access to the repository
- Required checks must be running successfully in at least one PR before enabling

---

## Repository: `cortexide`

### Step 1: Navigate to Branch Protection Settings

1. Go to: `https://github.com/OpenCortexIDE/cortexide/settings/branches`
2. Click **"Add rule"** or edit the existing rule for `main`

### Step 2: Configure Branch Name Pattern

- **Branch name pattern:** `main`

### Step 3: Enable Required Status Checks

✅ **Check:** "Require status checks to pass before merging"

✅ **Check:** "Require branches to be up to date before merging"

**Required status checks (add these exact names):**
- `lint`
- `typecheck`
- `test-unit`
- `build-compile`
- `smoke-headless`
- `e2e-sanity` (at least Linux)

**Note:** You may see additional checks from existing workflows. You can keep those or make them optional.

### Step 4: Require Pull Request Reviews

✅ **Check:** "Require pull request reviews before merging"
- **Required approving reviews:** `1`
- ✅ **Check:** "Dismiss stale reviews when new commits are pushed"
- ✅ **Check:** "Require review from Code Owners" (if CODEOWNERS is configured)

### Step 5: Restrict Pushes

✅ **Check:** "Restrict pushes that create matching branches"
- Only allow specific people/teams with write access

### Step 6: Additional Options (Recommended)

✅ **Check:** "Require linear history" (optional but recommended)
- Prevents merge commits, enforces rebase/squash

✅ **Check:** "Include administrators"
- Even admins must follow these rules

### Step 7: Save

Click **"Create"** or **"Save changes"**

---

## Repository: `cortexide-website`

### Branch Protection for `main`

1. Go to: `https://github.com/OpenCortexIDE/cortexide-website/settings/branches`
2. Create rule for `main`

**Required status checks:**
- `lint`
- `typecheck`
- `build`

**Other settings:** Same as above (PR reviews, restrict pushes, etc.)

---

## Repository: `cortexide-builder`

### Branch Protection for `main`

1. Go to: `https://github.com/OpenCortexIDE/cortexide-builder/settings/branches`
2. Create rule for `main`

**Required status checks:**
- `validate-manifest`
- `validate-version`

---

## Repository: `cortexide-binaries`

### Branch Protection for `main`

1. Go to: `https://github.com/OpenCortexIDE/cortexide-binaries/settings/branches`
2. Create rule for `main`

**Required status checks:**
- `validate-checksums`
- `validate-integrity`
- `validate-version-format`

---

## Repository: `cortexide-versions`

### Branch Protection for `main`

1. Go to: `https://github.com/OpenCortexIDE/cortexide-versions/settings/branches`
2. Create rule for `main`

**Required status checks:**
- `validate-version-format`
- `validate-monotonic`
- `validate-checksums`
- `validate-links`

---

## Verification

After setting up branch protection:

1. Create a test PR that intentionally fails a check
2. Verify the PR cannot be merged (merge button should be disabled)
3. Fix the check
4. Verify the PR can now be merged

---

## Troubleshooting

### "Required status check not found"

- The check must have run at least once in a PR
- Check name must match exactly (case-sensitive)
- Wait a few minutes after the workflow runs

### "Branch is not up to date"

- This is expected behavior
- PR author must update their branch (rebase/merge)

### "Can't dismiss required reviews"

- Ensure "Dismiss stale reviews" is enabled
- Admins can manually dismiss if needed

---

## Emergency Override

If you need to bypass branch protection (emergency only):

1. Go to branch protection settings
2. Temporarily disable the rule
3. Perform the merge
4. **Immediately re-enable** the rule

**Document the reason for the override** in a GitHub issue or team chat.

---

## Code Owners

Update `.github/CODEOWNERS` to require reviews for critical paths:

```
# Build and release infrastructure
.github/workflows/** @OpenCortexIDE/maintainers
build/** @OpenCortexIDE/maintainers
scripts/** @OpenCortexIDE/maintainers

# Core application code
src/vs/workbench/contrib/cortexide/** @OpenCortexIDE/core-team
```

Replace `@OpenCortexIDE/maintainers` and `@OpenCortexIDE/core-team` with actual team names or usernames.

---

**Last Updated:** 2025-01-27

