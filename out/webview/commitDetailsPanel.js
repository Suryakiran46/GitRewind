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
exports.CommitDetailsPanel = void 0;
const vscode = __importStar(require("vscode"));
class CommitDetailsPanel {
    static createOrShow(extensionUri, details) {
        const column = vscode.ViewColumn.Active;
        // If we already have a panel, show it.
        if (CommitDetailsPanel.currentPanel) {
            CommitDetailsPanel.currentPanel.panel.reveal(column);
            CommitDetailsPanel.currentPanel.update(details);
            return;
        }
        // Otherwise, create a new panel.
        const panel = vscode.window.createWebviewPanel(CommitDetailsPanel.viewType, `Commit ${details.hash.substring(0, 7)}`, column, {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'src', 'webview')]
        });
        CommitDetailsPanel.currentPanel = new CommitDetailsPanel(panel, extensionUri, details);
    }
    constructor(panel, extensionUri, details) {
        this.disposables = [];
        this.panel = panel;
        this.extensionUri = extensionUri;
        // Set the webview's initial html content
        this.update(details);
        // Listen for when the panel is disposed
        // This happens when the user closes the panel or when the panel is closed programmatically
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
        // Handle messages from the webview
        this.panel.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'browseCommit':
                    vscode.commands.executeCommand('codeTimeMachine.browseCommit', message.hash);
                    return;
                case 'openFile':
                    vscode.commands.executeCommand('codeTimeMachine.openFileAtCommit', message.hash, message.path);
                    return;
                case 'copyHash':
                    vscode.commands.executeCommand('codeTimeMachine.copyHash', message.hash);
                    return;
                case 'compareFile':
                    vscode.commands.executeCommand('codeTimeMachine.compareFile', message.hash, message.path);
                    return;
                case 'checkoutCommit':
                    vscode.commands.executeCommand('codeTimeMachine.checkoutCommit', message.hash);
                    return;
                case 'revertCommit':
                    vscode.commands.executeCommand('codeTimeMachine.revertCommit', message.hash);
                    return;
            }
        }, null, this.disposables);
    }
    update(details) {
        this.panel.title = `Commit ${details.hash.substring(0, 7)}`;
        this.panel.webview.html = this.getHtmlForWebview(details);
    }
    dispose() {
        CommitDetailsPanel.currentPanel = undefined;
        this.panel.dispose();
        while (this.disposables.length) {
            const x = this.disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
    getHtmlForWebview(details) {
        const date = new Date(details.date).toLocaleString(undefined, {
            weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        // Parse refs
        let branchBadge = '';
        if (details.branch) {
            const updates = details.branch.split(',').map((ref) => ref.trim());
            updates.forEach((ref) => {
                let cleanRef = ref;
                let type = 'branch';
                if (cleanRef.startsWith('HEAD ->')) {
                    cleanRef = cleanRef.replace('HEAD ->', '').trim();
                    type = 'head';
                }
                else if (cleanRef.startsWith('origin/')) {
                    cleanRef = cleanRef.replace('origin/', '');
                    type = 'remote';
                }
                else if (cleanRef.startsWith('tag:')) {
                    cleanRef = cleanRef.replace('tag:', '').trim();
                    type = 'tag';
                }
                const colorClass = type === 'head' ? 'added' : (type === 'tag' ? 'modified' : 'branch-badge');
                // For tags use blue (modified), for HEAD use green (added), for others use gray
                // We can define custom classes but reusing existing ones is fine for now
                // or just inline style
                let badgeStyle = '';
                if (type === 'head')
                    badgeStyle = 'background: var(--vscode-gitDecoration-addedResourceForeground); color: var(--vscode-editor-background);';
                else if (type === 'tag')
                    badgeStyle = 'background: var(--vscode-gitDecoration-modifiedResourceForeground); color: var(--vscode-editor-background);';
                else
                    badgeStyle = 'background: var(--vscode-badge-background); color: var(--vscode-badge-foreground);';
                const tooltip = type === 'head' ? 'Current Head' : (type === 'tag' ? 'Tag' : 'Branch');
                // Use explicit label as requested
                const label = type === 'head' ? 'HEAD' : (type === 'tag' ? 'Tag: ' + cleanRef : 'Branch: ' + cleanRef);
                branchBadge += `<span class="pill" style="${badgeStyle}" title="${tooltip}: ${cleanRef}"> ${label}</span>`;
            });
        }
        // Parse Merge Info
        let mergeInfo = '';
        if (details.parents.length > 1) {
            const branchMergeMatch = details.message.match(/Merge branch '([^']+)'(?: into '([^']+)')?/);
            const prMergeMatch = details.message.match(/Merge pull request #(\d+) from ([^\s]+)/);
            if (branchMergeMatch) {
                const source = branchMergeMatch[1];
                const target = branchMergeMatch[2] || 'current branch';
                mergeInfo = `<div class="merge-info" style="margin-top:8px; font-size:0.9em; opacity:0.8; display:flex; align-items:center; gap:6px;">
                    <span style="color:var(--vscode-gitDecoration-modifiedResourceForeground);">🔀 Merged Branch</span> 
                    <strong>${source}</strong> 
                    <span>into</span> 
                    <strong>${target}</strong>
                 </div>`;
            }
            else if (prMergeMatch) {
                const prNumber = prMergeMatch[1];
                const source = prMergeMatch[2];
                mergeInfo = `<div class="merge-info" style="margin-top:8px; font-size:0.9em; opacity:0.8; display:flex; align-items:center; gap:6px;">
                    <span style="color:var(--vscode-gitDecoration-modifiedResourceForeground);">🔀 Merged PR #${prNumber}</span> 
                    <span>from</span>
                    <strong>${source}</strong>
                 </div>`;
            }
            else {
                mergeInfo = `<div class="merge-info" style="margin-top:8px; font-size:0.9em; opacity:0.8;">🔀 Merge Commit</div>`;
            }
        }
        const root = { name: 'root', path: '', type: 'folder', children: {} };
        if (details.files) {
            details.files.forEach((f) => {
                const parts = f.path.split('/');
                let current = root;
                parts.forEach((part, index) => {
                    const isFile = index === parts.length - 1;
                    const fullPath = parts.slice(0, index + 1).join('/');
                    if (!current.children)
                        current.children = {};
                    if (!current.children[part]) {
                        current.children[part] = {
                            name: part,
                            path: fullPath,
                            type: isFile ? 'file' : 'folder',
                            status: isFile ? f.status : undefined,
                            children: isFile ? undefined : {}
                        };
                    }
                    current = current.children[part];
                });
            });
        }
        function renderTree(node, depth = 0) {
            const indent = depth * 20;
            if (node.type === 'file') {
                const statusClass = node.status === 'A' ? 'added' : node.status === 'D' ? 'deleted' : 'modified';
                const statusIcon = node.status === 'A' ? '✳️' : node.status === 'D' ? '❌' : '✏️';
                // Using VS Code codified icons via simple text/emoji for now, keeping it robust
                const fileIcon = '📄';
                const safePath = node.path.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                return `<li class="file-item ${statusClass}" onclick="openFile('${details.hash}', '${safePath}', '${node.status}')" style="padding-left: ${indent + 20}px">
                    <span class="file-icon">${fileIcon}</span>
                    <span class="file-name">${node.name}</span>
                    <span class="status-badge ${statusClass}">${statusIcon} ${node.status === 'A' ? 'Added' : node.status === 'D' ? 'Deleted' : 'Modified'}</span>
                    <button class="action-btn file-action-btn" title="Compare with another commit" onclick="event.stopPropagation(); compareFile('${details.hash}', '${safePath}')">⚖️</button>
                </li>`;
            }
            else {
                const childrenHtml = Object.values(node.children || {})
                    .sort((a, b) => (a.type !== b.type ? (a.type === 'folder' ? -1 : 1) : a.name.localeCompare(b.name)))
                    .map(child => renderTree(child, depth + 1))
                    .join('');
                return `<li class="folder-item">
                    <div class="folder-header" onclick="toggleFolder(this)" style="padding-left: ${indent}px">
                         <span class="toggle-icon">▼</span>
                         <span class="folder-icon">📁</span>
                         <span class="folder-name">${node.name}</span>
                    </div>
                    <ul class="folder-children">${childrenHtml}</ul>
                </li>`;
            }
        }
        const treeHtml = Object.values(root.children || {})
            .sort((a, b) => (a.type !== b.type ? (a.type === 'folder' ? -1 : 1) : a.name.localeCompare(b.name)))
            .map(child => renderTree(child))
            .join('');
        const safeMessage = details.message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const safeAuthor = details.author.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Commit Details</title>
            <style>
                :root {
                    --bg-added: rgba(86, 209, 100, 0.1);
                    --color-added: #4caf50;
                    --bg-deleted: rgba(244, 67, 54, 0.1);
                    --color-deleted: #f44336;
                    --bg-modified: rgba(33, 150, 243, 0.1);
                    --color-modified: #2196f3;
                    --text-color: var(--vscode-editor-foreground);
                    --secondary-text: var(--vscode-descriptionForeground);
                    --border-color: var(--vscode-panel-border);
                    --header-bg: var(--vscode-editor-background);
                    --hover-bg: var(--vscode-list-hoverBackground);
                }

                body {
                    font-family: var(--vscode-font-family);
                    color: var(--text-color);
                    background-color: var(--vscode-editor-background);
                    margin: 0;
                    padding: 0;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    height: 100vh;
                }

                .container {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                }

                /* --- Header Section --- */
                .details-header {
                    padding: 24px 32px;
                    border-bottom: 1px solid var(--border-color);
                    background: linear-gradient(to bottom, var(--vscode-editor-background), var(--vscode-sideBar-background));
                    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
                }

                h2 {
                    margin: 0 0 16px 0;
                    font-size: 1.4rem;
                    font-weight: 600;
                    line-height: 1.4;
                    color: var(--vscode-editor-foreground);
                }

                .meta-row {
                    display: flex;
                    flex-wrap: wrap;
                    align-items: center;
                    gap: 12px;
                    font-size: 0.9rem;
                    color: var(--secondary-text);
                }

                .pill {
                    background: var(--vscode-badge-background);
                    color: var(--vscode-badge-foreground);
                    padding: 4px 10px;
                    border-radius: 12px;
                    font-size: 0.8rem;
                    font-weight: 500;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                }
                
                .pill.hash {
                    background: var(--vscode-textCodeBlock-background);
                    color: var(--vscode-textPreformat-foreground);
                    font-family: var(--vscode-editor-font-family);
                }

                .date-label {
                    margin-left: auto;
                    font-size: 0.85rem;
                    opacity: 0.8;
                }

                /* --- Tree View Section --- */
                .tree-container {
                    flex: 1;
                    overflow-y: auto;
                    padding: 20px 32px;
                }

                ul {
                    list-style-type: none;
                    padding-left: 0;
                    margin: 0;
                }

                .folder-item { margin-bottom: 4px; }
                
                .folder-label { 
                    cursor: pointer; 
                    padding: 6px 8px; 
                    display: flex; 
                    align-items: center; 
                    border-radius: 6px; 
                    font-weight: 500;
                    user-select: none;
                    color: var(--secondary-text);
                }
                .folder-label:hover { background: var(--hover-bg); color: var(--text-color); }

                .folder-children { 
                    padding-left: 24px; 
                    margin-top: 2px;
                    position: relative;
                }
                
                /* Tree Guide Lines */
                .folder-children::before {
                    content: "";
                    position: absolute;
                    top: 0;
                    bottom: 8px;
                    left: 11px;
                    border-left: 1px solid var(--border-color);
                    opacity: 0.5;
                }

                .file-item {
                    display: flex;
                    align-items: center;
                    padding: 6px 8px;
                    cursor: pointer;
                    border-radius: 6px;
                    margin-bottom: 2px;
                    transition: background 0.1s;
                }
                .file-item:hover { background: var(--hover-bg); }

                .folder-item.collapsed .folder-children { display: none; }
                
                .folder-icon { margin-right: 8px; font-size: 1.1em; color: var(--vscode-charts-yellow); }
                .file-icon { margin-right: 10px; font-size: 1.1em; opacity: 0.8; }
                
                .file-name {
                    flex: 1;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .status-badge {
                    font-size: 0.75rem;
                    padding: 2px 8px;
                    border-radius: 4px;
                    margin-left: 12px;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    font-weight: 600;
                    opacity: 0.9;
                }
                
                /* Status Coloring */
                .file-item.added .file-name { color: var(--color-added); }
                .file-item.added .file-icon { color: var(--color-added); }
                .status-badge.added { background: var(--bg-added); color: var(--color-added); }

                .file-item.deleted .file-name { color: var(--color-deleted); text-decoration: line-through; opacity: 0.8; }
                .file-item.deleted .file-icon { color: var(--color-deleted); }
                .status-badge.deleted { background: var(--bg-deleted); color: var(--color-deleted); }

                .file-item.modified .file-name { color: var(--color-modified); }
                .file-item.modified .file-icon { color: var(--color-modified); }
                .status-badge.modified { background: var(--bg-modified); color: var(--color-modified); }


                /* --- Footer Section --- */
                .actions-footer {
                    padding: 20px 32px;
                    border-top: 1px solid var(--border-color);
                    background: var(--vscode-sideBar-background);
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }

                .main-actions {
                    display: flex;
                    gap: 12px;
                }
                
                .main-actions button {
                    flex: 1;
                }

                .advanced-section {
                    border-top: 1px solid var(--border-color);
                    padding-top: 12px;
                }

                details { width: 100%; }
                summary { cursor: pointer; color: var(--secondary-text); margin-bottom: 8px; }
                summary:hover { color: var(--text-color); }
                .advanced-actions { display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap; }

                button.action-btn {
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 10px 20px;
                    border-radius: 6px;
                    font-weight: 500;
                    font-size: 0.9rem;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    transition: transform 0.1s, opacity 0.2s;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }

                button.action-btn:hover {
                    background: var(--vscode-button-hoverBackground);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 8px rgba(0,0,0,0.15);
                }

                button.action-btn:active {
                    transform: translateY(0);
                    box-shadow: none;
                }

                button.secondary {
                    background: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                }
                button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }

                button.danger {
                    background: var(--color-deleted);
                    color: white;
                }
                button.danger:hover { opacity: 0.9; }

                button.danger:hover { opacity: 0.9; }

                .file-action-btn {
                    padding: 2px 6px;
                    margin-left: auto;
                    font-size: 0.8rem;
                    opacity: 0.6;
                    background: transparent;
                    color: var(--text-color);
                    box-shadow: none;
                }
                .file-action-btn:hover {
                     opacity: 1;
                     background: var(--vscode-list-hoverBackground);
                     transform: scale(1.1);
                }

            </style>
        </head>
        <body>
            <div class="container">
                <div class="details-header">
                    <h2>${safeMessage} ${mergeInfo}</h2>
                    <div class="meta-row">
                        <span class="pill">👤 ${safeAuthor}</span>
                        <span class="pill hash">#${details.hash.substring(0, 8)}</span>
                        ${branchBadge}
                        <span class="date-label">📅 ${date}</span>
                    </div>
                </div>

                <div class="tree-container">
                    ${treeHtml ? `<ul>${treeHtml}</ul>` : '<div style="padding:40px; text-align:center; opacity:0.5">No file changes found in this commit.</div>'}
                </div>

                <div class="actions-footer">
                    <div class="main-actions">
                        <button class="action-btn" onclick="compareFile('${details.hash}')">⚖️ Compare File...</button>
                        <button class="action-btn" onclick="browseFiles('${details.hash}')">📂 Browse Files</button>
                    </div>
                    
                    <div class="advanced-section">
                        <details>
                            <summary>Advanced Options</summary>
                            <div class="advanced-actions">
                                <button class="action-btn secondary" onclick="checkoutCommit('${details.hash}')">🛑 Checkout</button>
                                <button class="action-btn danger" onclick="revertCommit('${details.hash}')">↩️ Revert</button>
                                <button class="action-btn secondary" onclick="copyHash('${details.hash}')">📋 Copy Hash</button>
                            </div>
                        </details>
                    </div>
                </div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();

                function openFile(hash, path, status) {
                    vscode.postMessage({ command: 'openFile', hash: hash, path: path, status: status });
                }

                function browseFiles(hash) {
                     vscode.postMessage({ command: 'browseCommit', hash: hash });
                }

                function compareFile(hash, path) {
                    vscode.postMessage({ command: 'compareFile', hash: hash, path: path });
                }

                function copyHash(hash) {
                    vscode.postMessage({ command: 'copyHash', hash: hash });
                }

                function checkoutCommit(hash) {
                    vscode.postMessage({ command: 'checkoutCommit', hash: hash });
                }

                function revertCommit(hash) {
                    vscode.postMessage({ command: 'revertCommit', hash: hash });
                }
                
                function toggleFolder(element) {
                    element.parentElement.classList.toggle('collapsed');
                }
            </script>
        </body>
        </html>`;
    }
}
exports.CommitDetailsPanel = CommitDetailsPanel;
CommitDetailsPanel.viewType = 'gitTimeMachine.commitDetails';
//# sourceMappingURL=commitDetailsPanel.js.map