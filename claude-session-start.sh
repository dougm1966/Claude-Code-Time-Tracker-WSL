#!/bin/bash

echo "=== CLAUDE CODE SESSION STARTUP (WSL on Windows 11) ==="
echo "Date: $(date)"
echo "WSL Distro: $(cat /etc/os-release | grep PRETTY_NAME | cut -d'"' -f2 2>/dev/null || echo 'Unknown')"

# Get Windows username and paths
if command -v wslpath &> /dev/null; then
    WINDOWS_USER=$(cmd.exe /c "echo %USERNAME%" 2>/dev/null | tr -d '\r\n')
    WINDOWS_PATH=$(wslpath -w "$(pwd)" 2>/dev/null)
    echo "Windows User: ${WINDOWS_USER}"
    echo "Windows Path: ${WINDOWS_PATH}"
fi

echo ""

# Check if session-tracker.js exists
if [ ! -f "scripts/session-tracker.js" ]; then
    echo "❌ Error: scripts/session-tracker.js not found!"
    echo "📋 Please ensure the session tracker script is in the scripts/ directory"
    exit 1
fi

# Check Claude Code installation
echo "-- Checking Claude Code Installation --"
if command -v claude &> /dev/null; then
    CLAUDE_VERSION=$(claude --version 2>/dev/null || echo "Unknown")
    echo "✅ Claude Code found: $CLAUDE_VERSION"
    
    # Check authentication status
    if claude config list &> /dev/null; then
        echo "✅ Claude Code appears to be configured"
    else
        echo "⚠️  Claude Code may need authentication"
        echo "💡 Run 'claude' to authenticate if needed"
    fi
else
    echo "❌ Claude Code not found in PATH"
    echo "💡 Install with: npm install -g @anthropic-ai/claude-code"
    echo "💡 Then authenticate with: claude"
fi

echo ""
echo "-- Starting Session Tracker (WSL) --"

# Run diagnostic check first
node scripts/session-tracker.js check

# Start session tracking
node scripts/session-tracker.js start --background &
SESSION_PID=$!

echo ""
echo "-- Git Status --"
if command -v git &> /dev/null; then
    git status --short 2>/dev/null || echo "Not a git repository"
else
    echo "Git not installed"
fi

echo ""
echo "-- Recent Commits --"
if command -v git &> /dev/null; then
    git log --oneline -5 2>/dev/null || echo "No git history"
else
    echo "Git not installed"
fi

echo ""
echo "-- Todo List --"
if [ -f ".claude-todos.json" ]; then
    echo "✅ Active todos found - check with TodoRead tool"
else
    echo "📝 No active todos (.claude-todos.json not found)"
fi

echo ""
echo "=== READY FOR CLAUDE CODE DEVELOPMENT (WSL) ==="
echo "💡 Tips for WSL + Claude Code:"
echo "   • Check session: 'node scripts/session-tracker.js status'"
echo "   • End session: 'node scripts/session-tracker.js end'"
echo "   • Check Claude auth: 'claude config list'"
echo "   • Re-authenticate: 'claude' (if session expires)"
echo "   • Diagnostic check: 'node scripts/session-tracker.js check'"
echo "   • 🪟 Windows notifications enabled for warnings"
echo "   • 📊 Monthly limit: 50 sessions (tracked automatically)"
echo ""
echo "🔄 Session tracker running in WSL background (PID: $SESSION_PID)"
echo "⚠️  Remember: Claude Code sessions expire after exactly 5 hours"