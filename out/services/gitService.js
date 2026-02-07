"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitService = void 0;
const simple_git_1 = require("simple-git");
const path = __importStar(require("path"));
class GitService {
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
        this.git = (0, simple_git_1.simpleGit)(workspaceRoot);
    }
    /**
     * static factory to initialize with a file path, finding the repo root.
     */
    static async create(startPath) {
        try {
            const git = (0, simple_git_1.simpleGit)(path.dirname(startPath));
            const isRepo = await git.checkIsRepo();
            if (!isRepo)
                return null;
            const root = await git.revparse(['--show-toplevel']);
            return new GitService(root.trim());
        }
        catch (e) {
            console.error('Failed to create GitService:', e);
            return null;
        }
    }
    getWorkspaceRoot() {
        return this.workspaceRoot;
    }
    /**
     * Get the commit graph for the repository.
     * This is the raw topological data needed for the visualization.
     */
    async getCommitGraph(limit = 50) {
        try {
            // Use a custom separator for parsing. '::::' is unlikely to appear in commit messages.
            const separator = '::::';
            // %H: hash, %P: parent hashes, %an: author, %ae: email, %ad: date, %s: message, %D: refs/branches, %at: timestamp
            const format = `%H${separator}%P${separator}%an${separator}%ae${separator}%ad${separator}%s${separator}%D${separator}%at`;
            // Use .raw to bypass simple-git's option parsing which was causing "unrecognized argument: --format" errors
            const result = await this.git.raw([
                'log',
                `--max-count=${limit}`,
                `--format=${format}`
            ]);
            return result.split('\n')
                .filter(line => line.trim().length > 0)
                .map(line => {
                const parts = line.split(separator);
                if (parts.length < 8)
                    return null; // Skip malformed lines
                const [hash, parents, author, email, date, message, refs, timestamp] = parts;
                return {
                    hash: hash,
                    parents: parents ? parents.split(' ').filter(p => p.length > 0) : [],
                    author: author,
                    email: email,
                    date: date,
                    message: message,
                    branch: this.parseBranchName(refs),
                    timestamp: parseInt(timestamp, 10)
                };
            })
                .filter(node => node !== null);
        }
        catch (error) {
            console.error('Error fetching commit graph:', error);
            return [];
        }
    }
    /**
     * Get history for a specific file (File Scope)
     */
    async getFileHistory(filePath, limit = 20) {
        let relativePath = filePath;
        if (path.isAbsolute(filePath)) {
            relativePath = path.relative(this.workspaceRoot, filePath);
        }
        const normalizedPath = relativePath.split(path.sep).join('/');
        try {
            const log = await this.git.log({
                file: normalizedPath,
                maxCount: limit,
                format: {
                    hash: '%H',
                    parents: '%P',
                    author: '%an',
                    email: '%ae',
                    date: '%ad',
                    message: '%s',
                    timestamp: '%at'
                }
            });
            return log.all.map((commit) => ({
                hash: commit.hash,
                parents: commit.parents ? commit.parents.split(' ') : [],
                author: commit.author,
                email: commit.email,
                date: commit.date,
                message: commit.message,
                timestamp: parseInt(commit.timestamp, 10)
            }));
        }
        catch (error) {
            console.error(`Error fetching history for ${filePath}:`, error);
            return [];
        }
    }
    /**
     * Get the content of a file at a specific commit.
     */
    async getFileAtCommit(filePath, commitHash) {
        try {
            let relativePath = filePath;
            if (path.isAbsolute(filePath)) {
                relativePath = path.relative(this.workspaceRoot, filePath);
            }
            // git show <commit>:<path> - Git requires forward slashes even on Windows
            const normalizedPath = relativePath.split(path.sep).join('/');
            return await this.git.show([`${commitHash}:${normalizedPath}`]);
        }
        catch (error) {
            console.error(`Error fetching file ${filePath} at ${commitHash}:`, error);
            return ''; // Return empty string if deleted or not found
        }
    }
    /**
     * Get raw diff between two commits for a file.
     */
    async getDiff(filePath, hashA, hashB) {
        let relativePath = filePath;
        if (path.isAbsolute(filePath)) {
            relativePath = path.relative(this.workspaceRoot, filePath);
        }
        const normalizedPath = relativePath.split(path.sep).join('/');
        try {
            return await this.git.diff([hashA, hashB, '--', normalizedPath]);
        }
        catch (error) {
            console.error('Error getting diff:', error);
            return '';
        }
    }
    /**
     * Get list of changed files for a specific commit.
     */
    async getChangedFiles(hash) {
        try {
            // git show --name-status --format= <commit>
            // Passing arguments as separate array items avoids parsing ambiguity
            const result = await this.git.show([hash, '--name-status', '--format=']);
            return result.split('\n')
                .filter(line => line.trim().length > 0)
                .map(line => {
                const [status, filePath] = line.split(/\t/);
                return {
                    status: status || 'M',
                    path: filePath || line
                };
            });
        }
        catch (error) {
            console.error('Error getting changed files:', error);
            return [];
        }
    }
    /**
     * Get the file tree of a specific commit.
     */
    async getTree(hash) {
        try {
            // git ls-tree -r --name-only <commit>
            const result = await this.git.raw(['ls-tree', '-r', '--name-only', hash]);
            return result.split('\n').filter(line => line.trim().length > 0);
        }
        catch (error) {
            console.error(`Error fetching tree for ${hash}:`, error);
            return [];
        }
    }
    parseBranchName(refs) {
        if (!refs)
            return undefined;
        // refs example: "HEAD -> master, origin/master"
        const matches = refs.match(/HEAD -> ([^,]+)/);
        if (matches && matches[1])
            return matches[1];
        const branchMatch = refs.split(',').find(r => !r.includes('tag:') && !r.includes('HEAD'));
        return branchMatch ? branchMatch.trim() : undefined;
    }
    /**
     * Revert a specific commit.
     */
    async revert(hash) {
        try {
            await this.git.revert(hash);
        }
        catch (error) {
            throw new Error(`Failed to revert commit ${hash}: ${error}`);
        }
    }
    /**
     * Checkout a specific commit (detached HEAD).
     */
    async checkout(hash) {
        try {
            await this.git.checkout(hash);
        }
        catch (error) {
            throw new Error(`Failed to checkout commit ${hash}: ${error}`);
        }
    }
    /**
     * Get details for a single commit (header + files).
     */
    async getCommitDetails(hash) {
        try {
            // Get header info
            const separator = '::::';
            const format = `%H${separator}%P${separator}%an${separator}%ae${separator}%ad${separator}%B${separator}%at`; // %B for full body
            const logResult = await this.git.show([hash, `--format=${format}`, '--no-patch']);
            const [fullHash, parents, author, email, date, message, timestamp] = logResult.trim().split(separator);
            // Get file stats
            const files = await this.getChangedFiles(hash);
            return {
                hash: fullHash,
                parents: parents ? parents.split(' ') : [],
                author: author,
                email: email,
                date: date,
                message: message ? message.trim() : '',
                timestamp: parseInt(timestamp, 10),
                files: files
            };
        }
        catch (error) {
            console.error(`Error fetching details for ${hash}:`, error);
            return null;
        }
    }
}
exports.GitService = GitService;
//# sourceMappingURL=gitService.js.map