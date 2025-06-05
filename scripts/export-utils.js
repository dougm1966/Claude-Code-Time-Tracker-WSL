// export-utils.js - Export session data to various formats
const fs = require('fs');
const path = require('path');

class ExportUtils {
    /**
     * Export sessions to CSV format
     * @param {Array} sessions - Array of session objects
     * @param {string} outputPath - Output file path
     * @param {Object} options - Export options
     */
    static exportToCSV(sessions, outputPath, options = {}) {
        const includeTokens = options.includeTokens !== false;
        const includeProject = options.includeProject !== false;
        const includeGit = options.includeGit !== false;

        // CSV headers
        const headers = [
            'Session ID',
            'Start Time',
            'End Time',
            'Duration (minutes)',
            'Mode',
            'Working Directory'
        ];

        if (includeProject) {
            headers.push('Project Name', 'Project Type');
        }

        if (includeGit) {
            headers.push('Git Branch', 'Git Commit', 'Has Uncommitted Changes');
        }

        if (includeTokens) {
            headers.push('Input Tokens', 'Output Tokens', 'Cache Create Tokens', 'Cache Read Tokens', 'Total Tokens');
        }

        headers.push('30min Warning', '10min Warning', 'Environment', 'Claude Session ID');

        // Convert sessions to CSV rows
        const csvRows = [headers.join(',')];

        for (const session of sessions) {
            const row = [
                this.escapeCSV(session.id || ''),
                this.escapeCSV(session.startTime || ''),
                this.escapeCSV(session.endTime || ''),
                session.duration ? Math.round(session.duration / (1000 * 60)) : '',
                this.escapeCSV(session.mode || 'claude-max'),
                this.escapeCSV(session.workingDirectory || session.project?.path || '')
            ];

            if (includeProject) {
                row.push(
                    this.escapeCSV(session.project?.name || ''),
                    this.escapeCSV(session.project?.type || '')
                );
            }

            if (includeGit) {
                row.push(
                    this.escapeCSV(session.project?.git?.branch || ''),
                    this.escapeCSV(session.project?.git?.lastCommit || ''),
                    session.project?.git?.hasUncommittedChanges ? 'Yes' : 'No'
                );
            }

            if (includeTokens) {
                const tokens = session.tokens || {};
                const totalTokens = (tokens.input || 0) + (tokens.output || 0) + 
                                 (tokens.cacheCreate || 0) + (tokens.cacheRead || 0);
                row.push(
                    tokens.input || 0,
                    tokens.output || 0,
                    tokens.cacheCreate || 0,
                    tokens.cacheRead || 0,
                    totalTokens
                );
            }

            row.push(
                session.warnings?.['30min'] ? 'Yes' : 'No',
                session.warnings?.['10min'] ? 'Yes' : 'No',
                this.escapeCSV(session.environment || 'WSL'),
                this.escapeCSV(session.claudeSessionId || '')
            );

            csvRows.push(row.join(','));
        }

        fs.writeFileSync(outputPath, csvRows.join('\n'), 'utf8');
        return outputPath;
    }

    /**
     * Export sessions to JSON format
     * @param {Array} sessions - Array of session objects
     * @param {string} outputPath - Output file path
     * @param {Object} options - Export options
     */
    static exportToJSON(sessions, outputPath, options = {}) {
        const pretty = options.pretty !== false;
        const metadata = {
            exportDate: new Date().toISOString(),
            totalSessions: sessions.length,
            exportedBy: 'Claude Code Session Tracker',
            version: '2.0.0'
        };

        const exportData = {
            metadata,
            sessions: sessions.map(session => this.sanitizeSessionForExport(session))
        };

        const jsonString = pretty ? 
            JSON.stringify(exportData, null, 2) : 
            JSON.stringify(exportData);

        fs.writeFileSync(outputPath, jsonString, 'utf8');
        return outputPath;
    }

    /**
     * Export sessions to Markdown report
     * @param {Array} sessions - Array of session objects
     * @param {string} outputPath - Output file path
     * @param {Object} options - Export options
     */
    static exportToMarkdown(sessions, outputPath, options = {}) {
        const includeStats = options.includeStats !== false;
        const includeCharts = options.includeCharts !== false;
        const title = options.title || 'Claude Code Session Report';

        let markdown = `# ${title}\n\n`;
        markdown += `**Generated:** ${new Date().toLocaleString()}\n`;
        markdown += `**Total Sessions:** ${sessions.length}\n\n`;

        if (includeStats) {
            markdown += this.generateMarkdownStats(sessions);
        }

        // Sessions table
        markdown += '## Session Details\n\n';
        markdown += '| Start Time | Duration | Project | Type | Tokens | Status |\n';
        markdown += '|------------|----------|---------|------|--------|---------|\n';

        for (const session of sessions) {
            const startTime = session.startTime ? 
                new Date(session.startTime).toLocaleString() : 'Unknown';
            const duration = session.duration ? 
                this.formatDuration(session.duration) : 'In Progress';
            const projectName = session.project?.name || 'Unknown';
            const projectType = session.project?.type || 'unknown';
            const totalTokens = this.calculateTotalTokens(session.tokens);
            const status = session.endTime ? 'Completed' : 'Active';

            markdown += `| ${startTime} | ${duration} | ${projectName} | ${projectType} | ${totalTokens} | ${status} |\n`;
        }

        if (includeCharts) {
            markdown += this.generateMarkdownCharts(sessions);
        }

        fs.writeFileSync(outputPath, markdown, 'utf8');
        return outputPath;
    }

    /**
     * Generate markdown statistics section
     */
    static generateMarkdownStats(sessions) {
        const completedSessions = sessions.filter(s => s.endTime);
        const totalDuration = completedSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
        const avgDuration = completedSessions.length > 0 ? totalDuration / completedSessions.length : 0;

        // Project type distribution
        const projectTypes = {};
        sessions.forEach(s => {
            const type = s.project?.type || 'unknown';
            projectTypes[type] = (projectTypes[type] || 0) + 1;
        });

        // Token usage stats
        const totalTokens = sessions.reduce((sum, s) => sum + this.calculateTotalTokens(s.tokens), 0);

        let stats = '## Summary Statistics\n\n';
        stats += `- **Total Duration:** ${this.formatDuration(totalDuration)}\n`;
        stats += `- **Average Session:** ${this.formatDuration(avgDuration)}\n`;
        stats += `- **Total Tokens Used:** ${totalTokens.toLocaleString()}\n`;
        stats += `- **Active Sessions:** ${sessions.filter(s => !s.endTime).length}\n\n`;

        stats += '### Project Types\n\n';
        Object.entries(projectTypes).forEach(([type, count]) => {
            stats += `- **${type}:** ${count} sessions\n`;
        });
        stats += '\n';

        return stats;
    }

    /**
     * Generate markdown charts section (simple text-based charts)
     */
    static generateMarkdownCharts(sessions) {
        let charts = '## Visual Analysis\n\n';
        
        // Daily session distribution
        const dailyData = this.groupSessionsByDay(sessions);
        charts += '### Sessions by Day\n\n';
        charts += '```\n';
        Object.entries(dailyData).forEach(([date, count]) => {
            const bar = '█'.repeat(Math.max(1, Math.round(count / 2)));
            charts += `${date}: ${bar} (${count})\n`;
        });
        charts += '```\n\n';

        // Project distribution pie chart (text)
        const projectData = this.groupSessionsByProject(sessions);
        charts += '### Sessions by Project\n\n';
        Object.entries(projectData).forEach(([project, count]) => {
            const percentage = Math.round((count / sessions.length) * 100);
            charts += `- **${project}:** ${count} sessions (${percentage}%)\n`;
        });
        charts += '\n';

        return charts;
    }

    /**
     * Group sessions by day
     */
    static groupSessionsByDay(sessions) {
        const dailyData = {};
        sessions.forEach(session => {
            if (session.startTime) {
                const date = new Date(session.startTime).toDateString();
                dailyData[date] = (dailyData[date] || 0) + 1;
            }
        });
        return dailyData;
    }

    /**
     * Group sessions by project
     */
    static groupSessionsByProject(sessions) {
        const projectData = {};
        sessions.forEach(session => {
            const project = session.project?.name || 'Unknown';
            projectData[project] = (projectData[project] || 0) + 1;
        });
        return projectData;
    }

    /**
     * Export to multiple formats at once
     * @param {Array} sessions - Array of session objects
     * @param {string} basePath - Base path for export files (without extension)
     * @param {Object} options - Export options
     */
    static exportToAll(sessions, basePath, options = {}) {
        const results = {};

        try {
            results.csv = this.exportToCSV(sessions, `${basePath}.csv`, options);
            console.log(`✅ CSV exported: ${results.csv}`);
        } catch (error) {
            console.error('❌ CSV export failed:', error.message);
        }

        try {
            results.json = this.exportToJSON(sessions, `${basePath}.json`, options);
            console.log(`✅ JSON exported: ${results.json}`);
        } catch (error) {
            console.error('❌ JSON export failed:', error.message);
        }

        try {
            results.markdown = this.exportToMarkdown(sessions, `${basePath}.md`, options);
            console.log(`✅ Markdown exported: ${results.markdown}`);
        } catch (error) {
            console.error('❌ Markdown export failed:', error.message);
        }

        return results;
    }

    /**
     * Helper: Escape CSV values
     */
    static escapeCSV(value) {
        if (typeof value !== 'string') return value;
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
            return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
    }

    /**
     * Helper: Sanitize session object for export
     */
    static sanitizeSessionForExport(session) {
        return {
            id: session.id,
            startTime: session.startTime,
            endTime: session.endTime,
            duration: session.duration,
            mode: session.mode || 'claude-max',
            workingDirectory: session.workingDirectory || session.project?.path,
            project: session.project ? {
                name: session.project.name,
                type: session.project.type,
                path: session.project.path,
                git: session.project.git,
                tags: session.project.tags
            } : null,
            tokens: session.tokens || {
                input: 0,
                output: 0,
                cacheCreate: 0,
                cacheRead: 0
            },
            warnings: session.warnings || {
                '30min': false,
                '10min': false
            },
            environment: session.environment || 'WSL',
            claudeSessionId: session.claudeSessionId,
            claudeCodeVersion: session.claudeCodeVersion
        };
    }

    /**
     * Helper: Calculate total tokens
     */
    static calculateTotalTokens(tokens) {
        if (!tokens) return 0;
        return (tokens.input || 0) + (tokens.output || 0) + 
               (tokens.cacheCreate || 0) + (tokens.cacheRead || 0);
    }

    /**
     * Helper: Format duration in human-readable format
     */
    static formatDuration(durationMs) {
        if (!durationMs || durationMs <= 0) return '0m';
        
        const hours = Math.floor(durationMs / (1000 * 60 * 60));
        const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
        
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else {
            return `${minutes}m`;
        }
    }

    /**
     * Filter sessions by date range
     * @param {Array} sessions - Array of session objects
     * @param {Date} startDate - Start date (inclusive)
     * @param {Date} endDate - End date (inclusive)
     */
    static filterByDateRange(sessions, startDate, endDate) {
        return sessions.filter(session => {
            if (!session.startTime) return false;
            const sessionDate = new Date(session.startTime);
            return sessionDate >= startDate && sessionDate <= endDate;
        });
    }

    /**
     * Filter sessions by project
     * @param {Array} sessions - Array of session objects
     * @param {string} projectName - Project name to filter by
     */
    static filterByProject(sessions, projectName) {
        return sessions.filter(session => 
            session.project?.name === projectName
        );
    }

    /**
     * Filter sessions by type
     * @param {Array} sessions - Array of session objects
     * @param {string} projectType - Project type to filter by
     */
    static filterByType(sessions, projectType) {
        return sessions.filter(session => 
            session.project?.type === projectType
        );
    }
}

module.exports = ExportUtils;