# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Claude Code session tracker designed for WSL on Windows 11. It prevents work loss from 5-hour session timeouts by providing proactive warnings and tracking session usage.

## Core Architecture

### Main Components
- `scripts/session-tracker.js` - Core session tracking logic with Windows notification support
- `claude-session-start.sh` - WSL startup script with diagnostic checks
- `install-global.sh` - Global installation script that creates shell aliases
- `.claude-sessions.json` - Local session data storage (auto-created)

### Key Features
- Real-time session warnings (30min/10min before 5-hour expiry)
- Windows toast notifications via PowerShell from WSL
- Monthly session limit tracking (50 sessions/month)
- Claude Code authentication status monitoring
- Background process management with cleanup

## Commands

### Enhanced Session Tracker (v2.0.0)
```bash
# Basic commands
node scripts/session-tracker.js start [--mode MODE] [--duration MINUTES] [--tags TAG1,TAG2]
node scripts/session-tracker.js end
node scripts/session-tracker.js status

# Timer modes: claude-max, pomodoro, deep-work, quick-fix, custom
node scripts/session-tracker.js start --mode pomodoro
node scripts/session-tracker.js start --mode custom --duration 45

# Export capabilities
node scripts/session-tracker.js export --format csv --output ./my-sessions
node scripts/session-tracker.js export --format all --output ./report

# Auto-detection (monitors Claude's JSONL files)
node scripts/session-tracker.js auto

# Configuration management
node scripts/session-tracker.js config list
node scripts/session-tracker.js config set sessions.autoDetect true

# Project utilities
node scripts/session-tracker.js project detect
node scripts/session-tracker.js project info
```

### Legacy Commands
```bash
# Start comprehensive session with diagnostics
./claude-session-start.sh

# Install global aliases (creates ~/.claude-session-tracker/)
./install-global.sh
```

### Global Aliases (after installation)
```bash
claude-start    # Start Claude Code with full session tracking
claude-status   # Check current session status
claude-end      # End current session
claude-check    # Run diagnostic checks
```

### Session Management
- Sessions auto-expire after exactly 5 hours (MAX_SESSION_MS)
- Background warnings scheduled at 30min and 10min remaining
- Process cleanup on SIGINT for graceful shutdown
- Authentication status checked via `claude --version`

## Data Structure

### Enhanced Session Data (v2.0.0)
```javascript
{
  version: "2.0.0",
  sessions: [
    {
      id: "uuid",
      startTime: "ISO string",
      endTime: "ISO string or null",
      duration: "milliseconds or null",
      mode: "claude-max|pomodoro|deep-work|quick-fix|custom",
      workingDirectory: "path",
      project: {
        name: "project name",
        type: "node|python|rust|go|etc",
        path: "project path",
        git: {
          branch: "current branch",
          lastCommit: "short hash",
          lastCommitMessage: "commit message",
          remoteUrl: "git remote",
          hasUncommittedChanges: boolean
        },
        tags: ["custom", "tags"]
      },
      warnings: {
        "30min": boolean,
        "10min": boolean
      },
      tokens: {
        input: number,
        output: number,
        cacheCreate: number,
        cacheRead: number
      },
      environment: "WSL",
      claudeSessionId: "auto-detected ID",
      claudeCodeVersion: "version string"
    }
  ],
  totalUsage: "daily milliseconds",
  lastReset: "daily reset timestamp", 
  monthlySessionCount: "sessions this month",
  lastMonthReset: "monthly reset timestamp",
  autoDetection: {
    enabled: boolean,
    lastScan: "timestamp",
    activeSessions: []
  }
}
```

## WSL-Specific Features

### Windows Integration
- PowerShell toast notifications with fallback to system tray
- WSL path conversion via `wslpath -w`
- Windows username detection via `cmd.exe`
- Cross-platform notification handling

### Authentication Checks
- Monitors `~/.claude/` directory for config files
- Tests CLI accessibility with timeout
- Detects authentication artifacts (auth, session, token files)

## Development Notes

### Testing Session Tracker
```bash
# Quick status check
node scripts/session-tracker.js status

# Start session in foreground (for debugging)
node scripts/session-tracker.js start

# Test notifications
node scripts/session-tracker.js check
```

### Key Constants
- `MAX_HOURS = 5` - Claude Code session limit
- `WARNING_30_MIN / WARNING_10_MIN` - Warning thresholds
- `SESSION_FILE = '.claude-sessions.json'` - Local data file
- `CLAUDE_CONFIG_DIR = ~/.claude` - Claude Code config location

## Phase 1 Features (IMPLEMENTED)

### Auto-Detection via JSONL Monitoring
- Monitors `~/.claude/projects/*/` for new session files
- Parses token usage data from Claude's logs
- Automatically detects session start/end events
- Integrates with existing manual tracking

### Project Detection & Tracking
- Auto-detects project type from package.json, pyproject.toml, Cargo.toml, etc.
- Extracts Git branch, commit info, and change status
- Supports custom tags for session categorization
- Project-level time and resource tracking

### Multiple Timer Modes
- **Claude Max**: 5-hour sessions with 30min/10min warnings
- **Pomodoro**: 25min work + 5min break cycles
- **Deep Work**: 90min focused sessions with smart warnings
- **Quick Fix**: 15min burst mode for small tasks
- **Custom**: User-defined duration and warning intervals

### Export Capabilities
- CSV format for spreadsheet analysis
- JSON format with full metadata
- Markdown reports with charts and statistics
- Batch export to all formats simultaneously
- Date range filtering and project-specific exports

### Enhanced Configuration
- Centralized config management in `~/.claude-session-tracker/config.json`
- Runtime configuration changes via CLI
- Timer mode customization and creation
- Notification and auto-detection preferences

## Error Handling

- Graceful fallback for notification failures
- File I/O error logging to console
- Process cleanup on interruption
- Authentication status validation before operations