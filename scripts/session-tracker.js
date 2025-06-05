// session-tracker.js - Enhanced Claude Code Session Tracker with Auto-Detection
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// UUID generation function
function generateUUID() {
    return crypto.randomUUID ? crypto.randomUUID() : 
           'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Import new modules
const ClaudeAutoDetector = require('./auto-detector');
const ProjectDetector = require('./project-detector');
const ExportUtils = require('./export-utils');
const { getConfig } = require('./config');

// Global configuration
const config = getConfig();
let autoDetector = null;

// Data files and directories
const SESSION_FILE = '.claude-sessions.json';
const CLAUDE_CONFIG_DIR = path.join(os.homedir(), '.claude');
const CLAUDE_SETTINGS_FILE = path.join(CLAUDE_CONFIG_DIR, 'settings.json');

// Configuration-driven constants
const MAX_HOURS = config.get('sessions.maxHours', 5);
const MAX_SESSION_MS = MAX_HOURS * 60 * 60 * 1000;
const WARNING_30_MIN = config.get('sessions.warningTimes.warning30', 30 * 60 * 1000);
const WARNING_10_MIN = config.get('sessions.warningTimes.warning10', 10 * 60 * 1000);

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
            const data = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
            return migrateDataStructure(data);
        }
    } catch (e) {
        console.error('Error loading session data:', e);
    }
    return {
        version: '2.0.0',
        sessions: [],
        totalUsage: 0,
        lastReset: new Date().toISOString(),
        monthlySessionCount: 0,
        lastMonthReset: new Date().toISOString(),
        autoDetection: {
            enabled: config.get('sessions.autoDetect', true),
            lastScan: null,
            activeSessions: []
        }
    };
}

function migrateDataStructure(data) {
    // Check if migration is needed
    if (data.version === '2.0.0') {
        return data; // Already migrated
    }
    
    console.log('🔄 Migrating session data to v2.0.0...');
    
    // Migrate old sessions to new format
    const migratedSessions = (data.sessions || []).map(session => {
        // Check if session is already in new format
        if (session.project && session.tokens) {
            return session;
        }
        
        // Migrate old session format
        const workingDir = session.workingDirectory || process.cwd();
        return {
            id: session.id || generateUUID(),
            startTime: session.startTime,
            endTime: session.endTime,
            duration: session.duration,
            mode: 'claude-max', // Default for old sessions
            workingDirectory: workingDir,
            project: config.get('project.autoDetect', true) ? 
                ProjectDetector.detectProject(workingDir) : {
                    name: path.basename(workingDir),
                    path: workingDir,
                    type: 'unknown',
                    git: null
                },
            tags: [],
            warnings: {
                '30min': false,
                '10min': false
            },
            tokens: {
                input: 0,
                output: 0,
                cacheCreate: 0,
                cacheRead: 0
            },
            environment: session.environment || 'WSL',
            claudeSessionId: session.claudeSessionId || null,
            claudeCodeVersion: session.claudeCodeVersion || null
        };
    });
    
    const migratedData = {
        version: '2.0.0',
        sessions: migratedSessions,
        totalUsage: data.totalUsage || 0,
        lastReset: data.lastReset || new Date().toISOString(),
        monthlySessionCount: data.monthlySessionCount || 0,
        lastMonthReset: data.lastMonthReset || new Date().toISOString(),
        autoDetection: {
            enabled: config.get('sessions.autoDetect', true),
            lastScan: null,
            activeSessions: []
        }
    };
    
    console.log(`✅ Migrated ${migratedSessions.length} sessions to new format`);
    return migratedData;
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

function scheduleWarningsForMode(sessionStart, timerConfig) {
    clearWarnings();
    
    const startTime = new Date(sessionStart).getTime();
    const now = Date.now();
    const expiryTime = startTime + timerConfig.duration;
    
    // Schedule warnings based on timer configuration
    timerConfig.warnings.forEach(warningTime => {
        const warningTriggerTime = expiryTime - warningTime;
        const timeUntilWarning = warningTriggerTime - now;
        
        if (timeUntilWarning > 0) {
            const timeout = setTimeout(() => {
                const remainingTime = formatTime(warningTime);
                console.log(`\n🟡 [${timerConfig.name}] ⚠️  WARNING ⚠️`);
                console.log(`⏰ ${remainingTime} remaining in your session!`);
                console.log('💡 Consider saving your work and preparing for session end.');
                
                showWSLNotification(
                    `${timerConfig.name} Session Warning`,
                    `${remainingTime} remaining! Save your work.`
                );
            }, timeUntilWarning);
            warningTimeouts.push(timeout);
        }
    });
    
    // Schedule session end if auto-end is enabled
    if (timerConfig.autoEnd) {
        const timeUntilEnd = expiryTime - now;
        if (timeUntilEnd > 0) {
            const endTimeout = setTimeout(() => {
                console.log(`\n⏰ [${timerConfig.name}] Session automatically ended`);
                console.log('🔄 Starting break period...');
                
                // Auto-end the session
                end();
                
                // Show break notification
                if (timerConfig.breakDuration) {
                    showWSLNotification(
                        `${timerConfig.name} Break Time`,
                        `Take a ${formatTime(timerConfig.breakDuration)} break!`
                    );
                }
            }, timeUntilEnd);
            warningTimeouts.push(endTimeout);
        }
    } else {
        // Schedule expiry warning for non-auto-end sessions
        const timeUntilExpiry = expiryTime - now;
        if (timeUntilExpiry > 0) {
            const expiryTimeout = setTimeout(() => {
                console.log(`\n💀 [${timerConfig.name}] ⚠️  SESSION EXPIRED ⚠️`);
                console.log('🕐 Your session time has ended!');
                console.log('🔄 Please end this session and start a new one if needed');
                
                showWSLNotification(
                    `${timerConfig.name} Session EXPIRED`,
                    'Your session time has ended! Please start a new session.'
                );
            }, timeUntilExpiry);
            warningTimeouts.push(expiryTimeout);
        }
    }
}

function start(mode = 'claude-max', customDuration = null, customTags = []) {
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
    
    // Get timer mode configuration
    const timerConfig = config.getTimerMode(mode);
    
    // Use custom duration if provided
    if (customDuration && mode === 'custom') {
        timerConfig.duration = customDuration * 60 * 1000; // Convert minutes to milliseconds
    }
    
    // Detect project information
    const workingDirectory = process.cwd();
    const project = config.get('project.autoDetect', true) ? 
        ProjectDetector.detectProject(workingDirectory) : {
            name: path.basename(workingDirectory),
            path: workingDirectory,
            type: 'unknown',
            git: null
        };
    
    // Add custom tags
    const validatedTags = ProjectDetector.validateTags(customTags);
    
    // Start new session
    const sessionId = generateUUID();
    const session = {
        id: sessionId,
        startTime: now.toISOString(),
        endTime: null,
        duration: null,
        mode: mode,
        workingDirectory: workingDirectory,
        project: {
            ...project,
            tags: validatedTags
        },
        tags: validatedTags,
        warnings: {
            '30min': false,
            '10min': false
        },
        tokens: {
            input: 0,
            output: 0,
            cacheCreate: 0,
            cacheRead: 0
        },
        environment: 'WSL',
        claudeSessionId: null, // Will be filled by auto-detection
        claudeCodeVersion: claudeStatus.version || 'Unknown',
        timerConfig: timerConfig
    };
    
    // Increment monthly session count
    data.monthlySessionCount = (data.monthlySessionCount || 0) + 1;
    
    data.sessions.push(session);
    saveData(data);
    
    console.log(`✅ [WSL] ${timerConfig.name} session started!`);
    console.log(`🆔 Session ID: ${sessionId}`);
    console.log(`🕐 Start time: ${now.toLocaleString()}`);
    console.log(`⏰ Duration: ${formatTime(timerConfig.duration)}`);
    console.log(`⏰ Will expire at: ${new Date(now.getTime() + timerConfig.duration).toLocaleString()}`);
    console.log(`📁 Working directory: ${workingDirectory}`);
    console.log(`🏗️  Project: ${project.name} (${project.type})`);
    if (project.git) {
        console.log(`🌿 Git branch: ${project.git.branch} (${project.git.lastCommit})`);
    }
    if (validatedTags.length > 0) {
        console.log(`🏷️  Tags: ${validatedTags.join(', ')}`);
    }
    console.log(`📊 Monthly sessions used: ${data.monthlySessionCount}/50`);
    console.log(`🔧 Claude Code authenticated: ${claudeStatus.authenticated ? '✅' : '❌'}`);
    if (timerConfig.warnings.length > 0) {
        const warningTimes = timerConfig.warnings.map(w => formatTime(w)).join(', ');
        console.log(`⚠️  Warnings scheduled at: ${warningTimes} before expiry`);
    }
    console.log(`📱 Windows notifications enabled`);
    
    scheduleWarningsForMode(session.startTime, timerConfig);
    
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

// Enhanced command line interface
const command = process.argv[2];
const args = process.argv.slice(3);

// Parse command-line arguments
function parseArgs(args) {
    const parsed = { flags: [], options: {} };
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg.startsWith('--')) {
            const key = arg.substring(2);
            if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
                parsed.options[key] = args[i + 1];
                i++;
            } else {
                parsed.flags.push(key);
            }
        }
    }
    return parsed;
}

const parsedArgs = parseArgs(args);

switch (command) {
    case 'start':
        const mode = parsedArgs.options.mode || 'claude-max';
        const duration = parsedArgs.options.duration ? parseInt(parsedArgs.options.duration) : null;
        const tags = parsedArgs.options.tags ? parsedArgs.options.tags.split(',') : [];
        start(mode, duration, tags);
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
    case 'export':
        const format = parsedArgs.options.format || 'json';
        const output = parsedArgs.options.output || `./claude-sessions-${Date.now()}`;
        const dateRange = parsedArgs.options.range;
        exportSessions(format, output, dateRange);
        break;
    case 'auto':
        startAutoDetection();
        break;
    case 'config':
        const configAction = args[0];
        handleConfigCommand(configAction, args.slice(1));
        break;
    case 'project':
        const projectAction = args[0];
        handleProjectCommand(projectAction, args.slice(1));
        break;
    default:
        showHelp();
        break;
}

function showHelp() {
    console.log('Claude Code Session Tracker v2.0.0');
    console.log('');
    console.log('Usage: node scripts/session-tracker.js <command> [options]');
    console.log('');
    console.log('Commands:');
    console.log('  start [--mode MODE] [--duration MINUTES] [--tags TAG1,TAG2]');
    console.log('        Start tracking a new session');
    console.log('        Modes: claude-max, pomodoro, deep-work, quick-fix, custom');
    console.log('');
    console.log('  end   End the current session');
    console.log('');
    console.log('  status');
    console.log('        Show current session status');
    console.log('');
    console.log('  export --format FORMAT --output PATH [--range DAYS]');
    console.log('        Export sessions (formats: csv, json, markdown, all)');
    console.log('');
    console.log('  auto  Start auto-detection of Claude Code sessions');
    console.log('');
    console.log('  config [list|set|reset] [KEY VALUE]');
    console.log('        Manage configuration');
    console.log('');
    console.log('  project [detect|info] [PATH]');
    console.log('        Project detection utilities');
    console.log('');
    console.log('  check Diagnostic check of Claude Code installation');
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/session-tracker.js start --mode pomodoro');
    console.log('  node scripts/session-tracker.js start --mode custom --duration 45');
    console.log('  node scripts/session-tracker.js export --format csv --output ./my-sessions');
    console.log('  node scripts/session-tracker.js config set sessions.autoDetect true');
}

// New command handlers
function exportSessions(format, outputPath, dateRange) {
    const data = loadData();
    let sessions = data.sessions;
    
    // Filter by date range if specified
    if (dateRange) {
        const days = parseInt(dateRange);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        sessions = ExportUtils.filterByDateRange(sessions, cutoffDate, new Date());
    }
    
    console.log(`📊 Exporting ${sessions.length} sessions...`);
    
    try {
        if (format === 'all') {
            const results = ExportUtils.exportToAll(sessions, outputPath);
            console.log('✅ Export completed to multiple formats');
            Object.entries(results).forEach(([fmt, path]) => {
                console.log(`  ${fmt.toUpperCase()}: ${path}`);
            });
        } else {
            let result;
            switch (format) {
                case 'csv':
                    result = ExportUtils.exportToCSV(sessions, `${outputPath}.csv`);
                    break;
                case 'json':
                    result = ExportUtils.exportToJSON(sessions, `${outputPath}.json`);
                    break;
                case 'markdown':
                    result = ExportUtils.exportToMarkdown(sessions, `${outputPath}.md`);
                    break;
                default:
                    console.error('❌ Unknown format:', format);
                    return;
            }
            console.log(`✅ Export completed: ${result}`);
        }
    } catch (error) {
        console.error('❌ Export failed:', error.message);
    }
}

function startAutoDetection() {
    if (!ClaudeAutoDetector.isAvailable()) {
        console.log('❌ Auto-detection not available - Claude config directory not found');
        console.log('💡 Make sure Claude Code is installed and has been run at least once');
        return;
    }
    
    console.log('🔍 Starting auto-detection mode...');
    
    autoDetector = new ClaudeAutoDetector({
        pollingInterval: config.get('sessions.pollingInterval', 2000)
    });
    
    // Set up event handlers
    autoDetector.on('session_started', (sessionData) => {
        console.log(`🚀 Claude Code session auto-detected: ${sessionData.sessionId}`);
        console.log(`📁 Working directory: ${sessionData.cwd}`);
        
        if (config.get('sessions.autoStart', false)) {
            autoStartSession(sessionData);
        }
    });
    
    autoDetector.on('session_updated', (sessionData) => {
        // Update local tracking if we have an active session
        const data = loadData();
        const activeSession = data.sessions.find(s => !s.endTime && s.claudeSessionId === sessionData.sessionId);
        if (activeSession) {
            activeSession.tokens = sessionData.tokens;
            saveData(data);
        }
    });
    
    autoDetector.on('session_ended', (sessionData) => {
        console.log(`📊 Claude Code session ended: ${sessionData.sessionId}`);
        // Auto-end local session if it exists
        autoEndSession(sessionData);
    });
    
    autoDetector.startMonitoring();
    
    // Keep process alive
    process.on('SIGINT', () => {
        console.log('\\n🛑 Auto-detection stopped');
        if (autoDetector) {
            autoDetector.stopMonitoring();
        }
        process.exit(0);
    });
    
    console.log('✅ Auto-detection started - Press Ctrl+C to stop');
    setInterval(() => {}, 1000);
}

function autoStartSession(detectedSession) {
    const workingDir = ClaudeAutoDetector.extractWorkingDirectory(detectedSession.filePath);
    const project = ProjectDetector.detectProject(workingDir);
    
    const sessionData = {
        id: generateUUID(),
        startTime: detectedSession.startTime,
        endTime: null,
        duration: null,
        mode: 'claude-max',
        workingDirectory: workingDir,
        project: project,
        tags: [],
        warnings: { '30min': false, '10min': false },
        tokens: detectedSession.tokens || { input: 0, output: 0, cacheCreate: 0, cacheRead: 0 },
        environment: 'WSL',
        claudeSessionId: detectedSession.sessionId,
        claudeCodeVersion: null
    };
    
    const data = loadData();
    data.sessions.push(sessionData);
    saveData(data);
    
    console.log(`✅ Auto-started tracking for project: ${project.name}`);
    scheduleWarnings(sessionData.startTime);
}

function autoEndSession(detectedSession) {
    const data = loadData();
    const activeSession = data.sessions.find(s => !s.endTime && s.claudeSessionId === detectedSession.sessionId);
    
    if (activeSession) {
        const now = new Date();
        activeSession.endTime = now.toISOString();
        activeSession.duration = now - new Date(activeSession.startTime);
        activeSession.tokens = detectedSession.tokens || activeSession.tokens;
        
        data.totalUsage += activeSession.duration;
        saveData(data);
        
        console.log(`✅ Auto-ended session: ${formatTime(activeSession.duration)}`);
    }
}

function handleConfigCommand(action, args) {
    switch (action) {
        case 'list':
            console.log('Current configuration:');
            console.log(JSON.stringify(config.config, null, 2));
            break;
        case 'set':
            if (args.length < 2) {
                console.log('Usage: config set <key> <value>');
                return;
            }
            const [key, value] = args;
            let parsedValue;
            try {
                parsedValue = JSON.parse(value);
            } catch {
                parsedValue = value;
            }
            if (config.set(key, parsedValue)) {
                console.log(`✅ Set ${key} = ${parsedValue}`);
            } else {
                console.log(`❌ Failed to set ${key}`);
            }
            break;
        case 'reset':
            if (config.reset()) {
                console.log('✅ Configuration reset to defaults');
            } else {
                console.log('❌ Failed to reset configuration');
            }
            break;
        default:
            console.log('Available config actions: list, set, reset');
            break;
    }
}

function handleProjectCommand(action, args) {
    switch (action) {
        case 'detect':
            const projectPath = args[0] || process.cwd();
            const project = ProjectDetector.detectProject(projectPath);
            console.log('Project detection result:');
            console.log(JSON.stringify(project, null, 2));
            break;
        case 'info':
            const data = loadData();
            const projects = {};
            data.sessions.forEach(session => {
                if (session.project) {
                    const name = session.project.name;
                    if (!projects[name]) {
                        projects[name] = {
                            name,
                            type: session.project.type,
                            sessions: 0,
                            totalTime: 0
                        };
                    }
                    projects[name].sessions++;
                    if (session.duration) {
                        projects[name].totalTime += session.duration;
                    }
                }
            });
            
            console.log('Project summary:');
            Object.values(projects).forEach(project => {
                console.log(`${project.name} (${project.type}): ${project.sessions} sessions, ${formatTime(project.totalTime)}`);
            });
            break;
        default:
            console.log('Available project actions: detect, info');
            break;
    }
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
