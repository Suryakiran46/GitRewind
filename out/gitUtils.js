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
exports.createGitUtils = exports.GitUtils = void 0;
const simple_git_1 = require("simple-git");
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
class GitUtils {
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
        this.git = (0, simple_git_1.simpleGit)(workspaceRoot);
    }
    /**
     * Get the Git repository root for the given file
     */
    static async getRepoRoot(filePath) {
        try {
            const git = (0, simple_git_1.simpleGit)(path.dirname(filePath));
            const isRepo = await git.checkIsRepo();
            if (!isRepo) {
                return null;
            }
            const root = await git.revparse(['--show-toplevel']);
            return root.trim();
        }
        catch (error) {
            console.error('Error getting repo root:', error);
            return null;
        }
    }
    /**
     * Get commit history for a specific file
     */
    async getFileHistory(filePath, maxCount = 10) {
        try {
            const relativePath = path.relative(this.workspaceRoot, filePath);
            const log = await this.git.log({
                file: relativePath,
                maxCount
            });
            return log.all.map((commit) => ({
                hash: commit.hash,
                date: commit.date,
                message: commit.message,
                author: commit.author_name || commit.author || 'Unknown'
            }));
        }
        catch (error) {
            console.error('Error getting file history:', error);
            throw new Error(`Failed to get Git history: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Get file contents at a specific commit
     */
    async getFileAtCommit(filePath, commitHash) {
        try {
            const relativePath = path.relative(this.workspaceRoot, filePath);
            const content = await this.git.show([`${commitHash}:${relativePath}`]);
            return content;
        }
        catch (error) {
            console.error(`Error getting file at commit ${commitHash}:`, error);
            return null;
        }
    }
    /**
     * Check if the workspace has Git initialized
     */
    async isGitRepository() {
        try {
            return await this.git.checkIsRepo();
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Get the current commit hash
     */
    async getCurrentCommit() {
        try {
            const result = await this.git.revparse(['HEAD']);
            return result.trim();
        }
        catch (error) {
            console.error('Error getting current commit:', error);
            return null;
        }
    }
}
exports.GitUtils = GitUtils;
/**
 * Create a GitUtils instance for the current workspace
 */
async function createGitUtils(filePath) {
    const repoRoot = await GitUtils.getRepoRoot(filePath);
    if (!repoRoot) {
        vscode.window.showErrorMessage('This file is not in a Git repository.');
        return null;
    }
    const gitUtils = new GitUtils(repoRoot);
    const isRepo = await gitUtils.isGitRepository();
    if (!isRepo) {
        vscode.window.showErrorMessage('Git repository not found.');
        return null;
    }
    return gitUtils;
}
exports.createGitUtils = createGitUtils;
//# sourceMappingURL=gitUtils.js.map