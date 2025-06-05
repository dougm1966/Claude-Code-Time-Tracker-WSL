# Claude Code Session Tracker - Development Prompt

## Project Overview
I have a Claude Code session tracker that helps prevent 5-hour timeout work loss by providing proactive warnings (30min/10min before timeout). It's built for WSL on Windows 11 and currently works as a manual companion timer. I want to enhance it with auto-detection and advanced features.

## Current Implementation
- **Location**: `/Claude-Code-Time-Tracker-WSL/`
- **Main script**: `scripts/session-tracker.js` (Node.js)
- **Install script**: `install-global.sh` (creates aliases)
- **Startup script**: `claude-session-start.sh` (WSL launcher)
- **Data storage**: `~/.claude-session-tracker/`

## Current Features
1. Manual session tracking (start/stop)
2. Windows toast notifications via PowerShell from WSL
3. 30-minute and 10-minute warnings before 5-hour limit
4. Monthly session counting (50 session limit)
5. Working directory tracking
6. Claude authentication status checks
7. Global aliases: `claude-start`, `claude-status`, `claude-end`, `claude-check`

## Phase 1 Implementation Goals (Priority)

### 1. Auto-Detection via JSONL
Similar to how `ccusage` (https://github.com/ryoppippi/ccusage) reads Claude's logs:
- Monitor `~/.claude/*.jsonl` files for new sessions
- Auto-start tracking when Claude Code launches
- Parse token usage data for enhanced tracking
- Detect session end/timeout automatically

### 2. Project Detection & Tracking
- Auto-detect project name from:
  - `package.json` (Node projects)
  - `pyproject.toml` / `setup.py` (Python)
  - `.git/config` (any git repo)
  - Directory name (fallback)
- Track git branch and last commit hash
- Store project type (Node, Python, Web, etc.)
- Add user-defined tags to sessions

### 3. Export Capabilities
- Export session data to CSV format
- Export to JSON with full details
- Generate markdown reports
- Include: date, duration, project, warnings triggered, tokens used

### 4. Timer Modes
Add new timer modes beyond 5-hour Claude sessions:
- **Pomodoro**: 25min work + 5min break cycles
- **Deep Work**: 90min focused sessions
- **Quick Fix**: 15min burst mode
- **Custom**: User-defined duration

## Technical Requirements

### Enhanced Data Structure
```javascript
{
  "id": "session-uuid",
  "startTime": "2024-01-01T10:00:00Z",
  "endTime": null,
  "duration": null,
  "mode": "claude-max", // or "pomodoro", "deep-work", etc.
  "project": {
    "name": "my-project",
    "path": "/home/user/projects/my-project",
    "type": "node", // detected type
    "git": {
      "branch": "main",
      "lastCommit": "abc123"
    }
  },
  "tags": ["feature", "bug-fix"],
  "warnings": {
    "30min": false,
    "10min": false
  },
  "tokens": {
    "input": 0,
    "output": 0,
    "cacheCreate": 0,
    "cacheRead": 0
  },
  "claudeSessionId": "from-jsonl-if-available"
}
```

### File Structure
```
scripts/
├── session-tracker.js       # Main enhanced tracker
├── auto-detector.js        # JSONL monitoring module
├── project-detector.js     # Project info extraction
├── export-utils.js        # CSV/JSON/Markdown export
├── notification-manager.js # Enhanced notifications
└── config.js              # Configuration management
```

### Key Functions Needed
1. `monitorClaudeJSONL()` - Watch for new Claude sessions
2. `detectProjectInfo()` - Extract project metadata
3. `exportSessions()` - Generate reports in multiple formats
4. `createTimerMode()` - Support different timer templates
5. `parseJSONLEntry()` - Extract token usage from Claude logs

## Constraints & Notes
- Must work in WSL environment
- Windows notifications via PowerShell must continue working
- Maintain backward compatibility with existing data
- Global aliases should still work
- Keep manual mode as fallback option
- Consider future npm package distribution

## Current Pain Points to Solve
1. Manual start/stop is easy to forget
2. No visibility into which projects consume most time
3. Can't export data for time tracking tools
4. Only supports 5-hour Claude sessions
5. No token usage or cost tracking

## Success Criteria
- Auto-detects Claude Code sessions without manual intervention
- Accurately tracks project-level time and token usage
- Provides flexible timer modes for different work styles
- Exports data in formats useful for invoicing/reporting
- Maintains all current warning functionality

## Questions to Consider During Implementation
1. Should we use file watchers or polling for JSONL monitoring?
2. How to handle multiple simultaneous Claude windows?
3. Should project detection be synchronous or async?
4. Database (SQLite) vs JSON files for storage?
5. How to migrate existing session data?

Please implement Phase 1 features while maintaining the existing functionality. Start with auto-detection via JSONL monitoring, then add project detection, followed by export capabilities and timer modes.
