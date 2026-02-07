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
exports.deactivate = exports.activate = void 0;
const vscode = __importStar(require("vscode"));
const diffUtils_1 = require("./diffUtils");
const panel_1 = require("./webview/panel");
const gitService_1 = require("./services/gitService");
const timelinePanel_1 = require("./webview/timelinePanel");
const graphEngine_1 = require("./services/graphEngine");
function activate(context) {
    console.log('GitRewind extension is now active!');
    // --- Main Command: Show Repository Graph ---
    // Always opens the Repo Timeline, independent of active file selection (as requested).
    let disposable = vscode.commands.registerCommand('GitRewind.showHistory', async () => {
        // We prioritize the workspace root, as this is a repo-level view.
        const workspaceFolders = vscode.workspace.workspaceFolders;
        let targetPath = '';
        if (workspaceFolders && workspaceFolders.length > 0) {
            targetPath = workspaceFolders[0].uri.fsPath;
        }
        else {
            // Fallback to active editor path if no workspace (rare for git)
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                targetPath = editor.document.uri.fsPath;
            }
        }
        if (!targetPath) {
            vscode.window.showErrorMessage("Please open a Git repository folder to use GitRewind.");
            return;
        }
        // Always show the Repo Timeline
        await showRepoTimeline(context, targetPath);
    });
    // --- Internal commands for the webview interactions ---
    let detailsDisposable = vscode.commands.registerCommand('GitRewind.showCommitDetails', async (hash) => {
        await showCommitDetails(context, hash);
    });
    let browseDisposable = vscode.commands.registerCommand('GitRewind.browseCommit', async (hash) => {
        // ... existing browse logic
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
        // Fallback if needed, though workspaceRoot should exist if we are here
        const editor = vscode.window.activeTextEditor;
        const targetPath = workspaceRoot || editor?.document.uri.fsPath;
        if (!targetPath)
            return;
        const gitService = await gitService_1.GitService.create(targetPath);
        if (!gitService)
            return;
        try {
            const files = await gitService.getTree(hash);
            const selected = await vscode.window.showQuickPick(files, {
                placeHolder: `Select a file to view from commit ${hash.substring(0, 7)}`,
                title: `Browsing Repository at ${hash.substring(0, 7)}`
            });
            if (selected) {
                const content = await gitService.getFileAtCommit(selected, hash);
                // Simple language detection based on extension
                const ext = selected.split('.').pop() || 'txt';
                const doc = await vscode.workspace.openTextDocument({
                    content: content,
                    language: ext === 'ts' ? 'typescript' : ext === 'js' ? 'javascript' : ext
                });
                await vscode.window.showTextDocument(doc, { preview: true });
            }
        }
        catch (e) {
            vscode.window.showErrorMessage("Failed to browse files: " + e);
        }
    });
    let openFileDisposable = vscode.commands.registerCommand('GitRewind.openFileAtCommit', async (hash, filePath) => {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
        if (!workspaceRoot)
            return;
        const gitService = await gitService_1.GitService.create(workspaceRoot);
        if (!gitService)
            return;
        try {
            const content = await gitService.getFileAtCommit(filePath, hash);
            const ext = filePath.split('.').pop() || 'txt';
            const doc = await vscode.workspace.openTextDocument({
                content: content,
                language: ext === 'ts' ? 'typescript' : ext === 'js' ? 'javascript' : ext
            });
            await vscode.window.showTextDocument(doc, { preview: true });
        }
        catch (e) {
            vscode.window.showErrorMessage(`Failed to open file: ${e}`);
        }
    });
    let revertDisposable = vscode.commands.registerCommand('GitRewind.revertCommit', async (hash) => {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
        if (!workspaceRoot)
            return;
        const gitService = await gitService_1.GitService.create(workspaceRoot);
        if (!gitService)
            return;
        try {
            await gitService.revert(hash);
            vscode.window.showInformationMessage(`Reverted commit ${hash.substring(0, 7)}`);
        }
        catch (e) {
            vscode.window.showErrorMessage(`Failed to revert: ${e}`);
        }
    });
    let checkoutDisposable = vscode.commands.registerCommand('GitRewind.checkoutCommit', async (hash) => {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
        if (!workspaceRoot)
            return;
        const gitService = await gitService_1.GitService.create(workspaceRoot);
        if (!gitService)
            return;
        try {
            await gitService.checkout(hash);
            vscode.window.showInformationMessage(`Checked out ${hash.substring(0, 7)} (Detached HEAD)`);
        }
        catch (e) {
            vscode.window.showErrorMessage(`Failed to checkout: ${e}`);
        }
    });
    let copyHashDisposable = vscode.commands.registerCommand('GitRewind.copyHash', async (hash) => {
        await vscode.env.clipboard.writeText(hash);
        vscode.window.showInformationMessage(`Copied hash ${hash.substring(0, 7)} to clipboard`);
    });
    let navigateDisposable = vscode.commands.registerCommand('GitRewind.navigateToCommit', async (hash) => {
        const editor = vscode.window.activeTextEditor;
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
        const targetPath = editor?.document.uri.fsPath || workspaceRoot;
        if (!targetPath)
            return;
        const gitService = await gitService_1.GitService.create(targetPath);
        if (!gitService)
            return;
        try {
            const details = await gitService.getCommitDetails(hash);
            if (details && panel_1.GitRewindPanel.currentPanel) {
                panel_1.GitRewindPanel.currentPanel.handleExternalMessage({
                    command: 'setCommitDetails',
                    details: details
                });
            }
        }
        catch (e) {
            vscode.window.showErrorMessage("Failed to load commit details: " + e);
        }
    });
    let selectFileDisposable = vscode.commands.registerCommand('GitRewind.selectFile', async (hash, filePath, status) => {
        const editor = vscode.window.activeTextEditor;
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
        const targetPath = editor?.document.uri.fsPath || workspaceRoot;
        if (!targetPath)
            return;
        const gitService = await gitService_1.GitService.create(targetPath);
        if (!gitService)
            return;
        try {
            let leftContent = '';
            let rightContent = '';
            let leftTitle = 'Previous';
            let rightTitle = 'Current';
            if (status === 'A') {
                rightContent = await gitService.getFileAtCommit(filePath, hash) || '';
                leftTitle = 'Non-existent';
                rightTitle = `Added in ${hash.substring(0, 7)}`;
            }
            else if (status === 'D') {
                const details = await gitService.getCommitDetails(hash);
                if (details && details.parents && details.parents.length > 0) {
                    leftContent = await gitService.getFileAtCommit(filePath, details.parents[0]) || '';
                    leftTitle = `Commit ${details.parents[0].substring(0, 7)}`;
                }
                else {
                    leftTitle = 'Unknown Parent';
                }
                rightTitle = 'Deleted';
            }
            else {
                // Modified
                rightContent = await gitService.getFileAtCommit(filePath, hash) || '';
                const details = await gitService.getCommitDetails(hash);
                if (details && details.parents && details.parents.length > 0) {
                    leftContent = await gitService.getFileAtCommit(filePath, details.parents[0]) || '';
                    leftTitle = `Commit ${details.parents[0].substring(0, 7)}`;
                }
                else {
                    leftTitle = 'Initial Commit';
                }
                rightTitle = `Commit ${hash.substring(0, 7)}`;
            }
            const diffHtml = diffUtils_1.DiffUtils.generateSideBySideHtml(leftContent, rightContent, leftTitle, rightTitle, filePath);
            if (panel_1.GitRewindPanel.currentPanel) {
                panel_1.GitRewindPanel.currentPanel.handleExternalMessage({
                    command: 'updateDiff',
                    diffHtml: diffHtml
                });
            }
        }
        catch (e) {
            vscode.window.showErrorMessage("Failed to load file diff: " + e);
        }
    });
    context.subscriptions.push(disposable, detailsDisposable, browseDisposable, openFileDisposable, revertDisposable, checkoutDisposable, copyHashDisposable, navigateDisposable, selectFileDisposable);
}
exports.activate = activate;
// --- Helper Functions ---
async function showFileHistory(context, editor) {
    const filePath = editor.document.uri.fsPath;
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    const targetPath = workspaceRoot || filePath;
    if (!targetPath)
        return;
    const gitService = await gitService_1.GitService.create(filePath);
    if (!gitService) {
        vscode.window.showErrorMessage("Git repository not found.");
        return;
    }
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Loading File History...",
        cancellable: false
    }, async (progress) => {
        try {
            // 1. Fetch File History (Flat List)
            // We use the simpler method for single-file history
            const commits = await gitService.getFileHistory(filePath, 50);
            // 2. Fetch Initial Details for the latest commit (if any)
            let initialDetails = null;
            let diffHtml = '';
            if (commits.length > 0) {
                const head = commits[0]; // Latest commit
                // Prepare initial view: show diff of this file in the latest commit
                // vs its parent.
                const fileDiff = await gitService.getDiff(filePath, head.hash + '~1', head.hash);
                // Note: This simple diff might fail for initial commits.
                // For the File History Panel, we just need basic info first.
            }
            // 3. Open Panel
            panel_1.GitRewindPanel.createOrShow(context.extensionUri, {
                commits: commits,
                currentCommitIndex: 0,
                functionName: '',
                currentFunction: null,
                historicalFunction: null,
                diffHtml: '',
                filePath: filePath,
                similarity: 0,
                changeStats: undefined
            });
        }
        catch (e) {
            vscode.window.showErrorMessage("Failed to load history: " + e);
        }
    });
}
async function showRepoTimeline(context, targetPath) {
    // Use GitService to find root (it handles finding root from a subfolder path)
    const gitService = await gitService_1.GitService.create(targetPath);
    if (!gitService) {
        vscode.window.showErrorMessage("The current folder or file is not part of a Git repository. Please open a folder that has been initialized with Git.");
        return;
    }
    // Fetch Graph
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Loading Git Graph...",
        cancellable: false
    }, async () => {
        try {
            const commits = await gitService.getCommitGraph(100); // Fetch last 100
            if (commits.length === 0) {
                vscode.window.showWarningMessage("No commits found in repository. Create at least one commit to use GitRewind.");
                return;
            }
            const graphEngine = new graphEngine_1.GraphEngine();
            const graphData = graphEngine.process(commits);
            // Pre-fetch details for the latest commit to avoid race conditions
            let initialDetails = undefined;
            if (commits.length > 0) {
                const headCommit = commits[0];
                try {
                    const files = await gitService.getChangedFiles(headCommit.hash);
                    initialDetails = {
                        hash: headCommit.hash,
                        author: headCommit.author,
                        email: headCommit.email,
                        date: headCommit.date,
                        message: headCommit.message,
                        files: files
                    };
                }
                catch (error) {
                    console.error("Failed to fetch initial details:", error);
                }
            }
            timelinePanel_1.TimelinePanel.createOrShow(context.extensionUri, graphData, initialDetails);
        }
        catch (error) {
            console.error('Error in showRepoTimeline:', error);
            vscode.window.showErrorMessage(`Failed to load Git graph: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
}
async function showCommitDetails(context, hash) {
    console.log('showCommitDetails called for hash:', hash);
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    if (!workspaceRoot) {
        console.error('No workspace root found');
        vscode.window.showErrorMessage("No workspace found.");
        return;
    }
    const gitService = await gitService_1.GitService.create(workspaceRoot);
    if (!gitService) {
        console.error('Failed to create GitService');
        vscode.window.showErrorMessage("Failed to initialize Git service.");
        return;
    }
    try {
        console.log('Fetching commit details for:', hash);
        const details = await gitService.getCommitDetails(hash);
        if (!details) {
            console.warn('No details returned for commit:', hash);
            vscode.window.showErrorMessage("Failed to fetch commit details.");
            return;
        }
        console.log('Got commit details:', details);
        if (timelinePanel_1.TimelinePanel.currentPanel) {
            console.log('Posting message to TimelinePanel');
            timelinePanel_1.TimelinePanel.currentPanel.postMessage({
                command: 'setCommitDetails',
                details: details
            });
        }
        else {
            console.warn('TimelinePanel.currentPanel is undefined');
        }
    }
    catch (e) {
        console.error('Error in showCommitDetails:', e);
        vscode.window.showErrorMessage(`Error loading details: ${e instanceof Error ? e.message : String(e)}`);
    }
}
function deactivate() {
    // cleanup
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map