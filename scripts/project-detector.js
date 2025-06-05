// project-detector.js - Extract project metadata from various sources
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class ProjectDetector {
    /**
     * Detect project information from a working directory
     * @param {string} workingDirectory - The directory to analyze
     * @returns {Object} Project metadata
     */
    static detectProject(workingDirectory) {
        if (!workingDirectory || !fs.existsSync(workingDirectory)) {
            return {
                name: 'Unknown Project',
                path: workingDirectory || 'Unknown',
                type: 'unknown',
                git: null,
                packageInfo: null
            };
        }

        const project = {
            name: path.basename(workingDirectory),
            path: workingDirectory,
            type: 'unknown',
            git: this.getGitInfo(workingDirectory),
            packageInfo: null
        };

        // Try to detect project type and name from various sources
        const detectors = [
            this.detectFromPackageJson,
            this.detectFromPyprojectToml,
            this.detectFromSetupPy,
            this.detectFromCargoToml,
            this.detectFromComposerJson,
            this.detectFromGemfile,
            this.detectFromGoMod,
            this.detectFromMakefile,
            this.detectFromGitConfig
        ];

        for (const detector of detectors) {
            try {
                const result = detector.call(this, workingDirectory);
                if (result) {
                    project.name = result.name || project.name;
                    project.type = result.type || project.type;
                    project.packageInfo = result.packageInfo || project.packageInfo;
                    break; // Use first successful detector
                }
            } catch (error) {
                // Continue to next detector
                continue;
            }
        }

        return project;
    }

    /**
     * Detect Node.js project from package.json
     */
    static detectFromPackageJson(workingDirectory) {
        const packagePath = path.join(workingDirectory, 'package.json');
        if (!fs.existsSync(packagePath)) return null;

        try {
            const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
            return {
                name: packageJson.name || path.basename(workingDirectory),
                type: this.determineNodeProjectType(packageJson),
                packageInfo: {
                    version: packageJson.version,
                    description: packageJson.description,
                    main: packageJson.main,
                    scripts: Object.keys(packageJson.scripts || {}),
                    dependencies: Object.keys(packageJson.dependencies || {}),
                    devDependencies: Object.keys(packageJson.devDependencies || {})
                }
            };
        } catch (error) {
            return {
                name: path.basename(workingDirectory),
                type: 'node',
                packageInfo: null
            };
        }
    }

    /**
     * Determine specific Node.js project type
     */
    static determineNodeProjectType(packageJson) {
        const deps = { 
            ...packageJson.dependencies, 
            ...packageJson.devDependencies 
        };

        if (deps.react || deps['@types/react']) return 'react';
        if (deps.vue || deps['@vue/cli']) return 'vue';
        if (deps.angular || deps['@angular/core']) return 'angular';
        if (deps.svelte || deps['@sveltejs/kit']) return 'svelte';
        if (deps.next || deps['next.js']) return 'nextjs';
        if (deps.nuxt || deps['@nuxt/core']) return 'nuxt';
        if (deps.express || deps.fastify || deps.koa) return 'node-backend';
        if (deps.electron) return 'electron';
        if (deps.typescript || deps['@types/node']) return 'typescript';
        
        return 'node';
    }

    /**
     * Detect Python project from pyproject.toml
     */
    static detectFromPyprojectToml(workingDirectory) {
        const pyprojectPath = path.join(workingDirectory, 'pyproject.toml');
        if (!fs.existsSync(pyprojectPath)) return null;

        try {
            const content = fs.readFileSync(pyprojectPath, 'utf8');
            // Simple TOML parsing for project name
            const nameMatch = content.match(/name\s*=\s*["']([^"']+)["']/);
            const versionMatch = content.match(/version\s*=\s*["']([^"']+)["']/);
            
            return {
                name: nameMatch ? nameMatch[1] : path.basename(workingDirectory),
                type: 'python',
                packageInfo: {
                    version: versionMatch ? versionMatch[1] : null,
                    configFile: 'pyproject.toml'
                }
            };
        } catch (error) {
            return {
                name: path.basename(workingDirectory),
                type: 'python',
                packageInfo: null
            };
        }
    }

    /**
     * Detect Python project from setup.py
     */
    static detectFromSetupPy(workingDirectory) {
        const setupPath = path.join(workingDirectory, 'setup.py');
        if (!fs.existsSync(setupPath)) return null;

        try {
            const content = fs.readFileSync(setupPath, 'utf8');
            // Simple extraction of name from setup.py
            const nameMatch = content.match(/name\s*=\s*["']([^"']+)["']/);
            
            return {
                name: nameMatch ? nameMatch[1] : path.basename(workingDirectory),
                type: 'python',
                packageInfo: {
                    configFile: 'setup.py'
                }
            };
        } catch (error) {
            return {
                name: path.basename(workingDirectory),
                type: 'python',
                packageInfo: null
            };
        }
    }

    /**
     * Detect Rust project from Cargo.toml
     */
    static detectFromCargoToml(workingDirectory) {
        const cargoPath = path.join(workingDirectory, 'Cargo.toml');
        if (!fs.existsSync(cargoPath)) return null;

        try {
            const content = fs.readFileSync(cargoPath, 'utf8');
            const nameMatch = content.match(/name\s*=\s*["']([^"']+)["']/);
            const versionMatch = content.match(/version\s*=\s*["']([^"']+)["']/);
            
            return {
                name: nameMatch ? nameMatch[1] : path.basename(workingDirectory),
                type: 'rust',
                packageInfo: {
                    version: versionMatch ? versionMatch[1] : null,
                    configFile: 'Cargo.toml'
                }
            };
        } catch (error) {
            return {
                name: path.basename(workingDirectory),
                type: 'rust',
                packageInfo: null
            };
        }
    }

    /**
     * Detect PHP project from composer.json
     */
    static detectFromComposerJson(workingDirectory) {
        const composerPath = path.join(workingDirectory, 'composer.json');
        if (!fs.existsSync(composerPath)) return null;

        try {
            const composerJson = JSON.parse(fs.readFileSync(composerPath, 'utf8'));
            return {
                name: composerJson.name || path.basename(workingDirectory),
                type: 'php',
                packageInfo: {
                    version: composerJson.version,
                    description: composerJson.description,
                    configFile: 'composer.json'
                }
            };
        } catch (error) {
            return {
                name: path.basename(workingDirectory),
                type: 'php',
                packageInfo: null
            };
        }
    }

    /**
     * Detect Ruby project from Gemfile
     */
    static detectFromGemfile(workingDirectory) {
        const gemfilePath = path.join(workingDirectory, 'Gemfile');
        if (!fs.existsSync(gemfilePath)) return null;

        return {
            name: path.basename(workingDirectory),
            type: 'ruby',
            packageInfo: {
                configFile: 'Gemfile'
            }
        };
    }

    /**
     * Detect Go project from go.mod
     */
    static detectFromGoMod(workingDirectory) {
        const goModPath = path.join(workingDirectory, 'go.mod');
        if (!fs.existsSync(goModPath)) return null;

        try {
            const content = fs.readFileSync(goModPath, 'utf8');
            const moduleMatch = content.match(/module\s+([^\s\n]+)/);
            
            return {
                name: moduleMatch ? path.basename(moduleMatch[1]) : path.basename(workingDirectory),
                type: 'go',
                packageInfo: {
                    module: moduleMatch ? moduleMatch[1] : null,
                    configFile: 'go.mod'
                }
            };
        } catch (error) {
            return {
                name: path.basename(workingDirectory),
                type: 'go',
                packageInfo: null
            };
        }
    }

    /**
     * Detect project from Makefile
     */
    static detectFromMakefile(workingDirectory) {
        const makefilePaths = ['Makefile', 'makefile', 'GNUmakefile'];
        
        for (const makefileName of makefilePaths) {
            const makefilePath = path.join(workingDirectory, makefileName);
            if (fs.existsSync(makefilePath)) {
                return {
                    name: path.basename(workingDirectory),
                    type: 'makefile',
                    packageInfo: {
                        configFile: makefileName
                    }
                };
            }
        }
        
        return null;
    }

    /**
     * Detect project from Git configuration
     */
    static detectFromGitConfig(workingDirectory) {
        const gitConfigPath = path.join(workingDirectory, '.git', 'config');
        if (!fs.existsSync(gitConfigPath)) return null;

        try {
            const content = fs.readFileSync(gitConfigPath, 'utf8');
            const urlMatch = content.match(/url\s*=\s*(.+)/);
            
            if (urlMatch) {
                const url = urlMatch[1].trim();
                const repoNameMatch = url.match(/\/([^\/]+?)(?:\.git)?$/);
                
                if (repoNameMatch) {
                    return {
                        name: repoNameMatch[1],
                        type: 'git',
                        packageInfo: {
                            remoteUrl: url
                        }
                    };
                }
            }
        } catch (error) {
            // Ignore errors
        }

        return {
            name: path.basename(workingDirectory),
            type: 'git',
            packageInfo: null
        };
    }

    /**
     * Get Git repository information
     */
    static getGitInfo(workingDirectory) {
        if (!fs.existsSync(path.join(workingDirectory, '.git'))) {
            return null;
        }

        try {
            const originalCwd = process.cwd();
            process.chdir(workingDirectory);

            const branch = execSync('git rev-parse --abbrev-ref HEAD', { 
                encoding: 'utf8', 
                timeout: 5000,
                stdio: 'pipe'
            }).trim();

            const lastCommit = execSync('git rev-parse HEAD', { 
                encoding: 'utf8', 
                timeout: 5000,
                stdio: 'pipe'
            }).trim();

            const lastCommitMessage = execSync('git log -1 --pretty=%B', { 
                encoding: 'utf8', 
                timeout: 5000,
                stdio: 'pipe'
            }).trim();

            const remoteUrl = execSync('git config --get remote.origin.url', { 
                encoding: 'utf8', 
                timeout: 5000,
                stdio: 'pipe'
            }).trim();

            process.chdir(originalCwd);

            return {
                branch,
                lastCommit: lastCommit.substring(0, 8), // Short hash
                lastCommitMessage: lastCommitMessage.split('\n')[0], // First line only
                remoteUrl: remoteUrl || null,
                hasUncommittedChanges: this.hasUncommittedChanges(workingDirectory)
            };
        } catch (error) {
            return {
                branch: 'unknown',
                lastCommit: null,
                lastCommitMessage: null,
                remoteUrl: null,
                hasUncommittedChanges: null
            };
        }
    }

    /**
     * Check if repository has uncommitted changes
     */
    static hasUncommittedChanges(workingDirectory) {
        try {
            const originalCwd = process.cwd();
            process.chdir(workingDirectory);

            const status = execSync('git status --porcelain', { 
                encoding: 'utf8', 
                timeout: 5000,
                stdio: 'pipe'
            }).trim();

            process.chdir(originalCwd);
            
            return status.length > 0;
        } catch (error) {
            return null;
        }
    }

    /**
     * Validate and sanitize project tags
     */
    static validateTags(tags) {
        if (!Array.isArray(tags)) return [];
        
        return tags
            .filter(tag => typeof tag === 'string' && tag.trim().length > 0)
            .map(tag => tag.trim().toLowerCase().replace(/[^a-z0-9-_]/g, ''))
            .filter(tag => tag.length > 0)
            .slice(0, 10); // Limit to 10 tags
    }

    /**
     * Add custom tags to a session
     */
    static addCustomTags(project, customTags = []) {
        const validatedTags = this.validateTags(customTags);
        
        return {
            ...project,
            tags: validatedTags
        };
    }
}

module.exports = ProjectDetector;