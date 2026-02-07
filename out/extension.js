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
const gitService_1 = require("./services/gitService");
const timelinePanel_1 = require("./webview/timelinePanel");
const graphEngine_1 = require("./services/graphEngine");
function activate(context) {
    console.log('Code Time Machine extension is now active!');
    // --- Legacy "Show History" (Function/Selection scope) ---
    // We are keeping this for now as requested, but we could route it through ScopeResolver later.
    // --- Legacy "Show History" (Function/Selection scope) ---
    // NOW: The primary entry point. Redirects to the main Timeline View.
    let disposable = vscode.commands.registerCommand('codeTimeMachine.showHistory', async () => {
        // Determine context (File vs Repo) - for now default to Repo Timeline
        await showRepoTimeline(context);
    });
    // --- New "Show Repository Timeline" (Repo scope) ---
    let repoHistoryDisposable = vscode.commands.registerCommand('codeTimeMachine.showRepoHistory', async () => {
        await showRepoTimeline(context);
    });
    // --- Internal commands for the new webview ---
    let detailsDisposable = vscode.commands.registerCommand('codeTimeMachine.showCommitDetails', async (hash) => {
        await showCommitDetails(context, hash);
    });
    let browseDisposable = vscode.commands.registerCommand('codeTimeMachine.browseCommit', async (hash) => {
        // ... existing browse logic
        const editor = vscode.window.activeTextEditor;
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
        const targetPath = editor?.document.uri.fsPath || workspaceRoot;
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
    let openFileDisposable = vscode.commands.registerCommand('codeTimeMachine.openFileAtCommit', async (hash, filePath) => {
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
    let revertDisposable = vscode.commands.registerCommand('codeTimeMachine.revertCommit', async (hash) => {
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
    let checkoutDisposable = vscode.commands.registerCommand('codeTimeMachine.checkoutCommit', async (hash) => {
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
    let copyHashDisposable = vscode.commands.registerCommand('codeTimeMachine.copyHash', async (hash) => {
        await vscode.env.clipboard.writeText(hash);
        vscode.window.showInformationMessage(`Copied hash ${hash.substring(0, 7)} to clipboard`);
    });
    context.subscriptions.push(disposable, repoHistoryDisposable, detailsDisposable, browseDisposable, openFileDisposable, revertDisposable, checkoutDisposable, copyHashDisposable);
}
exports.activate = activate;
async function showRepoTimeline(context) {
    const editor = vscode.window.activeTextEditor;
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath; // Simplified
    // Use GitService to find root
    const targetPath = editor?.document.uri.fsPath || workspaceRoot;
    if (!targetPath) {
        vscode.window.showErrorMessage("No workspace or file open.");
        return;
    }
    const gitService = await gitService_1.GitService.create(targetPath);
    if (!gitService) {
        vscode.window.showErrorMessage("Not a git repository.");
        return;
    }
    // Fetch Graph
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Loading Git Graph...",
        cancellable: false
    }, async () => {
        const commits = await gitService.getCommitGraph(100); // Fetch last 100
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
    });
}
async function showCommitDetails(context, hash) {
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
        if (!details) {
            vscode.window.showErrorMessage("Failed to fetch commit details.");
            return;
        }
        if (timelinePanel_1.TimelinePanel.currentPanel) {
            timelinePanel_1.TimelinePanel.currentPanel.postMessage({
                command: 'setCommitDetails',
                details: details
            });
        }
    }
    catch (e) {
        vscode.window.showErrorMessage("Error loading details: " + e);
    }
}
function deactivate() {
    // cleanup
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map