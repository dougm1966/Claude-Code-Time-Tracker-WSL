# 🚀 Claude Code Time Tracker for WSL/Windows

<div align="center">
  
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)
[![GitHub stars](https://img.shields.io/github/stars/dougm1966/Claude-Code-Time-Tracker-WSL?style=social)](https://github.com/dougm1966/Claude-Code-Time-Tracker-WSL/stargazers)
[![WSL2](https://img.shields.io/badge/WSL2-Compatible-blue)](https://docs.microsoft.com/en-us/windows/wsl/)
[![Node.js](https://img.shields.io/badge/Node.js-14%2B-brightgreen)](https://nodejs.org/)

A comprehensive session tracking system designed specifically for Claude Code on Windows 11 WSL environments. Prevents work loss from 5-hour session timeouts with proactive warnings, usage analytics, and Windows toast notifications.

</div>

## ✨ Features

### 🕐 Smart Session Management
- **5-hour session tracking** with proactive warnings at 30min and 10min remaining
- **Multiple timer modes**: Pomodoro (25min), Deep Work (90min), Quick Fix (15min), Custom
- **Auto-detection** of Claude Code sessions via JSONL monitoring
- **Background processing** with graceful cleanup

### 🪟 Windows Integration
- **Toast notifications** from WSL to Windows 11
- **System tray fallbacks** for notification reliability
- **Cross-platform path handling** with proper WSL integration

### 📊 Analytics & Tracking
- **Project auto-detection** (Node.js, Python, Rust, Go, etc.)
- **Git integration** (branch, commits, change status)
- **Token usage tracking** from Claude's session files
- **Monthly session limits** (50 sessions/month)
- **Daily usage summaries**

### 📤 Data Export
- **Multiple formats**: CSV, JSON, Markdown reports
- **Date range filtering** and project-specific exports
- **Comprehensive statistics** with charts and graphs
- **Batch export capabilities**

### ⚙️ Configuration
- **Centralized config management** in `~/.claude-session-tracker/config.json`
- **Runtime configuration changes** via CLI
- **Custom timer modes** and notification preferences
- **Auto-detection settings**

## 🚀 Quick Start

### Prerequisites
- **Windows 11** with WSL2 enabled
- **Node.js** installed in WSL
- **Claude Code CLI** (`npm install -g @anthropic-ai/claude-code`)

### Standard Installation
```bash
# 1. Clone the repository
git clone https://github.com/dougm1966/Claude-Code-Time-Tracker-WSL.git
cd Claude-Code-Time-Tracker-WSL

# 2. Ensure scripts are executable
chmod +x claude-session-start.sh install-global.sh

# 3. Test the installation
node scripts/session-tracker.js --help
```

### Global Installation (Optional)
```bash
# Install globally for use from any project directory
./install-global.sh

# Source your shell config
source ~/.bashrc  # or ~/.zshrc

# Now available everywhere:
claude-start
claude-status
claude-end
```

## 🎯 Usage

### Basic Session Tracking
```bash
# Start a standard 5-hour Claude Code session
node scripts/session-tracker.js start

# Start with comprehensive diagnostics
./claude-session-start.sh

# Check current session status
node scripts/session-tracker.js status

# End the current session
node scripts/session-tracker.js end
```

### Timer Modes
```bash
# Pomodoro: 25min work + 5min break cycles
node scripts/session-tracker.js start --mode pomodoro

# Deep Work: 90min focused sessions
node scripts/session-tracker.js start --mode deep-work

# Quick Fix: 15min burst mode
node scripts/session-tracker.js start --mode quick-fix

# Custom duration (45 minutes)
node scripts/session-tracker.js start --mode custom --duration 45

# Default Claude Code max (5 hours)
node scripts/session-tracker.js start --mode claude-max
```

### Project Tagging
```bash
# Add custom tags to categorize work
node scripts/session-tracker.js start --tags "feature,frontend,urgent"

# Combine with timer modes
node scripts/session-tracker.js start --mode pomodoro --tags "bugfix,backend"
```

### Global Commands (after installation)
| Command | Description |
|---------|-------------|
| `claude-start` | Full startup with diagnostics |
| `claude-status` | Check session status |
| `claude-end` | End current session |
| `claude-check` | Run diagnostics |

## ⚙️ Configuration

### Data Export & Analytics
```bash
# Export to CSV for spreadsheet analysis
node scripts/session-tracker.js export --format csv --output ./my-sessions

# Generate comprehensive Markdown report
node scripts/session-tracker.js export --format markdown --output ./report

# Export all formats simultaneously
node scripts/session-tracker.js export --format all --output ./complete-export

# Filter by date range (last 7 days)
node scripts/session-tracker.js export --format csv --output ./week --range 7

# Project-specific analytics
node scripts/session-tracker.js project info
```

### Configuration Management
```bash
# View current configuration
node scripts/session-tracker.js config list

# Modify settings
node scripts/session-tracker.js config set sessions.maxHours 4
node scripts/session-tracker.js config set notifications.enabled true
node scripts/session-tracker.js config set project.autoDetect true

# Reset to defaults
node scripts/session-tracker.js config reset
```

### Auto-Detection Mode
```bash
# Monitor Claude Code's session files automatically
node scripts/session-tracker.js auto

# Configure auto-detection settings
node scripts/session-tracker.js config set sessions.autoDetect true
node scripts/session-tracker.js config set sessions.autoStart true
```

## 🏗️ Architecture

### Core Components
- **`scripts/session-tracker.js`** - Main session tracking logic with Windows notifications
- **`scripts/auto-detector.js`** - Claude Code session auto-detection via JSONL monitoring
- **`scripts/project-detector.js`** - Project type detection and Git integration
- **`scripts/export-utils.js`** - Data export utilities (CSV, JSON, Markdown)
- **`scripts/config.js`** - Configuration management system
- **`claude-session-start.sh`** - WSL startup script with comprehensive diagnostics
- **`install-global.sh`** - Global installation script with shell aliases

### Data Structure
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
        git: {
          branch: "current branch",
          lastCommit: "short hash",
          hasUncommittedChanges: boolean
        },
        tags: ["custom", "tags"]
      },
      tokens: {
        input: number,
        output: number,
        cacheCreate: number,
        cacheRead: number
      },
      environment: "WSL",
      claudeSessionId: "auto-detected ID"
    }
  ],
  totalUsage: "daily milliseconds",
  monthlySessionCount: "sessions this month",
  autoDetection: {
    enabled: boolean,
    activeSessions: []
  }
}
```

## 🚨 Troubleshooting

### Common Issues

#### Claude Code Not Authenticated
```bash
# Check authentication status
node scripts/session-tracker.js check

# Re-authenticate if needed
claude

# Verify authentication
claude config list
```

#### Windows Notifications Not Working
```bash
# Test notification system
node scripts/session-tracker.js check

# Check PowerShell accessibility from WSL
powershell.exe -Command "Write-Output 'Test'"

# Fallback: console notifications will still work
```

#### Session Data Not Saving
```bash
# Check file permissions
ls -la .claude-sessions.json

# Reset data file
rm .claude-sessions.json
node scripts/session-tracker.js start
```

#### Auto-Detection Not Working
```bash
# Check Claude config directory
ls -la ~/.claude/

# Enable auto-detection
node scripts/session-tracker.js config set sessions.autoDetect true

# Start auto-detection manually
node scripts/session-tracker.js auto
```

### Diagnostic Commands
```bash
# Comprehensive system check
node scripts/session-tracker.js check

# Configuration verification
node scripts/session-tracker.js config list

# Project detection test
node scripts/session-tracker.js project detect

# Session status
node scripts/session-tracker.js status
```

## 📊 Export Formats

### CSV Export
- Session ID, start/end times, duration
- Project name, type, Git branch
- Token usage (input/output/cache)
- Tags and custom metadata

### JSON Export
- Complete session data with full metadata
- Nested project and Git information
- Configuration snapshots
- Token usage analytics

### Markdown Reports
- Executive summary with charts
- Project breakdown by time spent
- Monthly/weekly usage trends
- Token usage statistics
- Session mode effectiveness

## 🤝 Contributing

### Ways to Contribute
- 🐛 Report bugs
- 💡 Suggest new features
- 📝 Improve documentation
- 🚀 Submit pull requests

### Development Workflow
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Testing Your Changes
```bash
# Test basic functionality
node scripts/session-tracker.js --help

# Test session tracking
node scripts/session-tracker.js start --mode quick-fix
node scripts/session-tracker.js status
node scripts/session-tracker.js end

# Test diagnostics
node scripts/session-tracker.js check
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built for the Claude Code CLI by Anthropic
- Designed specifically for Windows 11 WSL environments
- Inspired by the need to track and optimize Claude Code usage patterns

## 📞 Support

- Create an issue for bug reports
- Start a discussion for feature requests
- Check [readme_usage.md](readme_usage.md) for quick command reference
- Review [CLAUDE.md](CLAUDE.md) for development context

---

**Made with ❤️ for the Claude Code community on WSL**
