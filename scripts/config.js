// config.js - Configuration management for Claude Code Session Tracker
const fs = require('fs');
const path = require('path');
const os = require('os');

class Config {
    constructor() {
        this.configDir = path.join(os.homedir(), '.claude-session-tracker');
        this.configFile = path.join(this.configDir, 'config.json');
        this.defaults = this.getDefaults();
        this.config = this.loadConfig();
    }

    /**
     * Get default configuration
     */
    getDefaults() {
        return {
            // Session tracking settings
            sessions: {
                maxHours: 5,
                autoDetect: true,
                autoStart: false,
                pollingInterval: 2000,
                warningTimes: {
                    warning30: 30 * 60 * 1000, // 30 minutes
                    warning10: 10 * 60 * 1000   // 10 minutes
                }
            },

            // Timer modes
            timerModes: {
                'claude-max': {
                    name: 'Claude Max',
                    duration: 5 * 60 * 60 * 1000, // 5 hours
                    warnings: [30 * 60 * 1000, 10 * 60 * 1000],
                    autoEnd: false,
                    description: 'Standard 5-hour Claude Code session'
                },
                'pomodoro': {
                    name: 'Pomodoro',
                    duration: 25 * 60 * 1000, // 25 minutes
                    warnings: [5 * 60 * 1000], // 5 minutes
                    autoEnd: true,
                    breakDuration: 5 * 60 * 1000, // 5 minutes
                    longBreakAfter: 4,
                    longBreakDuration: 15 * 60 * 1000, // 15 minutes
                    description: 'Pomodoro Technique: 25min work + 5min break'
                },
                'deep-work': {
                    name: 'Deep Work',
                    duration: 90 * 60 * 1000, // 90 minutes
                    warnings: [15 * 60 * 1000, 5 * 60 * 1000], // 15min, 5min
                    autoEnd: true,
                    description: 'Deep work session: 90 minutes of focused work'
                },
                'quick-fix': {
                    name: 'Quick Fix',
                    duration: 15 * 60 * 1000, // 15 minutes
                    warnings: [5 * 60 * 1000], // 5 minutes
                    autoEnd: true,
                    description: 'Quick fix session: 15 minutes for small tasks'
                },
                'custom': {
                    name: 'Custom',
                    duration: 60 * 60 * 1000, // 1 hour default
                    warnings: [10 * 60 * 1000], // 10 minutes
                    autoEnd: false,
                    description: 'Custom duration timer'
                }
            },

            // Notification settings
            notifications: {
                enabled: true,
                sound: true,
                windows: {
                    enabled: true,
                    toastNotifications: true,
                    fallbackToTray: true
                },
                console: {
                    enabled: true,
                    colors: true
                }
            },

            // Project detection settings
            project: {
                autoDetect: true,
                detectFromGit: true,
                detectFromPackageFiles: true,
                customTags: [],
                ignorePaths: [
                    'node_modules',
                    '.git',
                    '.vscode',
                    'build',
                    'dist',
                    '__pycache__'
                ]
            },

            // Export settings
            export: {
                defaultFormat: 'json',
                includeTokens: true,
                includeProject: true,
                includeGit: true,
                prettyJson: true,
                csvDelimiter: ',',
                markdownCharts: true
            },

            // Data retention
            data: {
                retentionDays: 365,
                autoCleanup: true,
                backupEnabled: true,
                maxSessionsInMemory: 1000
            },

            // Development settings
            debug: {
                enabled: false,
                logLevel: 'info', // error, warn, info, debug
                logToFile: false,
                logFilePath: path.join(this.configDir, 'debug.log')
            }
        };
    }

    /**
     * Load configuration from file
     */
    loadConfig() {
        try {
            if (!fs.existsSync(this.configDir)) {
                fs.mkdirSync(this.configDir, { recursive: true });
            }

            if (!fs.existsSync(this.configFile)) {
                // Create default config file
                this.saveConfig(this.defaults);
                return { ...this.defaults };
            }

            const configData = JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
            
            // Merge with defaults to ensure all properties exist
            return this.mergeWithDefaults(configData);

        } catch (error) {
            console.error('Error loading config:', error.message);
            console.log('Using default configuration');
            return { ...this.defaults };
        }
    }

    /**
     * Save configuration to file
     */
    saveConfig(config = null) {
        try {
            const configToSave = config || this.config;
            
            if (!fs.existsSync(this.configDir)) {
                fs.mkdirSync(this.configDir, { recursive: true });
            }

            fs.writeFileSync(this.configFile, JSON.stringify(configToSave, null, 2), 'utf8');
            
            if (!config) {
                this.config = configToSave;
            }
            
            return true;
        } catch (error) {
            console.error('Error saving config:', error.message);
            return false;
        }
    }

    /**
     * Merge user config with defaults
     */
    mergeWithDefaults(userConfig) {
        return this.deepMerge(this.defaults, userConfig);
    }

    /**
     * Deep merge two objects
     */
    deepMerge(target, source) {
        const result = { ...target };
        
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this.deepMerge(target[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }
        
        return result;
    }

    /**
     * Get configuration value by path
     */
    get(path, defaultValue = null) {
        const keys = path.split('.');
        let current = this.config;
        
        for (const key of keys) {
            if (current && typeof current === 'object' && key in current) {
                current = current[key];
            } else {
                return defaultValue;
            }
        }
        
        return current;
    }

    /**
     * Set configuration value by path
     */
    set(path, value) {
        const keys = path.split('.');
        let current = this.config;
        
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!current[key] || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }
        
        current[keys[keys.length - 1]] = value;
        return this.saveConfig();
    }

    /**
     * Get timer mode configuration
     */
    getTimerMode(mode) {
        return this.get(`timerModes.${mode}`, this.defaults.timerModes['claude-max']);
    }

    /**
     * Add or update custom timer mode
     */
    setTimerMode(mode, config) {
        const timerConfig = {
            name: config.name || mode,
            duration: config.duration || 60 * 60 * 1000,
            warnings: config.warnings || [10 * 60 * 1000],
            autoEnd: config.autoEnd || false,
            description: config.description || 'Custom timer mode'
        };
        
        return this.set(`timerModes.${mode}`, timerConfig);
    }

    /**
     * Get all available timer modes
     */
    getTimerModes() {
        return this.get('timerModes', this.defaults.timerModes);
    }

    /**
     * Validate configuration
     */
    validate() {
        const errors = [];
        
        // Validate session settings
        const maxHours = this.get('sessions.maxHours');
        if (typeof maxHours !== 'number' || maxHours <= 0 || maxHours > 24) {
            errors.push('sessions.maxHours must be a number between 1 and 24');
        }
        
        // Validate timer modes
        const timerModes = this.get('timerModes');
        for (const [mode, config] of Object.entries(timerModes)) {
            if (!config.duration || typeof config.duration !== 'number') {
                errors.push(`timerModes.${mode}.duration must be a positive number`);
            }
            if (!Array.isArray(config.warnings)) {
                errors.push(`timerModes.${mode}.warnings must be an array`);
            }
        }
        
        return errors;
    }

    /**
     * Reset configuration to defaults
     */
    reset() {
        this.config = { ...this.defaults };
        return this.saveConfig();
    }

    /**
     * Export configuration
     */
    export(outputPath) {
        try {
            fs.writeFileSync(outputPath, JSON.stringify(this.config, null, 2), 'utf8');
            return true;
        } catch (error) {
            console.error('Error exporting config:', error.message);
            return false;
        }
    }

    /**
     * Import configuration
     */
    import(inputPath) {
        try {
            const importedConfig = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
            this.config = this.mergeWithDefaults(importedConfig);
            
            const errors = this.validate();
            if (errors.length > 0) {
                console.warn('Configuration validation warnings:', errors);
            }
            
            return this.saveConfig();
        } catch (error) {
            console.error('Error importing config:', error.message);
            return false;
        }
    }

    /**
     * Get configuration file path
     */
    getConfigPath() {
        return this.configFile;
    }

    /**
     * Get configuration directory
     */
    getConfigDir() {
        return this.configDir;
    }

    /**
     * Create a custom timer with specific duration
     */
    createCustomTimer(durationMinutes, name = 'Custom Timer') {
        const duration = durationMinutes * 60 * 1000;
        const warnings = [];
        
        // Add appropriate warnings based on duration
        if (duration > 30 * 60 * 1000) { // More than 30 minutes
            warnings.push(15 * 60 * 1000); // 15 minute warning
        }
        if (duration > 10 * 60 * 1000) { // More than 10 minutes
            warnings.push(5 * 60 * 1000); // 5 minute warning
        }
        
        return {
            name,
            duration,
            warnings,
            autoEnd: false,
            description: `Custom timer: ${durationMinutes} minutes`
        };
    }

    /**
     * Update notification settings
     */
    updateNotifications(settings) {
        const current = this.get('notifications');
        const updated = { ...current, ...settings };
        return this.set('notifications', updated);
    }

    /**
     * Update project detection settings
     */
    updateProjectSettings(settings) {
        const current = this.get('project');
        const updated = { ...current, ...settings };
        return this.set('project', updated);
    }
}

// Singleton instance
let configInstance = null;

/**
 * Get configuration instance
 */
function getConfig() {
    if (!configInstance) {
        configInstance = new Config();
    }
    return configInstance;
}

module.exports = {
    Config,
    getConfig
};