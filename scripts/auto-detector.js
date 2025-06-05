// auto-detector.js - Claude Code JSONL monitoring for automatic session detection
const fs = require('fs');
const path = require('path');
const os = require('os');
const { EventEmitter } = require('events');

class ClaudeAutoDetector extends EventEmitter {
    constructor(options = {}) {
        super();
        this.claudeConfigDir = path.join(os.homedir(), '.claude');
        this.projectsDir = path.join(this.claudeConfigDir, 'projects');
        this.activeSessions = new Map(); // sessionId -> sessionData
        this.watchedFiles = new Map(); // filePath -> watcher
        this.pollingInterval = options.pollingInterval || 2000; // 2 seconds
        this.isWatching = false;
        this.lastFileStates = new Map(); // filePath -> { size, mtime }
    }

    /**
     * Start monitoring Claude JSONL files for new sessions
     */
    async startMonitoring() {
        if (this.isWatching) {
            console.log('Auto-detector already running');
            return;
        }

        console.log('🔍 Starting Claude Code auto-detection...');
        
        if (!fs.existsSync(this.projectsDir)) {
            console.log('⚠️  Claude projects directory not found, creating...');
            fs.mkdirSync(this.projectsDir, { recursive: true });
        }

        this.isWatching = true;
        
        // Initial scan of existing files
        await this.scanExistingFiles();
        
        // Start polling for new files and changes
        this.startPolling();
        
        this.emit('monitoring_started');
        console.log('✅ Auto-detection monitoring started');
    }

    /**
     * Stop monitoring
     */
    stopMonitoring() {
        if (!this.isWatching) return;

        console.log('🛑 Stopping Claude Code auto-detection...');
        this.isWatching = false;
        
        // Stop all file watchers
        this.watchedFiles.forEach(watcher => {
            if (watcher && typeof watcher.close === 'function') {
                watcher.close();
            }
        });
        this.watchedFiles.clear();
        
        if (this.pollingTimer) {
            clearInterval(this.pollingTimer);
        }
        
        this.emit('monitoring_stopped');
        console.log('✅ Auto-detection stopped');
    }

    /**
     * Start polling for file changes (fallback when fs.watch fails)
     */
    startPolling() {
        this.pollingTimer = setInterval(() => {
            if (!this.isWatching) return;
            this.scanForChanges();
        }, this.pollingInterval);
    }

    /**
     * Scan existing JSONL files and set up monitoring
     */
    async scanExistingFiles() {
        try {
            const projectDirs = fs.readdirSync(this.projectsDir, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name);

            for (const projectDir of projectDirs) {
                const projectPath = path.join(this.projectsDir, projectDir);
                await this.scanProjectDirectory(projectPath);
            }
        } catch (error) {
            console.error('Error scanning existing files:', error.message);
        }
    }

    /**
     * Scan a specific project directory for JSONL files
     */
    async scanProjectDirectory(projectPath) {
        try {
            const files = fs.readdirSync(projectPath);
            const jsonlFiles = files.filter(file => file.endsWith('.jsonl'));

            for (const file of jsonlFiles) {
                const filePath = path.join(projectPath, file);
                await this.monitorFile(filePath);
            }
        } catch (error) {
            console.error(`Error scanning project directory ${projectPath}:`, error.message);
        }
    }

    /**
     * Monitor a specific JSONL file
     */
    async monitorFile(filePath) {
        if (this.watchedFiles.has(filePath)) return;

        try {
            const stats = fs.statSync(filePath);
            this.lastFileStates.set(filePath, {
                size: stats.size,
                mtime: stats.mtime.getTime()
            });

            // Read existing content to detect active sessions
            await this.processFileChanges(filePath);

            // Set up file watcher (with fallback to polling)
            try {
                const watcher = fs.watch(filePath, (eventType) => {
                    if (eventType === 'change') {
                        this.processFileChanges(filePath);
                    }
                });
                this.watchedFiles.set(filePath, watcher);
            } catch (watchError) {
                console.log(`File watching failed for ${filePath}, using polling fallback`);
                this.watchedFiles.set(filePath, null);
            }

        } catch (error) {
            console.error(`Error monitoring file ${filePath}:`, error.message);
        }
    }

    /**
     * Scan for new files and file changes
     */
    async scanForChanges() {
        try {
            // Check for new project directories
            if (fs.existsSync(this.projectsDir)) {
                const projectDirs = fs.readdirSync(this.projectsDir, { withFileTypes: true })
                    .filter(dirent => dirent.isDirectory())
                    .map(dirent => dirent.name);

                for (const projectDir of projectDirs) {
                    const projectPath = path.join(this.projectsDir, projectDir);
                    const files = fs.readdirSync(projectPath);
                    const jsonlFiles = files.filter(file => file.endsWith('.jsonl'));

                    for (const file of jsonlFiles) {
                        const filePath = path.join(projectPath, file);
                        if (!this.watchedFiles.has(filePath)) {
                            await this.monitorFile(filePath);
                        } else {
                            // Check for file changes (polling fallback)
                            await this.checkFileChanges(filePath);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error scanning for changes:', error.message);
        }
    }

    /**
     * Check if a file has changed (for polling mode)
     */
    async checkFileChanges(filePath) {
        try {
            if (!fs.existsSync(filePath)) {
                this.watchedFiles.delete(filePath);
                this.lastFileStates.delete(filePath);
                return;
            }

            const stats = fs.statSync(filePath);
            const lastState = this.lastFileStates.get(filePath);
            
            if (!lastState || stats.size !== lastState.size || stats.mtime.getTime() !== lastState.mtime) {
                this.lastFileStates.set(filePath, {
                    size: stats.size,
                    mtime: stats.mtime.getTime()
                });
                await this.processFileChanges(filePath);
            }
        } catch (error) {
            console.error(`Error checking file changes for ${filePath}:`, error.message);
        }
    }

    /**
     * Process changes to a JSONL file
     */
    async processFileChanges(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.trim().split('\n').filter(line => line.trim());
            
            if (lines.length === 0) return;

            // Process the most recent entries (last 10 lines to catch new activity)
            const recentLines = lines.slice(-10);
            
            for (const line of recentLines) {
                try {
                    const entry = JSON.parse(line);
                    await this.processJSONLEntry(entry, filePath);
                } catch (parseError) {
                    console.error(`Error parsing JSONL line:`, parseError.message);
                }
            }
        } catch (error) {
            console.error(`Error processing file changes ${filePath}:`, error.message);
        }
    }

    /**
     * Process a single JSONL entry
     */
    async processJSONLEntry(entry, filePath) {
        const { sessionId, timestamp, type, cwd, message, usage } = entry;
        
        if (!sessionId || !timestamp) return;

        const sessionData = this.activeSessions.get(sessionId) || {
            sessionId,
            filePath,
            startTime: timestamp,
            lastActivity: timestamp,
            cwd: cwd || 'Unknown',
            messageCount: 0,
            tokens: {
                input: 0,
                output: 0,
                cacheCreate: 0,
                cacheRead: 0
            }
        };

        // Update session data
        sessionData.lastActivity = timestamp;
        sessionData.messageCount++;

        // Extract token usage
        if (usage) {
            sessionData.tokens.input += usage.input_tokens || 0;
            sessionData.tokens.output += usage.output_tokens || 0;
            sessionData.tokens.cacheCreate += usage.cache_creation_input_tokens || 0;
            sessionData.tokens.cacheRead += usage.cache_read_input_tokens || 0;
        }

        const wasNew = !this.activeSessions.has(sessionId);
        this.activeSessions.set(sessionId, sessionData);

        // Emit events for session lifecycle
        if (wasNew) {
            console.log(`🔍 New Claude Code session detected: ${sessionId}`);
            console.log(`📁 Working directory: ${sessionData.cwd}`);
            this.emit('session_started', sessionData);
        } else {
            this.emit('session_updated', sessionData);
        }

        // Check for session timeout (no activity for 6 hours = session likely ended)
        this.checkSessionTimeouts();
    }

    /**
     * Check for sessions that may have timed out
     */
    checkSessionTimeouts() {
        const sixHoursAgo = Date.now() - (6 * 60 * 60 * 1000);
        
        for (const [sessionId, sessionData] of this.activeSessions) {
            const lastActivityTime = new Date(sessionData.lastActivity).getTime();
            
            if (lastActivityTime < sixHoursAgo) {
                console.log(`⏰ Session timeout detected: ${sessionId}`);
                this.emit('session_ended', sessionData);
                this.activeSessions.delete(sessionId);
            }
        }
    }

    /**
     * Get current active sessions
     */
    getActiveSessions() {
        return Array.from(this.activeSessions.values());
    }

    /**
     * Get session by ID
     */
    getSession(sessionId) {
        return this.activeSessions.get(sessionId);
    }

    /**
     * Check if auto-detection is available
     */
    static isAvailable() {
        const claudeConfigDir = path.join(os.homedir(), '.claude');
        const projectsDir = path.join(claudeConfigDir, 'projects');
        return fs.existsSync(projectsDir);
    }

    /**
     * Extract working directory from project path
     */
    static extractWorkingDirectory(projectPath) {
        // Project directory names are encoded working directories
        const dirName = path.basename(projectPath);
        
        // Convert encoded path back to actual path
        // Example: -mnt-c-Users-... becomes /mnt/c/Users/...
        if (dirName.startsWith('-')) {
            return '/' + dirName.substring(1).replace(/-/g, '/');
        }
        
        return dirName;
    }
}

module.exports = ClaudeAutoDetector;