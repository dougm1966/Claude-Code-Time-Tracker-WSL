#!/bin/bash

# install-global.sh - Set up global Claude Code session tracking

TRACKER_DIR="$HOME/.claude-session-tracker"
CURRENT_DIR="$(pwd)"

echo "=== Installing Global Claude Code Session Tracker ==="
echo "📁 Current directory: $CURRENT_DIR"
echo "🎯 Target directory: $TRACKER_DIR"

# Create the tracker directory
mkdir -p "$TRACKER_DIR"

# Copy files to global location
echo "📋 Copying files..."
cp "$CURRENT_DIR/scripts/session-tracker.js" "$TRACKER_DIR/"
cp "$CURRENT_DIR/claude-session-start.sh" "$TRACKER_DIR/"
chmod +x "$TRACKER_DIR/claude-session-start.sh"

# Detect shell and add aliases
if [[ "$SHELL" == *"zsh"* ]]; then
    SHELL_RC="$HOME/.zshrc"
elif [[ "$SHELL" == *"bash"* ]]; then
    SHELL_RC="$HOME/.bashrc"
else
    SHELL_RC="$HOME/.profile"
fi

echo "🔧 Adding aliases to $SHELL_RC..."

# Remove old aliases if they exist
sed -i '/# Claude Code Session Tracker/,/^$/d' "$SHELL_RC"

# Add new aliases
cat >> "$SHELL_RC" << 'EOF'

# Claude Code Session Tracker - Global Aliases
alias claude-session="node ~/.claude-session-tracker/session-tracker.js"
alias claude-start="~/.claude-session-tracker/claude-session-start.sh"
alias claude-status="node ~/.claude-session-tracker/session-tracker.js status"
alias claude-end="node ~/.claude-session-tracker/session-tracker.js end"
alias claude-check="node ~/.claude-session-tracker/session-tracker.js check"

EOF

echo "✅ Installation complete!"
echo ""
echo "🔄 Please run: source $SHELL_RC"
echo ""
echo "Available commands:"
echo "  claude-start   - Start Claude Code with session tracking"
echo "  claude-status  - Check current session status"
echo "  claude-end     - End current session"
echo "  claude-check   - Diagnostic check"
echo ""
echo "💡 You can now run 'claude-start' from ANY project directory!"