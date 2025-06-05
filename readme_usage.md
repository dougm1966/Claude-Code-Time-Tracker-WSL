# Quick Command Reference

## Basic Commands

```bash
# Start session tracking
node scripts/session-tracker.js start

# Check current status
node scripts/session-tracker.js status

# End current session
node scripts/session-tracker.js end

# Run diagnostics
node scripts/session-tracker.js check
```

## Timer Modes

```bash
# Standard 5-hour Claude Code session (default)
node scripts/session-tracker.js start --mode claude-max

# Pomodoro: 25min work + 5min break
node scripts/session-tracker.js start --mode pomodoro

# Deep work: 90min focused sessions
node scripts/session-tracker.js start --mode deep-work

# Quick fixes: 15min bursts
node scripts/session-tracker.js start --mode quick-fix

# Custom duration (in minutes)
node scripts/session-tracker.js start --mode custom --duration 45
```

## Session Tags

```bash
# Add tags to categorize your work
node scripts/session-tracker.js start --tags "feature,urgent"
node scripts/session-tracker.js start --mode pomodoro --tags "bugfix,frontend"
```

## Data Export

```bash
# Export to CSV
node scripts/session-tracker.js export --format csv --output ./sessions

# Export to JSON
node scripts/session-tracker.js export --format json --output ./data

# Export to Markdown report
node scripts/session-tracker.js export --format markdown --output ./report

# Export all formats at once
node scripts/session-tracker.js export --format all --output ./complete-export

# Export last 7 days only
node scripts/session-tracker.js export --format csv --output ./week --range 7
```

## Auto-Detection

```bash
# Monitor Claude Code's session files automatically
node scripts/session-tracker.js auto
```

## Configuration

```bash
# View current config
node scripts/session-tracker.js config list

# Enable auto-detection
node scripts/session-tracker.js config set sessions.autoDetect true

# Change max session hours
node scripts/session-tracker.js config set sessions.maxHours 4

# Reset to defaults
node scripts/session-tracker.js config reset
```

## Project Utilities

```bash
# Detect current project info
node scripts/session-tracker.js project detect

# Show project summary
node scripts/session-tracker.js project info

# Detect specific path
node scripts/session-tracker.js project detect /path/to/project
```

## Global Installation (Optional)

```bash
# Install globally
./install-global.sh

# Then use from anywhere:
claude-start    # Full startup with diagnostics
claude-status   # Check session status
claude-end      # End current session
claude-check    # Run diagnostics
```

## Examples

```bash
# Start a focused coding session with tags
node scripts/session-tracker.js start --mode deep-work --tags "refactor,backend"

# Quick 15-minute bug fix
node scripts/session-tracker.js start --mode quick-fix --tags "hotfix"

# Custom 2-hour session for documentation
node scripts/session-tracker.js start --mode custom --duration 120 --tags "docs"

# Export last month's data to all formats
node scripts/session-tracker.js export --format all --output ./monthly-report --range 30
```