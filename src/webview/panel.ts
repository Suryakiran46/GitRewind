import * as vscode from 'vscode';
import { CommitInfo } from '../services/types';
import { FunctionInfo } from '../parser';
import { ChangeStats } from '../diffUtils';

export interface WebviewData {
    commits: CommitInfo[];
    currentCommitIndex: number;
    functionName: string;
    currentFunction: FunctionInfo | null;
    historicalFunction: FunctionInfo | null;
    diffHtml: string;
    filePath: string;
    similarity: number;
    changeStats?: ChangeStats;
    isControlPanelMode?: boolean;
    hasChanges?: boolean;
    noChangesReason?: 'identical' | 'not-found';
}

export class GitRewindPanel {
    public static currentPanel: GitRewindPanel | undefined;
    public static readonly viewType = 'codeTimeMachine';

    private readonly panel: vscode.WebviewPanel;
    private readonly extensionUri: vscode.Uri;
    private disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri, data: WebviewData) {
        const column = vscode.window.activeTextEditor
            ? vscode.ViewColumn.Beside
            : undefined;

        // If we already have a panel, show it.
        if (GitRewindPanel.currentPanel) {
            GitRewindPanel.currentPanel.panel.reveal(column);
            GitRewindPanel.currentPanel.updateContent(data);
            return;
        }

        // Otherwise, create a new panel.
        const panel = vscode.window.createWebviewPanel(
            GitRewindPanel.viewType,
            'GitRewind',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'src', 'webview')
                ]
            }
        );

        GitRewindPanel.currentPanel = new GitRewindPanel(panel, extensionUri, data);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, data: WebviewData) {
        this.panel = panel;
        this.extensionUri = extensionUri;

        // Set the webview's initial html content
        this.updateContent(data);

        // Listen for when the panel is disposed
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

        // Handle messages from the webview
        this.panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'navigateToCommit':
                        this.handleNavigateToCommit(message.commitIndex, message.hash);
                        return;
                    case 'showCommitDetails':
                        this.handleShowCommitDetails(message.commit);
                        return;
                    case 'openCurrentFile':
                        this.handleOpenCurrentFile();
                        return;
                    case 'copyCommitHash':
                        this.handleCopyCommitHash(message.hash);
                        return;
                    case 'navigateDiff':
                        this.handleNavigateDiff(message.direction);
                        return;
                    case 'selectFile':
                        this.handleSelectFile(message.filePath, message.status, message.hash);
                        return;
                }
            },
            null,
            this.disposables
        );
    }

    private handleNavigateToCommit(commitIndex: number, hash: string) {
        // Emit an event that the extension can listen to
        vscode.commands.executeCommand('GitRewind.navigateToCommit', hash);
    }

    private handleSelectFile(filePath: string, status: string, hash: string) {
        vscode.commands.executeCommand('GitRewind.selectFile', hash, filePath, status);
    }

    private handleShowCommitDetails(commit: CommitInfo) {
        vscode.window.showInformationMessage(
            `Commit: ${commit.hash.substring(0, 8)}\nAuthor: ${commit.author}\nDate: ${commit.date}\nMessage: ${commit.message}`,
            { modal: false }
        );
    }

    private handleOpenCurrentFile() {
        vscode.commands.executeCommand('GitRewind.openCurrentFile');
    }

    private handleCopyCommitHash(hash: string) {
        vscode.env.clipboard.writeText(hash).then(() => {
            vscode.window.showInformationMessage(`Copied commit hash: ${hash.substring(0, 8)}`);
        });
    }

    private handleNavigateDiff(direction: string) {
        // Navigate to next/previous diff in the active diff editor
        const command = direction === 'next' ? 'editor.action.diffReview.next' : 'editor.action.diffReview.prev';
        vscode.commands.executeCommand(command);
    }

    public handleExternalMessage(message: any) {
        this.panel.webview.postMessage(message);
    }

    public updateContent(data: WebviewData) {
        this.panel.webview.html = this.getWebviewContent(data);
    }

    public dispose() {
        GitRewindPanel.currentPanel = undefined;

        // Clean up our resources
        this.panel.dispose();

        while (this.disposables.length) {
            const x = this.disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
    }

    private getWebviewContent(data: WebviewData): string {
        const isControlPanel = data.isControlPanelMode;

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
    <title>GitRewind</title>
    <style>
        :root {
            --border-color: var(--vscode-panel-border);
            --bg-color: var(--vscode-editor-background);
            --text-color: var(--vscode-editor-foreground);
            --hover-bg: var(--vscode-list-hoverBackground);
            --active-bg: var(--vscode-list-activeSelectionBackground);
            --active-fg: var(--vscode-list-activeSelectionForeground);
        }

        body {
            font-family: var(--vscode-font-family);
            margin: 0;
            padding: 0;
            background-color: var(--bg-color);
            color: var(--text-color);
            height: 100vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        /* --- Layer 1: Timeline (Top) --- */
        .timeline-container {
            height: 120px;
            border-bottom: 2px solid var(--border-color);
            background: var(--vscode-sideBar-background);
            display: flex;
            flex-direction: column;
            flex-shrink: 0;
        }

        .section-header {
            padding: 8px 16px;
            font-size: 11px;
            text-transform: uppercase;
            font-weight: 600;
            color: var(--vscode-descriptionForeground);
            background: rgba(0,0,0,0.1);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .timeline-scroll-area {
            flex: 1;
            overflow-x: auto;
            overflow-y: hidden;
            display: flex;
            align-items: center;
            padding: 0 20px;
            /* gap: 20px; Removed gap to manually control line connectivity */
        }

        .timeline-node {
            display: flex;
            flex-direction: column;
            align-items: center;
            cursor: pointer;
            opacity: 0.6;
            transition: all 0.2s;
            min-width: 120px; /* Increased width */
            position: relative;
        }

        /* ... */

        .timeline-line {
            position: absolute;
            top: 6px; /* Center of dot */
            left: 50%;
            width: 100%; /* Spans to the center of the next node */
            height: 2px;
            background: var(--border-color);
            z-index: -1;
        }
        
        .timeline-node:last-child .timeline-line {
            display: none;
        }

        /* --- Main Content Area (Layers 2 & 3) --- */
        .main-content {
            flex: 1;
            display: flex;
            overflow: hidden;
        }

        /* --- Layer 2: Changes / Commit Details (Left Sidebar) --- */
        .changes-sidebar {
            width: 300px;
            border-right: 1px solid var(--border-color);
            background: var(--vscode-sideBar-background);
            display: flex;
            flex-direction: column;
            flex-shrink: 0;
        }

        .commit-meta {
            padding: 16px;
            border-bottom: 1px solid var(--border-color);
        }

        .commit-meta h3 {
            margin: 0 0 8px 0;
            font-size: 14px;
        }

        .commit-meta p {
            margin: 4px 0;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }

        .file-list {
            flex: 1;
            overflow-y: auto;
            padding: 0;
            list-style: none;
            margin: 0;
        }

        .file-item {
            padding: 6px 16px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            border-left: 3px solid transparent;
        }

        .file-item:hover {
            background: var(--hover-bg);
        }

        .file-item.active {
            background: var(--active-bg);
            color: var(--active-fg);
            border-left-color: var(--vscode-progressBar-background);
        }

        .file-status {
            font-weight: bold;
            width: 16px;
            text-align: center;
        }

        .status-M { color: var(--vscode-gitDecoration-modifiedResourceForeground); }
        .status-A { color: var(--vscode-gitDecoration-addedResourceForeground); }
        .status-D { color: var(--vscode-gitDecoration-deletedResourceForeground); }

        .file-name {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        /* --- Layer 3: Diff View (Right Panel) --- */
        .diff-panel {
            flex: 1;
            display: flex;
            flex-direction: column;
            background: var(--bg-color);
            min-width: 0; /* Prevent flex overflow */
        }

        /* (Reuse existing diff styles but scoped to diff-panel) */
        .diff-container {
            flex: 1;
            display: flex;
            overflow: hidden;
            font-family: 'SF Mono', Monaco, Consolas, monospace;
            font-size: 12px;
        }

        .diff-side {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-width: 0;
            border-right: 1px solid var(--border-color);
        }

        .diff-side:last-child {
            border-right: none;
        }

        .diff-header-bar {
            padding: 8px;
            background: var(--vscode-editor-lineHighlightBackground);
            border-bottom: 1px solid var(--border-color);
            font-weight: 500;
            text-align: center;
            font-size: 12px;
        }

        .diff-content {
            flex: 1;
            overflow: auto;
            white-space: pre;
        }
        
        .line {
            display: flex;
            line-height: 1.5;
        }
        
        .line-number {
            width: 40px;
            text-align: right;
            padding-right: 10px;
            color: var(--vscode-editorLineNumber-foreground);
            background: var(--vscode-editorGutter-background);
            user-select: none;
            flex-shrink: 0;
        }

        .line-code {
            padding-left: 10px;
            flex: 1;
        }

        .line.added { background: rgba(40, 167, 69, 0.2); }
        .line.removed { background: rgba(220, 53, 69, 0.2); }
        
        .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: var(--vscode-descriptionForeground);
            text-align: center;
            padding: 40px;
        }

        .empty-state h3 { margin-bottom: 10px; color: var(--text-color); }
        
    </style>
</head>
<body>
    <!-- Layer 1: Timeline -->
    <div class="timeline-container">
        <div class="section-header">
            <span>Commit Timeline</span>
            <span>Total: ${data.commits.length}</span>
        </div>
        <div class="timeline-scroll-area" id="timeline">
            ${data.commits.map((commit, index) => `
                <div class="timeline-node ${index === data.currentCommitIndex ? 'active' : ''}" 
                     onclick="selectCommit(${index})"
                     title="${this.escapeHtml(commit.message)}">
                    <div class="timeline-dot"></div>
                    <div class="timeline-line"></div>
                    <div class="timeline-date">${new Date(commit.date).toLocaleDateString()}</div>
                    <div class="timeline-message">${commit.hash.substring(0, 7)}</div>
                </div>
            `).join('')}
        </div>
    </div>

    <!-- Main Content -->
    <div class="main-content">
        <!-- Layer 2: Changes Sidebar -->
        <div class="changes-sidebar">
            <div class="section-header">Event Details</div>
            
            <div class="commit-meta">
                <h3>${this.escapeHtml(data.commits[data.currentCommitIndex]?.message || 'No Commit Selected')}</h3>
                <p><strong>Author:</strong> ${this.escapeHtml(data.commits[data.currentCommitIndex]?.author || '')}</p>
                <p><strong>Date:</strong> ${new Date(data.commits[data.currentCommitIndex]?.date || Date.now()).toLocaleString()}</p>
                <p><strong>Hash:</strong> ${data.commits[data.currentCommitIndex]?.hash.substring(0, 8) || ''}</p>
            </div>

            <div class="section-header" style="background: transparent; border-top: 1px solid var(--border-color); margin-top: 0;">
                Changes
            </div>

            <ul class="file-list" id="fileList">
                <!-- File list will be populated here via JS or Initial Data -->
                ${data.changeStats?.changeBlocks?.map(block => `
                    <!-- This part needs to be dynamic based on 'Initial Details' which we might not have fully mapped yet. 
                         For now, we'll use a placeholder or assume the backend sends a list of changed files. -->
                `).join('') || '<li style="padding: 16px; color: var(--vscode-descriptionForeground);">Select a commit to view changes.</li>'}
            </ul>
        </div>

        <!-- Layer 3: Diff Panel -->
        <div class="diff-panel">
            ${data.diffHtml ? data.diffHtml : `
                <div class="empty-state">
                    <h3>No File Selected</h3>
                    <p>Select a file from the list on the left to view the changes in this commit.</p>
                </div>
            `}
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const commitsData = ${JSON.stringify(data.commits)};

        // --- Layer 1 Interaction ---
        function selectCommit(index) {
            const commit = commitsData[index];
            vscode.postMessage({
                command: 'navigateToCommit',
                commitIndex: index,
                hash: commit.hash
            });
            
            // Optimistic UI update
            document.querySelectorAll('.timeline-node').forEach((el, i) => {
                if (i === index) el.classList.add('active');
                else el.classList.remove('active');
            });
            
            // Scroll into view
            const node = document.querySelectorAll('.timeline-node')[index];
            if (node) {
                node.scrollIntoView({ behavior: 'smooth', inline: 'center' });
            }
        }

        // --- Layer 2 Interaction ---
        function selectFile(filePath, status, hash) {
            // Highlight selected
            document.querySelectorAll('.file-item').forEach(el => el.classList.remove('active'));
            const element = document.getElementById('file-' + filePath.replace(/[^a-zA-Z0-9]/g, '_'));
            if (element) element.classList.add('active');

            vscode.postMessage({
                command: 'selectFile',
                filePath: filePath,
                status: status,
                hash: hash
            });
        }

        // --- Message Handling ---
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'setCommitDetails':
                    updateCommitDetails(message.details);
                    break;
                case 'updateDiff':
                    const diffPanel = document.querySelector('.diff-panel');
                    if (diffPanel) {
                        diffPanel.innerHTML = message.diffHtml;
                    }
                    break;
            }
        });
        
        function updateCommitDetails(details) {
            // Update Meta Header
            const metaContainer = document.querySelector('.commit-meta');
            if (metaContainer) {
                metaContainer.innerHTML = \`
                    <h3>\${escapeHtml(details.message)}</h3>
                    <p><strong>Author:</strong> \${escapeHtml(details.author)}</p>
                    <p><strong>Date:</strong> \${new Date(details.date).toLocaleString()}</p>
                    <p><strong>Hash:</strong> \${details.hash.substring(0, 8)}</p>
                \`;
            }

            // Update File List
            const fileList = document.querySelector('.file-list');
            if (fileList) {
                if (details.files && details.files.length > 0) {
                    fileList.innerHTML = details.files.map(file => \`
                        <li class="file-item" 
                            id="file-\${file.path.replace(/[^a-zA-Z0-9]/g, '_')}"
                            onclick="selectFile('\${escapeHtml(file.path)}', '\${file.status}', '\${details.hash}')">
                            <span class="file-status status-\${file.status}">\${file.status}</span>
                            <span class="file-name" title="\${escapeHtml(file.path)}">\${escapeHtml(file.path)}</span>
                        </li>
                    \`).join('');
                } else {
                    fileList.innerHTML = '<li style="padding: 16px; color: var(--vscode-descriptionForeground);">No files changed in this commit.</li>';
                }
            }
        }
        
        function escapeHtml(text) {
            if (!text) return '';
            return text
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }
        
        // Auto-scroll timeline to active on load
        const activeNode = document.querySelector('.timeline-node.active');
        if (activeNode) {
            activeNode.scrollIntoView({ behavior: 'smooth', inline: 'center' });
        }
        
        // --- Keyboard Navigation ---
        document.addEventListener('keydown', (e) => {
             const currentIndex = ${data.currentCommitIndex};
             const total = ${data.commits.length};
             
            if (e.key === 'ArrowLeft') {
                if (currentIndex > 0) selectCommit(currentIndex - 1);
            } else if (e.key === 'ArrowRight') {
                if (currentIndex < total - 1) selectCommit(currentIndex + 1);
            }
        });
    </script>
</body>
</html>`;
    }
}

