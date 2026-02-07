import * as vscode from 'vscode';
import { GraphData, GraphNode } from '../services/graphEngine';

export class TimelinePanel {
    public static currentPanel: TimelinePanel | undefined;
    public static readonly viewType = 'gitTimeMachine.timeline';

    private readonly panel: vscode.WebviewPanel;
    private readonly extensionUri: vscode.Uri;
    private disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri, graphData: GraphData) {
        const column = vscode.ViewColumn.One;

        if (TimelinePanel.currentPanel) {
            TimelinePanel.currentPanel.panel.reveal(column);
            TimelinePanel.currentPanel.update(graphData);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            TimelinePanel.viewType,
            'GitRewind',
            column,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'src', 'webview')]
            }
        );

        TimelinePanel.currentPanel = new TimelinePanel(panel, extensionUri, graphData);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, graphData: GraphData) {
        this.panel = panel;
        this.extensionUri = extensionUri;

        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

        this.panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'selectCommit':
                        // vscode.window.showInformationMessage(`Selected commit: ${message.hash}`);
                        // Trigger logic to show details or checkout snapshot
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
            },
            null,
            this.disposables
        );

        this.update(graphData);
    }

    public update(graphData: GraphData) {
        this.panel.webview.html = this.getHtmlForWebview(graphData);
    }

    public postMessage(message: any) {
        this.panel.webview.postMessage(message);
    }

    public dispose() {
        TimelinePanel.currentPanel = undefined;
        this.panel.dispose();
        while (this.disposables.length) {
            const x = this.disposables.pop();
            if (x) x.dispose();
        }
    }

    private escapeHtml(text: string): string {
        if (!text) return '';
        return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    private getHtmlForWebview(graphData: GraphData): string {
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
                
                svg { display: block; }
                .node { cursor: pointer; transition: r 0.2s; }
                .node:hover { stroke: var(--vscode-focusBorder); stroke-width: 2px; }
                .branch-line { fill: none; stroke-width: 2px; stroke-linecap: round; opacity: 0.6; }
                .avatar-group text { font-size: 10px; font-family: var(--vscode-font-family); fill: var(--vscode-editor-foreground); text-anchor: middle; dominant-baseline: central; pointer-events: none; }
                .avatar-circle { fill: var(--vscode-sideBar-background); stroke: var(--vscode-panel-border); stroke-width: 1px; cursor: pointer; }
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
                            <defs>
                                ${graphData.nodes.map(node => {
            const colorId = node.color.replace('#', '');
            return `
                                    <marker id="arrow-${colorId}" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
                                        <path d="M0,0 L0,6 L9,3 z" fill="${node.color}" />
                                    </marker>
                                    `;
        }).join('')}
                            </defs>
                            <!-- Edges -->
                            ${graphData.links.map(link => {
            const sourceNode = graphData.nodes.find(n => n.hash === link.source);
            const targetNode = graphData.nodes.find(n => n.hash === link.target);
            if (!sourceNode || !targetNode) return '';

            const sx = sourceNode.x;
            const sy = sourceNode.y;
            const tx = targetNode.x;
            const ty = targetNode.y;
            // Determine crossover point:
            // - If primary parent (index 0): specific crossover preference (usually at bottom to show branching *from*)
            // - If secondary parent (merge): crossover at top (show merging *into*)
            const isPrimary = sourceNode.parents[0] === targetNode.hash;

            // Layout Tuning
            const spacing = 80; // Vertical spacing (match GraphEngine)
            const radius = 10;
            const verticalGap = ty - sy; // Always positive (Time flows down)

            // Calculate midY based on heuristic
            // If primary: crossover close to Target (ty)
            // If secondary: crossover close to Source (sy)
            let midY = (sy + ty) / 2; // Default

            if (verticalGap > spacing * 1.5) {
                if (isPrimary) {
                    midY = ty - 25; // Crossover just before target
                } else {
                    midY = sy + 25; // Crossover just after source
                }
            }

            let d = '';
            // If strictly vertical
            if (Math.abs(sx - tx) < 1) {
                d = `M ${sx} ${sy} L ${tx} ${ty}`;
            } else {
                // Determine turn radius (clamp to available space)
                const r = Math.min(radius, Math.abs(tx - sx) / 2, Math.abs(midY - sy), Math.abs(ty - midY));
                const dir = tx > sx ? 1 : -1;

                // Strict Orthogonal Path (Parent -> Child)
                // We draw from Target (Parent/Bottom) to Source (Child/Top)
                // so the marker-end arrow points to the Child.

                // 1. Vertical from Parent (Bottom)
                d = `M ${tx} ${ty} ` +
                    `L ${tx} ${midY + r} ` +
                    // 2. Turn to Horizontal
                    `Q ${tx} ${midY} ${tx - dir * r} ${midY} ` +
                    // 3. Horizontal Line
                    `L ${sx + dir * r} ${midY} ` +
                    // 4. Turn to Vertical
                    `Q ${sx} ${midY} ${sx} ${midY - r} ` +
                    // 5. Vertical to Child (Top)
                    `L ${sx} ${sy}`;
            }

            // Only show arrow for non-vertical connections (merges/branches) or long jumps
            // Use marker-end to point to the target node
            // The marker ID is based on the source color: marker-arrow-[color-hex]
            // We need to sanitize the color string to make a valid ID
            const colorId = sourceNode.color.replace('#', '');
            const markerAttr = (Math.abs(sx - tx) > 1) ? `marker-end="url(#arrow-${colorId})"` : '';

            return `<path d="${d}" class="branch-line" stroke="${sourceNode.color}" stroke-width="2" fill="none" ${markerAttr} />`;


        }).join('')}
                            
                            <!-- Nodes -->
                            ${graphData.nodes.map(node => {
            const isMerge = node.parents.length > 1;
            const fillColor = isMerge ? 'var(--git-merge)' : node.color;
            const initials = (node.author || '?').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

            // Safe text handling for restoration
            const safeMessage = node.message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

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
                                    
                                    <!-- Restored Text Labels with Multiline Support -->
                                    <foreignObject x="15" y="-14" width="300" height="60">
                                        <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: var(--vscode-font-family); font-size: 11px; line-height: 1.2; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; word-wrap: break-word;">
                                            <span style="color: var(--vscode-descriptionForeground); font-weight: bold;">${new Date(node.date).toLocaleDateString()}</span>
                                            <span style="color: var(--vscode-descriptionForeground)"> : </span>
                                            <span style="color: var(--vscode-editor-foreground)">${safeMessage}</span>
                                        </div>
                                    </foreignObject>
                                </g>
                            `}).join('')}
                        </svg>
                    </div>
                </div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                const graphNodes = ${JSON.stringify(graphData.nodes)};

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


                function selectCommit(hash) {
                    if (isDragging) return; // Prevent click when dragging
                    
                    vscode.postMessage({
                        command: 'selectCommit',
                        hash: hash
                    });
                }
                
                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.command) {
                        // No longer handling 'setCommitDetails' as modal is removed
                    }
                });

                function escapeHtml(text) {
                    if (!text) return '';
                    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
                }
            </script>
        </body>
        </html>`;
    }
}
