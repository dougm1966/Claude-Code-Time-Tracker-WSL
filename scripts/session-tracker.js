// session-tracker.js - Optimized for Claude Code in WSL on Windows 11
const fs = require('fs');
const path = require('path');
const os = require('os');

const SESSION_FILE = '.claude-sessions.json';
const CLAUDE_CONFIG_DIR = path.join(os.homedir(), '.claude');
const CLAUDE_SETTINGS_FILE = path.join(CLAUDE_CONFIG_DIR, 'settings.json');
const MAX_HOURS = 5;
const MAX_SESSION_MS = MAX_HOURS * 60 * 60 * 1000;
const WARNING_30_MIN = 30 * 60 * 1000;
const WARNING_10_MIN = 10 * 60 * 1000;

let warningTimeouts = [];

function formatTime(ms) {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);
    
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
    } else {
        return `${seconds}s`;
    }
}

function isClaudeCodeAuthenticated() {
    try {
        // Check if Claude Code config directory exists
        if (!fs.existsSync(CLAUDE_CONFIG_DIR)) {
            return false;
        }
        
        // Check for authentication artifacts
        const configFiles = fs.readdirSync(CLAUDE_CONFIG_DIR);
        const hasAuthFiles = configFiles.some(file => 
            file.includes('auth') || 
            file.includes('session') || 
            file.includes('token') ||
            file === 'settings.json'
        );
        
        return hasAuthFiles;
    } catch (error) {
        return false;
    }
}

function getClaudeCodeStatus() {
    try {
        const { execSync } = require('child_process');
        
        // Try to run claude version command to check if it's working
        const result = execSync('claude --version', { 
            encoding: 'utf8', 
            timeout: 5000,
            stdio: 'pipe'
        });
        
        return { authenticated: true, version: result.trim() };
    } catch (error) {
        return { authenticated: false, error: error.message };
    }
}

function showWSLNotification(title, message) {
    const { exec } = require('child_process');
    
    // Enhanced Windows notification from WSL
    const windowsTitle = title.replace(/'/g, "''").replace(/"/g, '\\"');
    const windowsMessage = message.replace(/'/g, "''").replace(/"/g, '\\"');
    
    // Primary method: PowerShell toast notification
    const toastScript = `
        try {
            [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
            [Windows.UI.Notifications.ToastNotification, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
            [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
            
            $template = @"
<toast launch="claude-session" scenario="reminder">
    <visual>
        <binding template="ToastGeneric">
            <text>${windowsTitle}</text>
            <text>${windowsMessage}</text>
            <text placement="attribution">Claude Code Session Tracker</text>
        </binding>
    </visual>
    <audio src="ms-winsoundevent:Notification.Reminder" />
    <actions>
        <action content="Check Status" arguments="action=check"/>
        <action content="Dismiss" arguments="action=dismiss"/>
    </actions>
</toast>
"@
            
            $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
            $xml.LoadXml($template)
            $toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
            $toast.Tag = "ClaudeSession"
            $toast.Group = "ClaudeCode"
            $notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("Claude Code Session")
            $notifier.Show($toast)
            Write-Output "Toast notification sent successfully"
        } catch {
            # Fallback to system tray notification
            Add-Type -AssemblyName System.Windows.Forms
            Add-Type -AssemblyName System.Drawing
            
            $notification = New-Object System.Windows.Forms.NotifyIcon
            $notification.Icon = [System.Drawing.SystemIcons]::Information
            $notification.BalloonTipIcon = [System.Windows.Forms.ToolTipIcon]::Warning
            $notification.BalloonTipText = "${windowsMessage}"
            $notification.BalloonTipTitle = "${windowsTitle}"
            $notification.Visible = $true
            $notification.ShowBalloonTip(10000)
            Start-Sleep -Seconds 2
            $notification.Dispose()
            Write-Output "Fallback notification sent"
        }
    `;
    
    // Execute PowerShell command from WSL
    exec(`powershell.exe -Command "${toastScript}"`, (error, stdout, stderr) => {
        if (error) {
            // Ultimate fallback: console notification
            console.log(`\n📱 WINDOWS NOTIFICATION: ${title}`);
            console.log(`📝 ${message}\n`);
        } else {
            console.log(`📱 Windows notification sent: ${title}`);
        }
    });
}

function loadData() {
    try {
        if (fs.existsSync(SESSION_FILE)) {
            return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('Error loading session data:', e);
    }
    return {
        sessions: [],
        totalUsage: 0,
        lastReset: new Date().toISOString(),
        monthlySessionCount: 0,
        lastMonthReset: new Date().toISOString()
    };
}

function saveData(data) {
    try {
        data.lastUpdate = new Date().toISOString();
        data.claudeCodeStatus = getClaudeCodeStatus();
        fs.writeFileSync(SESSION_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Error saving session data:', e);
    }
}

function clearWarnings() {
    warningTimeouts.forEach(timeout => clearTimeout(timeout));
    warningTimeouts = [];
}

function scheduleWarnings(sessionStart) {
    clearWarnings();
    
    const startTime = new Date(sessionStart).getTime();
    const now = Date.now();
    
    const warning30Time = startTime + (MAX_SESSION_MS - WARNING_30_MIN);
    const warning10Time = startTime + (MAX_SESSION_MS - WARNING_10_MIN);
    const expiryTime = startTime + MAX_SESSION_MS;
    
    // 30-minute warning
    const timeUntil30 = warning30Time - now;
    if (timeUntil30 > 0) {
        const timeout30 = setTimeout(() => {
            console.log('\n🟠 [WSL] ⚠️  CLAUDE CODE SESSION WARNING ⚠️');
            console.log('⏰ 30 MINUTES REMAINING in your Claude Code session!');
            console.log('💡 Consider saving your work and preparing to refresh.');
            console.log('🔄 Run `claude` to check if still authenticated');
            console.log('📍 Check status: node scripts/session-tracker.js status\n');
            
            showWSLNotification(
                'Claude Code Session Warning', 
                '30 minutes remaining! Save your work and prepare to refresh.'
            );
        }, timeUntil30);
        warningTimeouts.push(timeout30);
    }
    
    // 10-minute warning
    const timeUntil10 = warning10Time - now;
    if (timeUntil10 > 0) {
        const timeout10 = setTimeout(() => {
            console.log('\n🔴 [WSL] 🚨 URGENT: CLAUDE CODE SESSION WARNING 🚨');
            console.log('⏰ ONLY 10 MINUTES REMAINING!');
            console.log('🚨 SAVE YOUR WORK NOW!');
            console.log('🔄 Prepare to restart Claude Code session immediately!');
            console.log('💡 Have your authentication ready for re-login\n');
            
            showWSLNotification(
                'URGENT: Claude Code Session', 
                'Only 10 minutes left! Save work NOW and prepare to re-authenticate!'
            );
        }, timeUntil10);
        warningTimeouts.push(timeout10);
    }
    
    // Expiry warning
    const timeUntilExpiry = expiryTime - now;
    if (timeUntilExpiry > 0) {
        const timeoutExpiry = setTimeout(() => {
            console.log('\n💀 [WSL] ⚠️  CLAUDE CODE SESSION EXPIRED ⚠️');
            console.log('🕐 Your 5-hour session has ended!');
            console.log('🔄 You must restart Claude Code and re-authenticate');
            console.log('💡 Run: claude (and follow authentication prompts)');
            console.log('📍 End this tracking session: node scripts/session-tracker.js end\n');
            
            showWSLNotification(
                'Claude Code Session EXPIRED', 
                'Your 5-hour session has expired! Restart Claude Code and re-authenticate.'
            );
        }, timeUntilExpiry);
        warningTimeouts.push(timeoutExpiry);
    }
}

function start() {
    const now = new Date();
    const data = loadData();
    
    // Check Claude Code authentication status
    const claudeStatus = getClaudeCodeStatus();
    if (!claudeStatus.authenticated) {
        console.log('⚠️  WARNING: Claude Code may not be authenticated!');
        console.log('🔧 Make sure to run `claude` and authenticate before starting session tracking');
        console.log('📍 Claude Code status:', claudeStatus.error || 'Not authenticated');
        console.log('');
    }
    
    // Reset monthly count if needed
    const lastMonthReset = new Date(data.lastMonthReset);
    const daysSinceMonthReset = (now - lastMonthReset) / (1000 * 60 * 60 * 24);
    if (daysSinceMonthReset >= 30) {
        console.log('🔄 New month - resetting session counter');
        data.monthlySessionCount = 0;
        data.lastMonthReset = now.toISOString();
    }
    
    // Check if we need to reset for a new day
    const lastReset = new Date(data.lastReset);
    if ((now - lastReset) / (1000 * 60 * 60 * 24) >= 1) {
        console.log('🔄 New day - resetting daily usage counter');
        data.totalUsage = 0;
        data.lastReset = now.toISOString();
    }
    
    // Check if there's already an active session
    const activeSessions = data.sessions.filter(s => !s.endTime);
    if (activeSessions.length > 0) {
        console.log('⚠️  Active session already exists!');
        const activeSession = activeSessions[0];
        const elapsed = now - new Date(activeSession.startTime);
        console.log(`📊 Current session: ${formatTime(elapsed)} elapsed`);
        
        scheduleWarnings(activeSession.startTime);
        return;
    }
    
    // Start new session
    const sessionId = `session_${Date.now()}`;
    const session = {
        id: sessionId,
        startTime: now.toISOString(),
        endTime: null,
        duration: null,
        environment: 'WSL',
        workingDirectory: process.cwd(),
        windowsPath: null, // Will be filled by WSL path conversion if needed
        claudeCodeVersion: claudeStatus.version || 'Unknown'
    };
    
    // Increment monthly session count
    data.monthlySessionCount = (data.monthlySessionCount || 0) + 1;
    
    data.sessions.push(session);
    saveData(data);
    
    console.log('✅ [WSL] Claude Code session tracking started!');
    console.log(`🆔 Session ID: ${sessionId}`);
    console.log(`🕐 Start time: ${now.toLocaleString()}`);
    console.log(`⏰ Will expire at: ${new Date(now.getTime() + MAX_SESSION_MS).toLocaleString()}`);
    console.log(`📁 Working directory: ${process.cwd()}`);
    console.log(`📊 Monthly sessions used: ${data.monthlySessionCount}/50`);
    console.log(`🔧 Claude Code authenticated: ${claudeStatus.authenticated ? '✅' : '❌'}`);
    console.log(`⚠️  Warnings scheduled for 30min and 10min before expiry`);
    console.log(`📱 Windows notifications enabled`);
    
    scheduleWarnings(session.startTime);
    
    // Show monthly limit warning if approaching limit
    if (data.monthlySessionCount >= 45) {
        console.log('\n🚨 WARNING: Approaching monthly session limit!');
        console.log(`📊 You've used ${data.monthlySessionCount}/50 sessions this month`);
        showWSLNotification(
            'Claude Code Session Limit Warning',
            `You've used ${data.monthlySessionCount}/50 sessions this month`
        );
    }
}

function end() {
    const data = loadData();
    const activeSessions = data.sessions.filter(s => !s.endTime);
    
    if (activeSessions.length === 0) {
        console.log('❌ No active session found');
        return;
    }
    
    const session = activeSessions[0];
    const now = new Date();
    const duration = now - new Date(session.startTime);
    
    session.endTime = now.toISOString();
    session.duration = duration;
    data.totalUsage += duration;
    
    saveData(data);
    clearWarnings();
    
    console.log('✅ [WSL] Session ended');
    console.log(`⏱️  Duration: ${formatTime(duration)}`);
    console.log(`📊 Total usage today: ${formatTime(data.totalUsage)}`);
    console.log(`📊 Monthly sessions used: ${data.monthlySessionCount}/50`);
}

function status() {
    const data = loadData();
    const activeSessions = data.sessions.filter(s => !s.endTime);
    const claudeStatus = getClaudeCodeStatus();
    
    console.log('\n📊 [WSL] CLAUDE CODE SESSION STATUS');
    console.log('='.repeat(45));
    
    if (activeSessions.length === 0) {
        console.log('❌ No active session');
        console.log(`📈 Total usage today: ${formatTime(data.totalUsage)}`);
        console.log(`📊 Monthly sessions: ${data.monthlySessionCount || 0}/50`);
        console.log(`🔧 Claude Code status: ${claudeStatus.authenticated ? '✅ Authenticated' : '❌ Not authenticated'}`);
        if (claudeStatus.version) {
            console.log(`📦 Claude Code version: ${claudeStatus.version}`);
        }
        return;
    }
    
    const session = activeSessions[0];
    const now = Date.now();
    const startTime = new Date(session.startTime).getTime();
    const elapsed = now - startTime;
    const remaining = Math.max(0, MAX_SESSION_MS - elapsed);
    
    console.log(`🆔 Session: ${session.id}`);
    console.log(`🕐 Started: ${new Date(session.startTime).toLocaleString()}`);
    console.log(`⏱️  Elapsed: ${formatTime(elapsed)}`);
    console.log(`⏰ Remaining: ${formatTime(remaining)}`);
    console.log(`📈 Total today: ${formatTime(data.totalUsage + elapsed)}`);
    console.log(`📊 Monthly sessions: ${data.monthlySessionCount || 0}/50`);
    console.log(`📁 Working dir: ${session.workingDirectory || 'Unknown'}`);
    console.log(`🔧 Claude Code: ${claudeStatus.authenticated ? '✅ Authenticated' : '❌ Not authenticated'}`);
    
    // Status indicators
    if (remaining <= 0) {
        console.log('🔴 STATUS: EXPIRED - Restart Claude Code!');
    } else if (remaining <= WARNING_10_MIN) {
        console.log('🔴 STATUS: CRITICAL - Less than 10 minutes!');
    } else if (remaining <= WARNING_30_MIN) {
        console.log('🟡 STATUS: WARNING - Less than 30 minutes!');
    } else {
        console.log('🟢 STATUS: ACTIVE');
    }
    
    console.log('='.repeat(45) + '\n');
}

function checkClaudeCode() {
    const claudeStatus = getClaudeCodeStatus();
    const isAuthenticated = isClaudeCodeAuthenticated();
    
    console.log('\n🔍 CLAUDE CODE DIAGNOSTIC');
    console.log('='.repeat(30));
    console.log(`📁 Config directory: ${CLAUDE_CONFIG_DIR}`);
    console.log(`📁 Config exists: ${fs.existsSync(CLAUDE_CONFIG_DIR) ? '✅' : '❌'}`);
    console.log(`🔐 Authentication files: ${isAuthenticated ? '✅' : '❌'}`);
    console.log(`🔧 CLI accessible: ${claudeStatus.authenticated ? '✅' : '❌'}`);
    
    if (claudeStatus.version) {
        console.log(`📦 Version: ${claudeStatus.version}`);
    }
    
    if (claudeStatus.error) {
        console.log(`❌ Error: ${claudeStatus.error}`);
    }
    
    if (fs.existsSync(CLAUDE_CONFIG_DIR)) {
        try {
            const configFiles = fs.readdirSync(CLAUDE_CONFIG_DIR);
            console.log(`📄 Config files: ${configFiles.join(', ')}`);
        } catch (error) {
            console.log(`❌ Cannot read config directory: ${error.message}`);
        }
    }
    
    console.log('='.repeat(30) + '\n');
}

// Command line interface
const command = process.argv[2];

switch (command) {
    case 'start':
        start();
        break;
    case 'end':
        end();
        break;
    case 'status':
        status();
        break;
    case 'check':
    case 'diagnostic':
        checkClaudeCode();
        break;
    default:
        console.log('Usage: node scripts/session-tracker.js [start|end|status|check]');
        console.log('');
        console.log('Commands:');
        console.log('  start     - Start tracking a new Claude Code session');
        console.log('  end       - End the current session');
        console.log('  status    - Show current session status');
        console.log('  check     - Diagnostic check of Claude Code installation');
        break;
}

// Keep the process alive for warnings
if (command === 'start') {
    process.on('SIGINT', () => {
        console.log('\n🛑 Session tracker interrupted');
        clearWarnings();
        process.exit(0);
    });
    
    // Keep alive if running in background
    if (process.argv.includes('--background') || process.argv.includes('--daemon')) {
        setInterval(() => {}, 1000);
    }
}
