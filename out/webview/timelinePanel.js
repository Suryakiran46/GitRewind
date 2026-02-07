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
exports.TimelinePanel = void 0;
const vscode = __importStar(require("vscode"));
class TimelinePanel {
    static createOrShow(extensionUri, graphData, initialDetails) {
        const column = vscode.ViewColumn.One;
        if (TimelinePanel.currentPanel) {
            TimelinePanel.currentPanel.panel.reveal(column);
            TimelinePanel.currentPanel.update(graphData);
            return;
        }
        console.log('Creating new TimelinePanel with graphData:', {
            nodesCount: graphData.nodes.length,
            linksCount: graphData.links.length,
            height: graphData.height,
            width: graphData.width
        });
        const panel = vscode.window.createWebviewPanel(TimelinePanel.viewType, 'GitRewind', column, {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'src', 'webview')]
        });
        TimelinePanel.currentPanel = new TimelinePanel(panel, extensionUri, graphData, initialDetails);
    }
    constructor(panel, extensionUri, graphData, initialDetails) {
        this.disposables = [];
        this.panel = panel;
        this.extensionUri = extensionUri;
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
        this.panel.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'selectCommit':
                    vscode.commands.executeCommand('GitRewind.showCommitDetails', message.hash);
                    return;
                case 'browseCommit':
                    vscode.commands.executeCommand('GitRewind.browseCommit', message.hash);
                    return;
                case 'openFile':
                    vscode.commands.executeCommand('GitRewind.openFileAtCommit', message.hash, message.path);
                    return;
                case 'copyHash':
                    vscode.commands.executeCommand('GitRewind.copyHash', message.hash);
                    return;
                case 'checkoutCommit':
                    vscode.commands.executeCommand('GitRewind.checkoutCommit', message.hash);
                    return;
                case 'revertCommit':
                    vscode.commands.executeCommand('GitRewind.revertCommit', message.hash);
                    return;
            }
        }, null, this.disposables);
        this.update(graphData, initialDetails);
    }
    update(graphData, initialDetails) {
        this.panel.webview.html = this.getHtmlForWebview(graphData, initialDetails);
    }
    postMessage(message) {
        this.panel.webview.postMessage(message);
    }
    dispose() {
        TimelinePanel.currentPanel = undefined;
        this.panel.dispose();
        while (this.disposables.length) {
            const x = this.disposables.pop();
            if (x)
                x.dispose();
        }
    }
    escapeHtml(text) {
        if (!text)
            return '';
        return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }
    getHtmlForWebview(graphData, initialDetails) {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Git Timeline</title>
            <style>
                :root {
                    --git-merge: #6f42c1;
                    --git-clean: #2ea043;
                    --git-warning: #d29922;
                    --git-danger: #cf222e;
                    --git-added: #2ea043;
                    --git-modified: #0969da;
                    --git-deleted: #cf222e;
                }
                body {
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                    font-family: var(--vscode-font-family);
                    display: flex;
                    height: 100vh;
                    overflow: hidden;
                    margin: 0;
                    user-select: none; /* Prevent text selection while dragging */
                }
                #graph-container {
                    flex: 1; /* Take full width */
                    overflow: hidden; 
                    position: relative;
                    display: flex;
                    flex-direction: column;
                }
                #zoom-controls {
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    background: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 4px;
                    display: flex;
                    z-index: 100;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .zoom-btn {
                    background: transparent;
                    border: none;
                    color: var(--vscode-foreground);
                    width: 30px;
                    height: 30px;
                    font-size: 16px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .zoom-btn:hover {
                    background-color: var(--vscode-list-hoverBackground);
                }
                #zoom-wrapper {
                    flex: 1;
                    overflow: auto;
                    cursor: grab;
                }
                #zoom-wrapper:active {
                    cursor: grabbing;
                }
                #content-layer {
                    transform-origin: 0 0;
                    transition: transform 0.1s ease-out;
                }
                
                /* Modal Styles */
                #modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.6); /* Dimmed background */
                    backdrop-filter: blur(4px); /* Blur effect */
                    z-index: 200;
                    display: none; /* Hidden by default */
                    align-items: center; /* Vertical Center */
                    justify-content: center; /* Horizontal Center */
                    opacity: 0;
                    transition: opacity 0.2s ease;
                }
                #modal-overlay.active {
                    display: flex;
                    opacity: 1;
                }

                #details-modal {
                    background-color: var(--vscode-sideBar-background);
                    width: 90%; /* Full Width as requested */
                    max-height: 85vh; /* Half to 3/4 height */
                    border-radius: 8px;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
                    border: 1px solid var(--vscode-panel-border);
                    display: flex;
                    flex-direction: column;
                    transform: scale(0.95);
                    transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    overflow: hidden;
                    position: relative;
                }
                #modal-overlay.active #details-modal {
                    transform: scale(1);
                }

                svg { display: block; }
                .node { cursor: pointer; transition: r 0.2s; }
                .node:hover { stroke: var(--vscode-focusBorder); stroke-width: 2px; }
                .branch-line { fill: none; stroke-width: 2px; stroke-linecap: round; opacity: 0.6; }
                .avatar-group text { font-size: 10px; font-family: var(--vscode-font-family); fill: var(--vscode-editor-foreground); text-anchor: middle; dominant-baseline: central; pointer-events: none; }
                .avatar-circle { fill: var(--vscode-sideBar-background); stroke: var(--vscode-panel-border); stroke-width: 1px; cursor: pointer; }
                
                /* Details Panel Content Styles */
                .details-header { padding: 20px; border-bottom: 1px solid var(--vscode-panel-border); background: var(--vscode-editor-background); position: relative;}
                .close-btn { 
                    position: absolute; top: 15px; right: 15px; 
                    background: none; border: none; color: var(--vscode-foreground); 
                    font-size: 20px; cursor: pointer; opacity: 0.7; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border-radius: 4px; z-index: 10;
                }
                .close-btn:hover { opacity: 1; background: var(--vscode-list-hoverBackground); }

                .details-header h2 { margin: 0 0 10px 0; font-size: 1.4em; line-height: 1.4; padding-right: 40px; }
                .meta-row { display: flex; align-items: center; gap: 15px; font-size: 0.9em; color: var(--vscode-descriptionForeground); margin-bottom: 0; }
                .author-pill { display: flex; align-items: center; gap: 6px; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); padding: 4px 10px; border-radius: 12px; font-size: 0.9em; }
                
                .files-container { flex: 1; overflow-y: auto; padding: 0; display: flex; flex-direction: column; }
                
                .file-section { border-bottom: 1px solid var(--vscode-panel-border); }
                .section-header { 
                    padding: 8px 20px; 
                    font-weight: 600; 
                    font-size: 0.85em; 
                    text-transform: uppercase; 
                    letter-spacing: 0.5px;
                    background: var(--vscode-editor-background);
                    border-bottom: 1px solid var(--vscode-panel-border);
                    display: flex; align-items: center; justify-content: space-between;
                    position: sticky; top: 0;
                }
                .section-added { color: var(--git-added); border-left: 4px solid var(--git-added); }
                .section-modified { color: var(--git-modified); border-left: 4px solid var(--git-modified); }
                .section-deleted { color: var(--git-deleted); border-left: 4px solid var(--git-deleted); }

                .file-list { list-style: none; padding: 0; margin: 0; }
                .file-item { display: flex; align-items: center; padding: 10px 20px; border-bottom: 1px solid var(--vscode-panel-border); cursor: pointer; transition: background 0.1s; }
                .file-item:last-child { border-bottom: none; }
                .file-item:hover { background-color: var(--vscode-list-hoverBackground); }
                .file-icon { margin-right: 12px; font-size: 1.1em; width: 20px; text-align: center; }
                .file-path { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--vscode-editor-font-family); font-size: 0.95em; }
                
                .actions-footer { padding: 15px; border-top: 1px solid var(--vscode-panel-border); background: var(--vscode-editor-background); display: flex; gap: 10px; }
                button.action-btn { flex: 1; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 10px 16px; cursor: pointer; border-radius: 2px; font-weight: 500;}
                button.action-btn:hover { background: var(--vscode-button-hoverBackground); }
                button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
                button.danger { background: var(--git-danger); color: white; }
            </style>
        </head>
        <body>
            <div id="graph-container">
                <div id="zoom-controls">
                    <button class="zoom-btn" onclick="zoomIn()" title="Zoom In">+</button>
                    <button class="zoom-btn" onclick="resetZoom()" title="Reset">⟲</button>
                    <button class="zoom-btn" onclick="zoomOut()" title="Zoom Out">-</button>
                </div>
                <div id="zoom-wrapper">
                    <div id="content-layer">
                        <svg id="git-graph" width="${graphData.width}" height="${graphData.height}">
                            <!-- Edges -->
                            ${graphData.links.map(link => {
            const sourceNode = graphData.nodes.find(n => n.hash === link.source);
            const targetNode = graphData.nodes.find(n => n.hash === link.target);
            if (!sourceNode || !targetNode)
                return '';
            const sx = sourceNode.x;
            const sy = sourceNode.y;
            const tx = targetNode.x;
            const ty = targetNode.y;
            // Determine crossover point:
            // - If primary parent (index 0): specific crossover preference (usually at bottom to show branching *from*)
            // - If secondary parent (merge): crossover at top (show merging *into*)
            const isPrimary = sourceNode.parents[0] === targetNode.hash;
            // Layout Tuning
            const spacing = 50; // Vertical spacing (match GraphEngine)
            const radius = 10;
            const verticalGap = ty - sy; // Always positive (Time flows down)
            // Calculate midY based on heuristic
            // If primary: crossover close to Target (ty)
            // If secondary: crossover close to Source (sy)
            let midY = (sy + ty) / 2; // Default
            if (verticalGap > spacing * 1.5) {
                if (isPrimary) {
                    midY = ty - 25; // Crossover just before target
                }
                else {
                    midY = sy + 25; // Crossover just after source
                }
            }
            let d = '';
            // If strictly vertical
            if (Math.abs(sx - tx) < 1) {
                d = `M ${sx} ${sy} L ${tx} ${ty}`;
            }
            else {
                // Determine turn radius (clamp to available space)
                const r = Math.min(radius, Math.abs(tx - sx) / 2, Math.abs(midY - sy), Math.abs(ty - midY));
                const dir = tx > sx ? 1 : -1;
                // Strict Orthogonal Path (Vertical -> Turn -> Horizontal -> Turn -> Vertical)
                // We ensure exact coordinates for the lines and explicit rounding
                // 1. Vertical from Source
                d = `M ${sx} ${sy} ` +
                    `L ${sx} ${midY - r} ` +
                    // 2. Turn to Horizontal
                    `Q ${sx} ${midY} ${sx + dir * r} ${midY} ` +
                    // 3. Horizontal Line
                    `L ${tx - dir * r} ${midY} ` +
                    // 4. Turn to Vertical
                    `Q ${tx} ${midY} ${tx} ${midY + r} ` +
                    // 5. Vertical to Target
                    `L ${tx} ${ty}`;
            }
            return `<path d="${d}" class="branch-line" stroke="${sourceNode.color}" />`;
        }).join('')}
                            
                            <!-- Nodes -->
                            ${graphData.nodes.map(node => {
            const isMerge = node.parents.length > 1;
            const fillColor = isMerge ? 'var(--git-merge)' : node.color;
            const initials = (node.author || '?').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
            // Safe text handling for restoration
            const safeMessage = node.message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            const truncatedMessage = safeMessage.length > 50 ? safeMessage.substring(0, 50) + '...' : safeMessage;
            return `
                                <g class="node-group" onclick="selectCommit('${node.hash}')" transform="translate(${node.x}, ${node.y})">
                                    <!-- Avatar (Left of Node) -->
                                    <g class="avatar-group" transform="translate(-25, 0)">
                                        <title>${this.escapeHtml(node.author)}${node.email ? ' &lt;' + this.escapeHtml(node.email) + '&gt;' : ''}</title>
                                        <circle cx="0" cy="0" r="10" class="avatar-circle"></circle>
                                        <text x="0" y="1">${initials}</text>
                                    </g>

                                    <!-- Commit Node -->
                                    <circle cx="0" cy="0" r="${isMerge ? 8 : 6}" fill="${fillColor}" stroke="#fff" stroke-width="2" class="node"></circle>
                                    
                                    <!-- Restored Text Labels -->
                                    <text x="15" y="4" fill="var(--vscode-editor-foreground)" font-size="12px" style="pointer-events: none; opacity: 0.7;">
                                        ${truncatedMessage}
                                    </text>
                                    <text x="15" y="18" fill="var(--vscode-descriptionForeground)" font-size="10px" style="pointer-events: none;">
                                        ${new Date(node.date).toLocaleDateString()}
                                    </text>
                                </g>
                            `;
        }).join('')}
                        </svg>
                    </div>
                </div>
            </div>

            <!-- Full Width Modal Overlay -->
            <div id="modal-overlay" onclick="handleOverlayClick(event)">
                <div id="details-modal">
                     <div class="details-header">
                        <h2>Loading details...</h2>
                        <button class="close-btn" onclick="closeModal()" title="Close">✕</button>
                     </div>
                </div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                const graphNodes = ${JSON.stringify(graphData.nodes)};
                const initialDetails = ${JSON.stringify(initialDetails || null)};

                // Zoom Logic
                let currentZoom = 1;
                const zoomStep = 0.1;
                const contentLayer = document.getElementById('content-layer');
                const zoomWrapper = document.getElementById('zoom-wrapper');

                function updateZoom() {
                    contentLayer.style.transform = \`scale(\${currentZoom})\`;
                }

                function zoomIn() {
                    currentZoom += zoomStep;
                    updateZoom();
                }

                function zoomOut() {
                    if (currentZoom > 0.2) {
                        currentZoom -= zoomStep;
                        updateZoom();
                    }
                }

                function resetZoom() {
                    currentZoom = 1;
                    updateZoom();
                }
                
                zoomWrapper.addEventListener('wheel', (e) => {
                    if (e.ctrlKey) {
                        e.preventDefault();
                        if (e.deltaY < 0) zoomIn();
                        else zoomOut();
                    }
                });

                // --- Drag-to-Scroll Logic ---
                let isDragging = false;
                let startX, startY, scrollLeft, scrollTop;

                zoomWrapper.addEventListener('mousedown', (e) => {
                    isDragging = true;
                    zoomWrapper.classList.add('active'); // CSS matches: cursor: grabbing
                    startX = e.pageX - zoomWrapper.offsetLeft;
                    startY = e.pageY - zoomWrapper.offsetTop;
                    scrollLeft = zoomWrapper.scrollLeft;
                    scrollTop = zoomWrapper.scrollTop;
                    
                    // Stop any text selection
                    e.preventDefault();
                });

                zoomWrapper.addEventListener('mouseleave', () => {
                    isDragging = false;
                    zoomWrapper.classList.remove('active');
                });

                zoomWrapper.addEventListener('mouseup', () => {
                    isDragging = false;
                    zoomWrapper.classList.remove('active');
                });

                zoomWrapper.addEventListener('mousemove', (e) => {
                    if (!isDragging) return;
                    e.preventDefault();
                    
                    const x = e.pageX - zoomWrapper.offsetLeft;
                    const y = e.pageY - zoomWrapper.offsetTop;
                    const walkX = (x - startX) * 1; // 1:1 scroll speed
                    const walkY = (y - startY) * 1;
                    
                    zoomWrapper.scrollLeft = scrollLeft - walkX;
                    zoomWrapper.scrollTop = scrollTop - walkY;
                });


                if (initialDetails) {
                   setTimeout(() => {
                        // Optional: auto-show if desired, but user interaction is better
                        // renderCommitDetails(initialDetails); 
                   }, 50);
                }

                function selectCommit(hash) {
                    if (isDragging) return; // Prevent click when dragging
                    
                    vscode.postMessage({
                        command: 'selectCommit',
                        hash: hash
                    });
                    
                    showModal('Loading details...');
                }
                
                function showModal(placeholderText) {
                    const overlay = document.getElementById('modal-overlay');
                    const modal = document.getElementById('details-modal');
                    
                    // Reset content to loading state if new
                    if (placeholderText) {
                         modal.innerHTML = '<div class="details-header"><h2>Loading...</h2><button class="close-btn" onclick="closeModal()">✕</button></div><div style="padding:40px; text-align:center; color: var(--vscode-descriptionForeground);">Fetching commit details...</div>';
                    }
                    
                    overlay.classList.add('active');
                }

                function closeModal() {
                    const overlay = document.getElementById('modal-overlay');
                    overlay.classList.remove('active');
                }

                function handleOverlayClick(event) {
                    if (event.target.id === 'modal-overlay') {
                        closeModal();
                    }
                }

                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.command) {
                        case 'setCommitDetails':
                            renderCommitDetails(message.details);
                            break;
                    }
                });

                function renderCommitDetails(details) {
                    const container = document.getElementById('details-modal');
                    if (!details) return;
                    
                    const overlay = document.getElementById('modal-overlay');
                    if (!overlay.classList.contains('active')) {
                        overlay.classList.add('active');
                    }

                    // Group files
                    const added = [], modified = [], deleted = [];
                    if (details.files) {
                        details.files.forEach(f => {
                            if (f.status === 'A') added.push(f);
                            else if (f.status === 'D') deleted.push(f);
                            else modified.push(f);
                        });
                    }

                    const date = new Date(details.date).toLocaleString();
                    
                    let html = 
                    '<div class="details-header">' +
                        '<button class="close-btn" onclick="closeModal()">✕</button>' +
                        '<h2>' + escapeHtml(details.message) + '</h2>' +
                        '<div class="meta-row">' +
                            '<span class="author-pill">👤 ' + escapeHtml(details.author) + '</span>' +
                            '<span>' + date + '</span>' +
                            '<span style="margin-left:auto; opacity:0.6">' + details.hash.substring(0,8) + '</span>' +
                        '</div>' +
                    '</div>' +
                    
                    '<div class="files-container">';

                    // Helper to render a section
                    function renderSection(title, files, typeClass, icon) {
                        if (files.length === 0) return '';
                        let sectionHtml = '<div class="file-section">' +
                            '<div class="section-header ' + typeClass + '">' + 
                                '<span>' + title + '</span>' + 
                                '<span style="opacity:0.6">' + files.length + '</span>' + 
                            '</div>' +
                            '<ul class="file-list">';
                        
                        files.forEach(file => {
                            sectionHtml += '<li class="file-item" onclick="openFile(\\'' + details.hash + '\\', \\'' + escapeHtml(file.path) + '\\')">' +
                                '<span class="file-icon ' + typeClass + '" style="border:none">' + icon + '</span>' +
                                '<span class="file-path">' + escapeHtml(file.path) + '</span>' +
                            '</li>';
                        });
                        
                        sectionHtml += '</ul></div>';
                        return sectionHtml;
                    }

                    html += renderSection('Added Files', added, 'section-added', '✳️');
                    html += renderSection('Modified Files', modified, 'section-modified', '✏️');
                    html += renderSection('Deleted Files', deleted, 'section-deleted', '❌');

                    if (added.length === 0 && modified.length === 0 && deleted.length === 0) {
                        html += '<div style="padding:40px; text-align:center; opacity:0.5">No file changes found in this commit.</div>';
                    }

                    html += '</div>' +
                    '<div class="actions-footer">' +
                        '<button class="action-btn" onclick="browseFiles(\\'' + details.hash + '\\')">📂 Browse Commit</button>' +
                        '<button class="action-btn" onclick="copyHash(\\'' + details.hash + '\\')" title="Copy Commit Hash">📋 Copy Hash</button>' +
                        '<button class="action-btn secondary" onclick="checkoutCommit(\\'' + details.hash + '\\')" title="Checkout this commit (Detached HEAD)">🛑 Checkout</button>' +
                        '<button class="action-btn danger" onclick="revertCommit(\\'' + details.hash + '\\')" title="Revert this commit">↩️ Revert</button>' +
                    '</div>';

                    container.innerHTML = html;
                }

                function openFile(hash, path) {
                    vscode.postMessage({ command: 'openFile', hash: hash, path: path });
                }

                function browseFiles(hash) {
                     vscode.postMessage({ command: 'browseCommit', hash: hash });
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

                function escapeHtml(text) {
                    if (!text) return '';
                    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
                }
            </script>
        </body>
        </html>`;
    }
}
exports.TimelinePanel = TimelinePanel;
TimelinePanel.viewType = 'gitTimeMachine.timeline';
//# sourceMappingURL=timelinePanel.js.map