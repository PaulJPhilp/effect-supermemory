# SDK Compatibility Dashboard

**Last Updated:** Not yet generated

## Overall Status

📊 **Status:** Not yet analyzed
Run compatibility checks to generate status.

## SDK Version Tracking

No SDK metadata found. Run monitoring to track SDK versions.

## Quick Actions

```bash
# Check compatibility status
bun run compat:check

# View full compatibility report
bun run compat:report

# Monitor for SDK changes
bun run compat:monitor

# Run compatibility tests
bun run test:compatibility
```

## Reports

- [Compatibility Report](./compatibility-report.md) - Full compatibility analysis
- [Schema Validation](./schema-validation-report.md) - Type compatibility validation
- [SDK Changes](./sdk-change-report.md) - Recent SDK version changes

## Automated Monitoring

This dashboard is automatically updated by:
- **Daily Checks:** GitHub Actions runs daily at 2 AM UTC
- **On Push:** When SDK metadata or API specs change
- **Manual Trigger:** Via GitHub Actions workflow_dispatch

Breaking changes automatically create GitHub issues for review.

