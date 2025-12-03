# Automated Monitoring System

## Overview

The automated monitoring system tracks changes in the official Supermemory SDK and ensures effect-supermemory maintains compatibility. It runs continuously via GitHub Actions and provides comprehensive reports.

## Components

### 1. Monitoring Script

**File:** `scripts/monitor-sdk-changes.ts`

Monitors the npm registry for new SDK versions and detects API changes:

```bash
# Check for SDK updates
bun run compat:monitor

# Force re-analysis
bun run compat:monitor --force
```

**Features:**
- Checks npm registry for latest SDK version
- Extracts API surface from new versions
- Compares with previous versions
- Detects breaking changes, additions, and modifications
- Updates metadata tracking

### 2. GitHub Actions Workflow

**File:** `.github/workflows/compatibility-check.yml`

Automated CI/CD pipeline that:

- **Runs Daily:** At 2 AM UTC via cron schedule
- **Triggers on Changes:** When SDK metadata or specs are updated
- **Manual Trigger:** Can be run manually with different check types
- **Runs Full Pipeline:**
  - Extract SDK API surface
  - Compare API surfaces
  - Extract and validate schemas
  - Monitor for SDK changes
  - Run compatibility tests
  - Generate dashboard

**Check Types:**
- `all` - Run all checks (default)
- `api-surface` - Only API surface extraction and comparison
- `schemas` - Only schema extraction and validation
- `monitoring` - Only SDK change monitoring
- `compatibility-tests` - Only run compatibility tests

### 3. Compatibility Dashboard

**File:** `docs/compatibility-dashboard.md`

Auto-generated dashboard showing:
- Overall compatibility status
- SDK version tracking
- Recent changes detected
- Compatibility breakdown
- Quick action commands

Generated automatically by:
```bash
bun run compat:dashboard
```

## How It Works

### Daily Monitoring Flow

1. **Version Check** (2 AM UTC daily)
   - Queries npm registry for latest SDK version
   - Compares with last analyzed version

2. **API Extraction** (if new version)
   - Downloads and installs new SDK version
   - Extracts API surface using `extract-sdk-api.ts`
   - Saves API snapshot for comparison

3. **Change Detection** (if new version)
   - Compares new API surface with previous
   - Detects breaking changes, additions, modifications
   - Runs compatibility comparison

4. **Report Generation**
   - Generates change report
   - Updates compatibility report
   - Generates dashboard

5. **Alerting** (if breaking changes)
   - Creates GitHub issue automatically
   - Labels with `breaking-change` and `compatibility`

### Change Detection

The system detects:

- **Breaking Changes:**
  - Removed operations
  - Signature changes
  - Type changes

- **Additions:**
  - New operations
  - New parameters
  - New types

- **Modifications:**
  - Parameter changes
  - Type modifications

### Compatibility Impact

When changes are detected, the system:

1. **Extracts new API surface**
2. **Runs compatibility comparison** to see impact
3. **Reports missing operations** that need implementation
4. **Flags type mismatches** that need fixing
5. **Creates actionable GitHub issue** with recommendations

## Reports Generated

### Change Report (`docs/sdk-change-report.md`)

Shows what changed in the SDK:
- Breaking changes (high priority)
- New additions
- Modifications
- Version comparison

### Compatibility Report (`docs/compatibility-report.md`)

Shows current compatibility status:
- Compatibility score (0-100%)
- Missing operations
- Type mismatches
- Parameter differences

### Dashboard (`docs/compatibility-dashboard.md`)

Unified view of all compatibility information:
- Overall status at a glance
- SDK version tracking
- Quick links to all reports
- Recommended actions

## GitHub Integration

### Automatic Issue Creation

When breaking changes are detected, the workflow:

1. **Checks for existing issues** to avoid duplicates
2. **Creates new issue** with:
   - Breaking change details
   - Version information
   - Recommended actions
   - Links to reports

3. **Labels appropriately:**
   - `compatibility`
   - `breaking-change`
   - `automated`

### PR Comments

When compatibility checks run on PRs:

- Comments on PR with compatibility score
- Lists missing operations
- Shows type mismatches
- Links to full reports in artifacts

### Artifacts

All reports are uploaded as GitHub Actions artifacts:
- Available for 90 days
- Named by run number
- Includes all JSON and Markdown reports

## Usage

### Manual Monitoring

```bash
# Check for SDK updates
bun run compat:monitor

# Force re-analysis
bun run compat:monitor --force

# Generate dashboard
bun run compat:dashboard
```

### Triggering Workflow

**Via GitHub UI:**
1. Go to Actions → SDK Compatibility Check
2. Click "Run workflow"
3. Select check type
4. Click "Run workflow"

**Via GitHub CLI:**
```bash
gh workflow run compatibility-check.yml -f check_type=all
```

### Viewing Reports

All reports are in the `docs/` directory:
- `compatibility-report.md` - Full compatibility analysis
- `sdk-change-report.md` - Recent SDK changes
- `compatibility-dashboard.md` - Unified dashboard

## Configuration

### Schedule

Daily checks run at 2 AM UTC. To change:
```yaml
schedule:
  - cron: '0 2 * * *'  # Change time here
```

### Retention

- **Artifacts:** 90 days
- **API Snapshots:** Last 10 versions
- **Metadata:** Persisted in repository

## Notifications

The system provides notifications via:

1. **GitHub Issues** - Breaking changes create issues
2. **PR Comments** - Compatibility status on PRs
3. **Artifacts** - All reports available for download
4. **Workflow Summary** - Summary in GitHub Actions UI

## Troubleshooting

### Monitoring Fails

If monitoring fails:
1. Check npm registry connectivity
2. Verify SDK package name is correct
3. Check if SDK version exists
4. Review error logs in workflow

### No Changes Detected

If changes aren't detected:
1. Verify new SDK version was actually released
2. Check metadata file for last analyzed version
3. Use `--force` flag to re-analyze

### Breaking Changes Not Creating Issues

If issues aren't created:
1. Check GitHub token permissions
2. Verify workflow has write access
3. Check for existing open issues with same version

## Future Enhancements

- [ ] Email notifications for breaking changes
- [ ] Slack/Discord webhook integration
- [ ] Historical compatibility trend charts
- [ ] Automated PR creation for fixes
- [ ] Compatibility badge generation

The automated monitoring system ensures effect-supermemory stays in sync with the official SDK!
