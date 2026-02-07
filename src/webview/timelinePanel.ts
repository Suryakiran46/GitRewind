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
                        vscode.commands.executeCommand('codeTimeMachine.showCommitDetails', message.hash);
                        return;
                    case 'browseCommit':
                        vscode.commands.executeCommand('codeTimeMachine.browseCommit', message.hash);
                        return;
                    case 'openFile':
                        vscode.commands.executeCommand('codeTimeMachine.openFileAtCommit', message.hash, message.path);
                        return;
                    case 'copyHash':
                        vscode.commands.executeCommand('codeTimeMachine.copyHash', message.hash);
                        return;
                    case 'checkoutCommit':
                        vscode.commands.executeCommand('codeTimeMachine.checkoutCommit', message.hash);
                        return;
                    case 'revertCommit':
                        vscode.commands.executeCommand('codeTimeMachine.revertCommit', message.hash);
                        return;
                    case 'commitSelectedForComparison':
                        vscode.commands.executeCommand('codeTimeMachine.compareWithSelectedCommit', message.hash);
                        return;
                    case 'loadMoreCommits':
                        vscode.commands.executeCommand('codeTimeMachine.loadMoreCommits');
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

    public setSelectMode(active: boolean, message?: string) {
        this.postMessage({ command: 'setSelectMode', active, message });
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
                #selection-banner {
                    background: var(--vscode-editor-selectionBackground);
                    color: var(--vscode-editor-foreground);
                    padding: 8px 12px;
                    text-align: center;
                    font-weight: bold;
                    display: none;
                    border-bottom: 1px solid var(--vscode-panel-border);
                    position: sticky;
                    top: 0;
                    z-index: 200;
                }
                #selection-banner.active {
                    display: block;
                }
                .zoom-btn:hover {
                    background-color: var(--vscode-list-hoverBackground);
                }
                #zoom-wrapper {
                    flex: 1;
                    overflow: auto;
                    cursor: grab;
                    display: flex;
                    flex-direction: column;
                }
                #zoom-wrapper:active {
                    cursor: grabbing;
                }
                #content-layer {
                    transform-origin: 0 0;
                    transition: transform 0.1s ease-out;
                }
                
                svg { display: block; }
                .node-group { cursor: pointer; transition: transform 0.2s; }
                .node-group:hover .node-icon { stroke: var(--vscode-focusBorder); stroke-width: 2px; }
                .branch-line { fill: none; stroke-width: 2px; stroke-linecap: round; opacity: 0.6; }
                .avatar-group text { font-size: 10px; font-family: var(--vscode-font-family); fill: var(--vscode-editor-foreground); text-anchor: middle; dominant-baseline: central; pointer-events: none; }
                .avatar-circle { fill: var(--vscode-sideBar-background); stroke: var(--vscode-panel-border); stroke-width: 1px; cursor: pointer; }
                .node-icon { stroke: var(--vscode-editor-background); stroke-width: 1.5px; }

                /* Badge for labels */
                .badge {
                    font-size: 10px;
                    fill: var(--vscode-button-foreground);
                    font-weight: bold;
                    text-anchor: middle;
                    dominant-baseline: central;
                }
                .badge-bg {
                    rx: 3;
                    ry: 3;
                }
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
                    <div id="selection-banner"></div>
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
                                <!-- Icons Definitions: All paths assume 0 0 24 24 viewBox -->
                                <!-- 1. Initial Commit: Flag/Start -->
                                <g id="icon-initial">
                                    <path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z" fill="currentColor" />
                                </g>

                                <!-- 2. Merge: Merge generic arrow -->
                                <g id="icon-merge">
                                    <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.15c-.05.21-.08.43-.08.66 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92c0-1.61-1.31-2.92-2.92-2.92z" fill="currentColor"/>
                                </g>

                                <!-- 3. Bug Fix: Bug -->
                                <g id="icon-fix">
                                    <path d="M19 8h-1.81a5.985 5.985 0 0 0-1.82-1.96l.93-.93a.996.996 0 1 0-1.41-1.41l-1.47 1.47C12.96 5.06 12.49 5 12 5s-.96.06-1.41.17L9.11 3.7a.996.996 0 1 0-1.41 1.41l.93.93C7.5 6.41 6.8 7.11 6.32 8H4.5a.5.5 0 0 0-.5.5v1.67a1.5 1.5 0 0 0 .1.53l1.8 4.2C6.46 17.18 8.86 19 12 19s5.54-1.82 6.1-4.1l1.8-4.2a1.5 1.5 0 0 0 .1-.53V8.5a.5.5 0 0 0-.5-.5zM8.5 10.5C8.5 9.67 9.17 9 10 9s1.5.67 1.5 1.5S10.83 12 10 12s-1.5-.67-1.5-1.5zm5 1.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" fill="currentColor"/>
                                </g>

                                <!-- 4. Add: File Plus -->
                                <g id="icon-add">
                                    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 14h-3v3h-2v-3H8v-2h3v-3h2v3h3v2zm-3-7V3.5L18.5 9H13z" fill="currentColor"/>
                                </g>
                                <g id="icon-feat">
                                    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 14h-3v3h-2v-3H8v-2h3v-3h2v3h3v2zm-3-7V3.5L18.5 9H13z" fill="currentColor"/>
                                </g>

                                <!-- 5. Tag: Tag -->
                                <g id="icon-tag">
                                    <path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z" fill="currentColor"/>
                                </g>

                                <!-- 6. Delete: File Minus (or generic delete if File Minus too complex) -->
                                <!-- Let's use File with X or simpler Delete -->
                                <g id="icon-delete">
                                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="currentColor"/>
                                </g>
                                
                                <!-- 7. Notify/Modify: File Edit / Page Edit -->
                                <!-- Using a generic 'Edit' icon or 'File Edit' -->
                                <g id="icon-modify">
                                    <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6zm10.12-5.17l-1.41-1.41-2.91 2.91-1.41-1.41 4.33-4.33 1.41 1.41-4.33 4.33 2.91 2.91 1.41-1.41z" fill="currentColor"/> 
                                    <!-- Fallback to a simpler "Edit Document" or "Draft" icon if complex paths aren't rendering -->
                                    <!-- Trying simpler path for modify -->
                                    <!-- <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="currentColor"/> -->
                                </g>
                                <g id="icon-normal">
                                    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" fill="currentColor"/>
                                </g>
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
            // Determine icon ID
            let iconId = 'icon-normal';
            if (node.type) {
                iconId = `icon-${node.type}`;
            }
            // Fallback
            if (iconId === 'icon-undefined') iconId = 'icon-normal';

            const fillColor = node.color;
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

                                    <!-- Commit Node Icon -->
                                    <!-- Center the icon. Icons are roughly 24x24 viewBox. Scale to fit nicely. -->
                                    <g transform="translate(-10.8, -10.8) scale(0.9)"> 
                                        <!-- Removed border circle as requested -->
                                        <use href="#${iconId}" fill="${fillColor}" class="node-icon" />
                                    </g>
                                    
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
                    <div style="text-align: center; padding: 20px; min-height: 50px;">
                        <button onclick="loadMore()" style="padding: 8px 16px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; cursor: pointer; border-radius: 2px;">Load More Commits...</button>
                    </div>
                </div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                const graphNodes = ${JSON.stringify(graphData.nodes)};

                function loadMore() {
                    vscode.postMessage({ command: 'loadMoreCommits' });
                }

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


                let selectMode = false;
                
                function selectCommit(hash) {
                    if (isDragging) return; // Prevent click when dragging
                    
                    if (selectMode) {
                        vscode.postMessage({
                            command: 'commitSelectedForComparison',
                            hash: hash
                        });
                    } else {
                        vscode.postMessage({
                            command: 'selectCommit',
                            hash: hash
                        });
                    }
                }
                
                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.command) {
                        case 'setSelectMode':
                            selectMode = message.active;
                            const banner = document.getElementById('selection-banner');
                            if (banner) {
                                if (selectMode) {
                                    banner.innerText = message.message || 'Select a commit...';
                                    banner.classList.add('active');
                                } else {
                                    banner.classList.remove('active');
                                }
                            }
                            break;
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
