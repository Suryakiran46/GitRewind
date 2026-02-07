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
exports.CodeTimeMachinePanel = void 0;
const vscode = __importStar(require("vscode"));
class CodeTimeMachinePanel {
    static createOrShow(extensionUri, data) {
        const column = vscode.window.activeTextEditor
            ? vscode.ViewColumn.Beside
            : undefined;
        // If we already have a panel, show it.
        if (CodeTimeMachinePanel.currentPanel) {
            CodeTimeMachinePanel.currentPanel.panel.reveal(column);
            CodeTimeMachinePanel.currentPanel.updateContent(data);
            return;
        }
        // Otherwise, create a new panel.
        const panel = vscode.window.createWebviewPanel(CodeTimeMachinePanel.viewType, 'Code Time Machine', column || vscode.ViewColumn.One, {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(extensionUri, 'src', 'webview')
            ]
        });
        CodeTimeMachinePanel.currentPanel = new CodeTimeMachinePanel(panel, extensionUri, data);
    }
    constructor(panel, extensionUri, data) {
        this.disposables = [];
        this.panel = panel;
        this.extensionUri = extensionUri;
        // Set the webview's initial html content
        this.updateContent(data);
        // Listen for when the panel is disposed
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
        // Handle messages from the webview
        this.panel.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'navigateToCommit':
                    this.handleNavigateToCommit(message.commitIndex);
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
            }
        }, null, this.disposables);
    }
    handleNavigateToCommit(commitIndex) {
        // Emit an event that the extension can listen to
        vscode.commands.executeCommand('codeTimeMachine.navigateToCommit', commitIndex);
    }
    handleShowCommitDetails(commit) {
        vscode.window.showInformationMessage(`Commit: ${commit.hash.substring(0, 8)}\nAuthor: ${commit.author}\nDate: ${commit.date}\nMessage: ${commit.message}`, { modal: false });
    }
    handleOpenCurrentFile() {
        vscode.commands.executeCommand('codeTimeMachine.openCurrentFile');
    }
    handleCopyCommitHash(hash) {
        vscode.env.clipboard.writeText(hash).then(() => {
            vscode.window.showInformationMessage(`Copied commit hash: ${hash.substring(0, 8)}`);
        });
    }
    handleNavigateDiff(direction) {
        // Navigate to next/previous diff in the active diff editor
        const command = direction === 'next' ? 'editor.action.diffReview.next' : 'editor.action.diffReview.prev';
        vscode.commands.executeCommand(command);
    }
    updateContent(data) {
        this.panel.webview.html = this.getWebviewContent(data);
    }
    dispose() {
        CodeTimeMachinePanel.currentPanel = undefined;
        // Clean up our resources
        this.panel.dispose();
        while (this.disposables.length) {
            const x = this.disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
    escapeHtml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
    }
    getWebviewContent(data) {
        const isControlPanel = data.isControlPanelMode;
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
    <title>Code Time Machine ${isControlPanel ? '- Control Panel' : ''}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            margin: 0;
            padding: 20px;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            line-height: 1.6;
        }

        .header {
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .header h1 {
            margin: 0 0 10px 0;
            font-size: 24px;
            color: var(--vscode-foreground);
        }

        .function-info {
            background: var(--vscode-textBlockQuote-background);
            padding: 10px;
            border-radius: 4px;
            margin-bottom: 15px;
            border-left: 4px solid var(--vscode-textLink-foreground);
        }

        .commit-navigation {
            display: flex;
            align-items: center;
            gap: 15px;
            margin-bottom: 20px;
            padding: 15px;
            background: var(--vscode-input-background);
            border-radius: 6px;
            border: 1px solid var(--vscode-input-border);
        }

        .commit-info {
            flex: 1;
        }

        .commit-hash {
            font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
            background: var(--vscode-textCodeBlock-background);
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 0.9em;
        }

        .nav-button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            transition: background-color 0.2s;
        }

        .nav-button:hover:not(:disabled) {
            background: var(--vscode-button-hoverBackground);
        }

        .nav-button:disabled {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            cursor: not-allowed;
            opacity: 0.6;
        }

        .similarity-badge {
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 0.85em;
            font-weight: 500;
        }

        .diff-container {
            display: flex;
            gap: 2px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            overflow: hidden;
            background: var(--vscode-editor-background);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .diff-container.no-changes {
            justify-content: center;
        }

        .diff-side {
            flex: 1;
            min-width: 0;
            background: var(--vscode-editor-background);
        }

        .diff-side.single {
            max-width: 900px;
        }

        .diff-header {
            background: linear-gradient(135deg, var(--vscode-panel-background), var(--vscode-input-background));
            padding: 14px 18px;
            font-weight: 600;
            border-bottom: 2px solid var(--vscode-panel-border);
            font-size: 14px;
            color: var(--vscode-foreground);
            text-align: center;
            letter-spacing: 0.5px;
        }

        .diff-content {
            font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
            font-size: 11px;
            line-height: 1.5;
            overflow-x: auto;
            max-height: 700px;
            overflow-y: auto;
            border: 1px solid var(--vscode-panel-border);
            position: relative;
        }

        .line {
            display: flex;
            min-height: 20px;
            white-space: pre;
            position: relative;
        }

        .line-number {
            color: var(--vscode-editorLineNumber-foreground);
            background: var(--vscode-editorGutter-background);
            padding: 0 10px;
            min-width: 55px;
            text-align: right;
            font-size: 11px;
            user-select: none;
            border-right: 1px solid var(--vscode-panel-border);
            font-weight: 500;
        }

        .line-content {
            padding: 0 16px;
            flex: 1;
            white-space: pre-wrap;
            word-break: break-word;
            font-family: inherit;
        }

        .line.added {
            background-color: #1e4d3e;
            border-left: 4px solid #28a745;
            font-weight: 600;
        }

        .line.added .line-content {
            color: #acf2bd;
        }

        .line.added .line-number {
            background-color: #1e4d3e;
            color: #28a745;
            font-weight: bold;
        }

        .line.removed {
            background-color: #4d1e1e;
            border-left: 4px solid #dc3545;
            font-weight: 600;
        }

        .line.removed .line-content {
            color: #f2acac;
        }

        .line.removed .line-number {
            background-color: #4d1e1e;
            color: #dc3545;
            font-weight: bold;
        }

        .line.unchanged {
            background-color: var(--vscode-editor-background);
        }

        .line.unchanged:hover {
            background-color: var(--vscode-list-hoverBackground);
        }

        /* Syntax highlighting for common tokens */
        .line-content .keyword {
            color: #569cd6;
            font-weight: bold;
        }

        .line-content .string {
            color: #ce9178;
        }

        .line-content .comment {
            color: #6a9955;
            font-style: italic;
        }

        .line-content .number {
            color: #b5cea8;
        }

        .line-content .function {
            color: #dcdcaa;
            font-weight: 500;
        }

        .no-function-message {
            text-align: center;
            padding: 40px 20px;
            color: var(--vscode-descriptionForeground);
            background: var(--vscode-textBlockQuote-background);
            border-radius: 8px;
            border: 1px solid var(--vscode-input-border);
            margin: 20px;
        }

        .no-function-message h3 {
            color: var(--vscode-foreground);
            margin-bottom: 16px;
            font-size: 18px;
        }

        .no-function-message ul {
            text-align: left;
            max-width: 400px;
            margin: 16px auto;
        }

        .no-function-message li {
            margin: 8px 0;
        }

        .commit-selector {
            margin: 20px 0;
            padding: 16px;
            background: var(--vscode-input-background);
            border-radius: 6px;
            border: 1px solid var(--vscode-input-border);
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        }

        .selector-header {
            font-weight: 600;
            margin-bottom: 12px;
            color: var(--vscode-foreground);
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .commit-dropdown {
            width: 100%;
            padding: 8px 12px;
            background: var(--vscode-dropdown-background);
            border: 1px solid var(--vscode-dropdown-border, var(--vscode-input-border));
            border-radius: 4px;
            color: var(--vscode-dropdown-foreground);
            font-size: 13px;
            font-family: inherit;
            cursor: pointer;
            appearance: none;
            -webkit-appearance: none;
            -moz-appearance: none;
            background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6,9 12,15 18,9'%3e%3c/polyline%3e%3c/svg%3e");
            background-repeat: no-repeat;
            background-position: right 8px center;
            background-size: 16px;
            padding-right: 32px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            transition: all 0.2s ease;
        }

        .commit-dropdown:hover {
            border-color: var(--vscode-focusBorder, var(--vscode-textLink-foreground));
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
        }

        .commit-dropdown:focus {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: -1px;
            border-color: var(--vscode-focusBorder);
            box-shadow: 0 0 0 1px var(--vscode-focusBorder);
        }

        .commit-dropdown option {
            background: var(--vscode-dropdown-background);
            color: var(--vscode-dropdown-foreground);
            padding: 8px 12px;
            border: none;
        }

        .commit-dropdown option:hover,
        .commit-dropdown option:focus {
            background: var(--vscode-list-hoverBackground);
        }

        .loading {
            text-align: center;
            padding: 40px;
            color: var(--vscode-descriptionForeground);
        }

        .change-stats {
            background: var(--vscode-input-background);
            padding: 15px;
            border-radius: 6px;
            border: 1px solid var(--vscode-input-border);
            margin-bottom: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .change-summary {
            display: flex;
            gap: 20px;
            align-items: center;
        }

        .change-count {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 14px;
            font-weight: 600;
        }

        .additions {
            color: #28a745;
        }

        .deletions {
            color: #dc3545;
        }

        .change-navigation {
            display: flex;
            gap: 10px;
            align-items: center;
        }

        .nav-dropdown {
            background: var(--vscode-dropdown-background);
            border: 1px solid var(--vscode-dropdown-border, var(--vscode-input-border));
            color: var(--vscode-dropdown-foreground);
            padding: 6px 12px;
            border-radius: 4px;
            font-size: 13px;
            cursor: pointer;
            min-width: 200px;
            appearance: none;
            -webkit-appearance: none;
            -moz-appearance: none;
            background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6,9 12,15 18,9'%3e%3c/polyline%3e%3c/svg%3e");
            background-repeat: no-repeat;
            background-position: right 8px center;
            background-size: 14px;
            padding-right: 28px;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
            transition: all 0.2s ease;
        }

        .nav-dropdown:hover {
            border-color: var(--vscode-focusBorder, var(--vscode-textLink-foreground));
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
        }

        .nav-dropdown:focus {
            outline: 1px solid var(--vscode-focusBorder);
            border-color: var(--vscode-focusBorder);
            box-shadow: 0 0 0 1px var(--vscode-focusBorder);
        }

        .jump-button {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            padding: 8px 10px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            transition: background-color 0.2s;
            min-width: 32px;
        }

        .jump-button:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }

        .jump-button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }

        .change-block-highlighted {
            box-shadow: 0 0 0 2px var(--vscode-focusBorder) !important;
            border-radius: 3px;
        }

        /* Control Panel Specific Styles */
        .control-panel-notice {
            background: var(--vscode-textCodeBlock-background);
            padding: 12px;
            border-radius: 6px;
            margin-top: 15px;
            border-left: 4px solid var(--vscode-charts-green);
            color: var(--vscode-foreground);
            font-size: 14px;
        }

        .control-panel-notice.no-changes {
            border-left-color: var(--vscode-charts-green);
            background: var(--vscode-textCodeBlock-background);
        }


        /* No Changes Styles */
        .no-changes-stats {
            background: var(--vscode-textBlockQuote-background);
            border: 1px solid var(--vscode-textBlockQuote-border);
        }

        .no-changes-info {
            font-size: 16px;
            font-weight: 600;
            color: var(--vscode-foreground);
            margin-bottom: 8px;
        }

        .no-changes-desc {
            font-size: 14px;
            color: var(--vscode-descriptionForeground);
            line-height: 1.4;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🕰️ Code Time Machine ${isControlPanel ? '- Control Panel' : ''}</h1>
        <div class="function-info">
            <strong>File:</strong> ${this.escapeHtml(data.filePath.split('/').pop() || 'Unknown')}
            ${data.similarity !== undefined ? `<br><strong>Similarity:</strong> <span class="similarity-badge">${data.similarity}%</span>` : ''}
        </div>
        ${isControlPanel ? `
        <div class="control-panel-notice ${data.hasChanges === false ? 'no-changes' : ''}">
            ${data.hasChanges === false
            ? (data.noChangesReason === 'not-found'
                ? '❌ Selected code did not exist in this commit'
                : '✅ Selected code is identical - no changes found')
            : '🔄 Side-by-side diff is now open showing ONLY your selected code changes (not entire file)!'}
        </div>
        ` : ''}
    </div>

    ${data.commits.length > 0 ? `
    <div class="commit-navigation">
        <button class="nav-button" onclick="navigateToCommit(${Math.max(0, data.currentCommitIndex - 1)})" 
                ${data.currentCommitIndex === 0 ? 'disabled' : ''}>
            ← Previous Commit
        </button>
        
        <div class="commit-info">
            <div class="commit-hash">${data.commits[data.currentCommitIndex]?.hash.substring(0, 8) || 'Unknown'}</div>
            <div style="font-size: 12px; color: var(--vscode-descriptionForeground); margin-top: 4px;">
                ${this.escapeHtml(data.commits[data.currentCommitIndex]?.message || 'No message')} 
                • ${this.escapeHtml(data.commits[data.currentCommitIndex]?.author || 'Unknown author')}
                • ${data.commits[data.currentCommitIndex]?.date ? new Date(data.commits[data.currentCommitIndex].date).toLocaleDateString() : 'Unknown date'}
            </div>
        </div>
        
        <button class="nav-button" onclick="navigateToCommit(${Math.min(data.commits.length - 1, data.currentCommitIndex + 1)})"
                ${data.currentCommitIndex >= data.commits.length - 1 ? 'disabled' : ''}>
            Next Commit →
        </button>
    </div>

    <div class="commit-selector">
        <div class="selector-header">📅 Select Commit to Compare</div>
        <select class="commit-dropdown" onchange="navigateToCommit(this.value)">
            ${data.commits.map((commit, index) => `
                <option value="${index}" ${index === data.currentCommitIndex ? 'selected' : ''}>
                    ${commit.hash.substring(0, 8)} • ${this.escapeHtml(commit.message)} • ${this.escapeHtml(commit.author)} • ${new Date(commit.date).toLocaleDateString()}
                </option>
            `).join('')}
        </select>
    </div>
    ` : ''}

    ${data.hasChanges === false ? `
    <div class="change-stats no-changes-stats">
        <div class="change-summary">
            <div class="no-changes-info">
                ${data.noChangesReason === 'not-found'
            ? '📋 Code did not exist in this commit'
            : '🔍 Code is identical (100% similarity)'}
            </div>
            ${data.noChangesReason === 'not-found'
            ? '<div class="no-changes-desc">This code was likely added after this commit or moved to a different location.</div>'
            : '<div class="no-changes-desc">The selected code exists but has no differences compared to the current version.</div>'}
        </div>
    </div>
    ` : (data.changeStats && data.changeStats.totalChanges > 0 ? `
    <div class="change-stats">
        <div class="change-summary">
            <div class="change-count">
                <span class="additions">+${data.changeStats.additions}</span>
                <span class="deletions">-${data.changeStats.deletions}</span>
                <span>(${data.changeStats.totalChanges} total changes)</span>
            </div>
        </div>
    </div>
    ` : '')}

    ${!isControlPanel ? (data.currentFunction || data.historicalFunction ?
            data.diffHtml :
            '<div class="no-function-message">No function found in the selected code or historical versions.</div>') : ''}

    <script>
        const vscode = acquireVsCodeApi();


        function navigateToCommit(commitIndex) {
            // Convert string to number if needed (from dropdown)
            const index = typeof commitIndex === 'string' ? parseInt(commitIndex) : commitIndex;
            
            vscode.postMessage({
                command: 'navigateToCommit',
                commitIndex: index
            });
        }

        function showCommitDetails() {
            const currentCommit = ${JSON.stringify(data.commits[data.currentCommitIndex] || null)};
            if (currentCommit) {
                vscode.postMessage({
                    command: 'showCommitDetails',
                    commit: currentCommit
                });
            }
        }



        // Synchronized scrolling between diff panels
        function setupSynchronizedScrolling() {
            const leftPanel = document.querySelector('.diff-content.old-content');
            const rightPanel = document.querySelector('.diff-content.new-content');
            
            if (!leftPanel || !rightPanel) return;
            
            let isScrolling = false;
            
            function syncScroll(source, target) {
                if (isScrolling) return;
                isScrolling = true;
                
                const sourceScrollTop = source.scrollTop;
                const sourceScrollLeft = source.scrollLeft;
                
                target.scrollTop = sourceScrollTop;
                target.scrollLeft = sourceScrollLeft;
                
                setTimeout(() => {
                    isScrolling = false;
                }, 50);
            }
            
            leftPanel.addEventListener('scroll', () => syncScroll(leftPanel, rightPanel));
            rightPanel.addEventListener('scroll', () => syncScroll(rightPanel, leftPanel));
        }
        
        // Initialize synchronized scrolling
        function initializePage() {
            setupSynchronizedScrolling();
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initializePage);
        } else {
            initializePage();
        }

        // Change navigation functionality
        let currentChangeIndex = -1;
        const changeBlocks = ${JSON.stringify(data.changeStats?.changeBlocks || [])};

        function jumpToChange() {
            const select = document.getElementById('changeSelect');
            const changeId = select.value;
            if (!changeId) return;

            // Validate changeId is from our known blocks to prevent XSS
            const validChangeIds = changeBlocks.map(block => block.id);
            if (!validChangeIds.includes(changeId)) return;

            currentChangeIndex = changeBlocks.findIndex(block => block.id === changeId);
            scrollToChange(changeId);
            select.value = ''; // Reset dropdown
        }

        function jumpToNextChange() {
            if (changeBlocks.length === 0) return;
            currentChangeIndex = (currentChangeIndex + 1) % changeBlocks.length;
            const changeId = changeBlocks[currentChangeIndex].id;
            scrollToChange(changeId);
        }

        function jumpToPrevChange() {
            if (changeBlocks.length === 0) return;
            currentChangeIndex = currentChangeIndex <= 0 ? changeBlocks.length - 1 : currentChangeIndex - 1;
            const changeId = changeBlocks[currentChangeIndex].id;
            scrollToChange(changeId);
        }

        function scrollToChange(changeId) {
            // Clear previous highlights
            document.querySelectorAll('.change-block-highlighted').forEach(el => {
                el.classList.remove('change-block-highlighted');
            });

            // Find and highlight the change block
            const changeElement = document.getElementById(changeId);
            if (changeElement) {
                changeElement.classList.add('change-block-highlighted');
                
                // Scroll to the change with some offset
                const container = changeElement.closest('.diff-content');
                if (container) {
                    const elementTop = changeElement.offsetTop;
                    const containerHeight = container.clientHeight;
                    const scrollTop = Math.max(0, elementTop - containerHeight / 3);
                    
                    container.scrollTo({
                        top: scrollTop,
                        behavior: 'smooth'
                    });
                }

                // Remove highlight after 3 seconds
                setTimeout(() => {
                    changeElement.classList.remove('change-block-highlighted');
                }, 3000);
            }
        }

        // Keyboard navigation for commits only
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft' && ${data.currentCommitIndex} > 0) {
                navigateToCommit(${data.currentCommitIndex - 1});
            } else if (e.key === 'ArrowRight' && ${data.currentCommitIndex} < ${data.commits.length - 1}) {
                navigateToCommit(${data.currentCommitIndex + 1});
            }
        });
    </script>
</body>
</html>`;
    }
}
exports.CodeTimeMachinePanel = CodeTimeMachinePanel;
CodeTimeMachinePanel.viewType = 'codeTimeMachine';
//# sourceMappingURL=panel.js.map