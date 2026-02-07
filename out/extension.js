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
const path = __importStar(require("path"));
const gitUtils_1 = require("./gitUtils");
const diffUtils_1 = require("./diffUtils");
const panel_1 = require("./webview/panel");
const gitService_1 = require("./services/gitService");
const timelinePanel_1 = require("./webview/timelinePanel");
const commitDetailsPanel_1 = require("./webview/commitDetailsPanel");
const gitFileSystemProvider_1 = require("./services/gitFileSystemProvider");
const graphEngine_1 = require("./services/graphEngine");
function activate(context) {
    console.log('GitRewind extension is now active!');
    // --- Compare Logic State ---
    let compareState = null;
    // Register FileSystem Provider for binary support (images etc)
    const fsProvider = new gitFileSystemProvider_1.GitFileSystemProvider(async (path) => {
        return await gitService_1.GitService.create(path);
    });
    context.subscriptions.push(vscode.workspace.registerFileSystemProvider(gitFileSystemProvider_1.GitFileSystemProvider.scheme, fsProvider, { isCaseSensitive: true, isReadonly: true }));
    // --- Pagination State ---
    let currentRepoPath = '';
    let currentCommitLimit = 300;
    // --- Main Command: Show Repository Graph ---
    let disposable = vscode.commands.registerCommand('codeTimeMachine.showHistory', async () => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        let targetPath = '';
        if (workspaceFolders && workspaceFolders.length > 0) {
            targetPath = workspaceFolders[0].uri.fsPath;
        }
        else {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                targetPath = editor.document.uri.fsPath;
            }
        }
        if (!targetPath) {
            vscode.window.showErrorMessage("Please open a Git repository folder to use GitRewind.");
            return;
        }
        // Reset limit on fresh open
        currentRepoPath = targetPath;
        currentCommitLimit = 300;
        await showRepoTimeline(context, targetPath, currentCommitLimit);
    });
    // --- Load More Commits Command ---
    let loadMoreDisposable = vscode.commands.registerCommand('codeTimeMachine.loadMoreCommits', async () => {
        if (!currentRepoPath) {
            // Try to recover path from workspace
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders)
                currentRepoPath = workspaceFolders[0].uri.fsPath;
            else
                return;
        }
        currentCommitLimit += 100;
        await showRepoTimeline(context, currentRepoPath, currentCommitLimit);
    });
    // --- Internal commands for the webview interactions ---
    let detailsDisposable = vscode.commands.registerCommand('codeTimeMachine.showCommitDetails', async (hash) => {
        await showCommitDetails(context, hash);
    });
    let browseDisposable = vscode.commands.registerCommand('codeTimeMachine.browseCommit', async (hash) => {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
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
    let openFileDisposable = vscode.commands.registerCommand('codeTimeMachine.openFileAtCommit', async (hash, filePath, status = 'M') => {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
        if (!workspaceRoot)
            return;
        try {
            const makeUri = (commitHash, path) => {
                const safePath = path.startsWith('/') ? path : '/' + path;
                return vscode.Uri.from({
                    scheme: gitFileSystemProvider_1.GitFileSystemProvider.scheme,
                    authority: commitHash,
                    path: safePath,
                    query: workspaceRoot
                });
            };
            if (status === 'D') {
                const parentHash = `${hash}~1`;
                const uri = makeUri(parentHash, filePath);
                await vscode.commands.executeCommand('vscode.open', uri, { preview: true });
            }
            else if (status === 'M') {
                const parentHash = `${hash}~1`;
                const leftUri = makeUri(parentHash, filePath);
                const rightUri = makeUri(hash, filePath);
                const diffTitle = `${path.basename(filePath)} (${hash.substring(0, 7)})`;
                await vscode.commands.executeCommand('vscode.diff', leftUri, rightUri, diffTitle);
            }
            else {
                const uri = makeUri(hash, filePath);
                await vscode.commands.executeCommand('vscode.open', uri, { preview: true });
            }
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
    let navigateDisposable = vscode.commands.registerCommand('codeTimeMachine.navigateToCommit', async (hash) => {
        const editor = vscode.window.activeTextEditor;
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
        const targetPath = editor?.document.uri.fsPath || workspaceRoot;
        if (!targetPath)
            return;
        const gitUtils = await (0, gitUtils_1.createGitUtils)(targetPath);
        if (!gitUtils)
            return;
        try {
            const details = await gitUtils.getCommitDetails(hash);
            if (details && panel_1.CodeTimeMachinePanel.currentPanel) {
                panel_1.CodeTimeMachinePanel.currentPanel.handleExternalMessage({
                    command: 'setCommitDetails',
                    details: details
                });
            }
        }
        catch (e) {
            vscode.window.showErrorMessage("Failed to load commit details: " + e);
        }
    });
    let selectFileDisposable = vscode.commands.registerCommand('codeTimeMachine.selectFile', async (hash, filePath, status) => {
        const editor = vscode.window.activeTextEditor;
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
        const targetPath = editor?.document.uri.fsPath || workspaceRoot;
        if (!targetPath)
            return;
        const gitUtils = await (0, gitUtils_1.createGitUtils)(targetPath);
        if (!gitUtils)
            return;
        try {
            let leftContent = '';
            let rightContent = '';
            let leftTitle = 'Previous';
            let rightTitle = 'Current';
            if (status === 'A') {
                rightContent = await gitUtils.getFileAtCommit(filePath, hash) || '';
                leftTitle = 'Non-existent';
                rightTitle = `Added in ${hash.substring(0, 7)}`;
            }
            else if (status === 'D') {
                const details = await gitUtils.getCommitDetails(hash);
                if (details && details.parents && details.parents.length > 0) {
                    leftContent = await gitUtils.getFileAtCommit(filePath, details.parents[0]) || '';
                    leftTitle = `Commit ${details.parents[0].substring(0, 7)}`;
                }
                else {
                    leftTitle = 'Unknown Parent';
                }
                rightTitle = 'Deleted';
            }
            else {
                // Modified
                rightContent = await gitUtils.getFileAtCommit(filePath, hash) || '';
                const details = await gitUtils.getCommitDetails(hash);
                if (details && details.parents && details.parents.length > 0) {
                    leftContent = await gitUtils.getFileAtCommit(filePath, details.parents[0]) || '';
                    leftTitle = `Commit ${details.parents[0].substring(0, 7)}`;
                }
                else {
                    leftTitle = 'Initial Commit';
                }
                rightTitle = `Commit ${hash.substring(0, 7)}`;
            }
            const diffHtml = diffUtils_1.DiffUtils.generateSideBySideHtml(leftContent, rightContent, leftTitle, rightTitle, filePath);
            if (panel_1.CodeTimeMachinePanel.currentPanel) {
                panel_1.CodeTimeMachinePanel.currentPanel.handleExternalMessage({
                    command: 'updateDiff',
                    diffHtml: diffHtml
                });
            }
        }
        catch (e) {
            vscode.window.showErrorMessage("Failed to load file diff: " + e);
        }
    });
    // Compare File Command
    let compareFileDisposable = vscode.commands.registerCommand('codeTimeMachine.compareFile', async (hash, filePath) => {
        // If filePath is missing, we could prompt for it, but for now assuming it comes from UI
        if (!filePath) {
            vscode.window.showErrorMessage("Please select a file to compare.");
            return;
        }
        compareState = { hash, path: filePath };
        // Focus Timeline and set mode
        if (timelinePanel_1.TimelinePanel.currentPanel) {
            timelinePanel_1.TimelinePanel.currentPanel.setSelectMode(true, `Select a commit to compare '${path.basename(filePath)}' with...`);
        }
        else {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders) {
                await showRepoTimeline(context, workspaceFolders[0].uri.fsPath);
                // After showing, set mode
                setTimeout(() => {
                    if (timelinePanel_1.TimelinePanel.currentPanel) {
                        timelinePanel_1.TimelinePanel.currentPanel.setSelectMode(true, `Select a commit to compare '${path.basename(filePath)}' with...`);
                    }
                }, 800);
            }
        }
    });
    let compareWithSelectedDisposable = vscode.commands.registerCommand('codeTimeMachine.compareWithSelectedCommit', async (hash) => {
        const compState = compareState;
        if (!compState) {
            vscode.window.showErrorMessage("No file selected for comparison.");
            return;
        }
        const { hash: sourceHash, path: relativePath } = compState;
        compareState = null; // Clear state
        if (timelinePanel_1.TimelinePanel.currentPanel) {
            timelinePanel_1.TimelinePanel.currentPanel.setSelectMode(false);
        }
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
        if (!workspaceRoot)
            return;
        // Source URI (from Commit A)
        const sourceUri = vscode.Uri.parse(`${gitFileSystemProvider_1.GitFileSystemProvider.scheme}:/${relativePath}?hash=${sourceHash}`);
        // Target URI (from Commit B)
        const targetUri = vscode.Uri.parse(`${gitFileSystemProvider_1.GitFileSystemProvider.scheme}:/${relativePath}?hash=${hash}`);
        const compareTitle = `${path.basename(relativePath)} (${sourceHash.substring(0, 7)} ↔ ${hash.substring(0, 7)})`;
        await vscode.commands.executeCommand('vscode.diff', sourceUri, targetUri, compareTitle);
    });
    context.subscriptions.push(disposable, detailsDisposable, browseDisposable, openFileDisposable, revertDisposable, checkoutDisposable, copyHashDisposable, navigateDisposable, selectFileDisposable, compareFileDisposable, compareWithSelectedDisposable, loadMoreDisposable);
}
exports.activate = activate;
// --- Helper Functions ---
async function showFileHistory(context, editor) {
    const filePath = editor.document.uri.fsPath;
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    const targetPath = workspaceRoot || filePath;
    if (!targetPath)
        return;
    const gitUtils = await (0, gitUtils_1.createGitUtils)(filePath);
    if (!gitUtils) {
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
            const commits = await gitUtils.getFileHistory(filePath, 50);
            // 2. Fetch Initial Details for the latest commit (if any)
            let initialDetails = null;
            let diffHtml = '';
            if (commits.length > 0) {
                const head = commits[0]; // Latest commit
                // Prepare initial view: show diff of this file in the latest commit
                // vs its parent.
                const fileDiff = await gitUtils.getDiff(filePath, head.hash + '~1', head.hash);
                // Note: This simple diff might fail for initial commits.
                // For the File History Panel, we just need basic info first.
            }
            // 3. Open Panel
            panel_1.CodeTimeMachinePanel.createOrShow(context.extensionUri, {
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
async function showRepoTimeline(context, targetPath, limit = 300) {
    // Use GitService to find root (it handles finding root from a subfolder path)
    const gitService = await gitService_1.GitService.create(targetPath);
    if (!gitService) {
        vscode.window.showErrorMessage("The current folder or file is not part of a Git repository. Please open a folder that has been initialized with Git.");
        return;
    }
    // Fetch Graph
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Loading Git Graph (${limit} commits)...`,
        cancellable: false
    }, async () => {
        const commits = await gitService.getCommitGraph(limit); // Fetch last 100
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
        timelinePanel_1.TimelinePanel.createOrShow(context.extensionUri, graphData);
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
        // Open detailed view in a new panel (new tab)
        commitDetailsPanel_1.CommitDetailsPanel.createOrShow(context.extensionUri, details);
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