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
            try {
                TimelinePanel.currentPanel.panel.reveal(column);
                TimelinePanel.currentPanel.update(graphData);
                return;
            } catch (e) {
                // Panel was disposed, clear the reference
                TimelinePanel.currentPanel = undefined;
            }
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
            <title>Git Timeline (Colors Updated)</title>
            <style>
                :root {
                    --git-merge: #ff9800;
                    --git-clean: #2ea043;
                    --git-warning: #d29922;
                    --git-danger: #cf222e;
                    --git-added: #2ea043;
                    --git-modified: #a371f7;
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
 
                                <!-- 1. Bug: Bug Icon -->
                                <!-- 1. Bug: Bug Icon -->
                                <g id="icon-bug">
                                    <path d="M20 8h-2.81c-.45-.78-1.07-1.45-1.82-1.96L17 4.41 15.59 3l-2.17 2.17C12.96 5.06 12.49 5 12 5c-.49 0-.96.06-1.41.17L8.41 3 7 4.41l1.62 1.63C7.88 6.55 7.26 7.22 6.81 8H4v2h2.09c-.05.33-.09.66-.09 1v1H4v2h2v1c0 .34.04.67.09 1H4v2h2.81c1.04 1.79 2.97 3 5.19 3s4.15-1.21 5.19-3H20v-2h-2.09c.05-.33.09-.66.09-1v-1h2v-2h-2v-1c0-.34-.04-.67-.09-1H20V8zm-6 12h-4v-2h4v2zm0-4h-4v-2h4v2z"/>
                                </g>

                                <!-- 2. Add: File Add Icon -->
                                <!-- 2. Add: File Add Icon -->
                                <g id="icon-add">
                                    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 14h-3v3h-2v-3H8v-2h3v-3h2v3h3v2zm-3-7V3.5L18.5 9H13z"/>
                                </g>

                                <!-- 3. Delete: Trash Icon -->
                                <!-- 3. Delete: Trash Icon -->
                                <g id="icon-delete">
                                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                                </g>

                                <!-- 4. Edit: Update Alt Icon -->
                                <!-- 4. Edit: Pencil Icon (edit-svgrepo-com) -->
                                <g id="icon-edit">
  <!-- Square outline -->
  <path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm0 2v14h14V5H5z"/>

  <!-- Pencil -->
  <path d="M8 16l2.5-.5L18 8l-2-2-7.5 7.5L8 16z"/>

  <!-- Pencil tip -->
  <path d="M14.5 6.5l2 2"/>
</g>



                                <!-- 5. Push: Upload/Arrow Up -->
                                <!-- 5. Push: Upload/Arrow Up -->
                                <g id="icon-push">
                                    <path d="M12 3L4 11h5v9h6v-9h5L12 3z"/>
                                </g>

                                <!-- 6. Pull: Download/Arrow Down -->
                                <!-- 6. Pull: Download/Arrow Down -->
                                <!-- 6. Pull: Download/Arrow Down -->
                                <g id="icon-pull">
                                    <path d="M12.75 3a.75.75 0 0 1 .75.75V11h2.522a.75.75 0 0 1 .53 1.28L12.53 16.31a.75.75 0 0 1-1.06 0l-4.022-4.03a.75.75 0 0 1 .53-1.28h2.522V3.75a.75.75 0 0 1 .75-.75ZM2.75 19.5a.75.75 0 0 1 .75-.75h17a.75.75 0 0 1 0 1.5h-17a.75.75 0 0 1-.75-.75Z" />
                                </g>

                                <!-- 7. Merge: Git Merge Icon -->
                                <!-- 7. Merge: Git Merge Icon -->
                                <!-- 7. Merge: Git Merge Icon -->
                                <g id="icon-merge">
                                    <path d="M5 3.254V3.25v.005a3.5 3.5 0 1 1-2 0V3.254h.005a3.501 3.501 0 0 1 2 0V8.25h1.745a4 4 0 0 1 4 4v5.496a3.5 3.5 0 1 1-2 0V12.25a2 2 0 0 0-2-2H5v7.496a3.5 3.5 0 1 1-2 0V8.25c0-.13.006-.258.017-.384A3.5 3.5 0 0 1 5 3.254ZM5 2.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0Zm0 17a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0Zm12-2a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0Z" />
                                </g>

                                <!-- 8. Undo: Undo Icon -->
                                <!-- 8. Undo: Undo Icon -->
                                <g id="icon-undo">
                                    <path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/>
                                </g>

                                <!-- 9. Initial / generic -->
                                <g id="icon-initial">
                                    <path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z" />
                                </g>
                                <g id="icon-normal">
                                    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
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

            // Custom Color Logic for Icons
            let iconColor = node.color; // Default to lane color, but overridden below for most types
            switch (node.type) {
                case 'add':
                case 'feat':
                    iconColor = '#2ea043'; // Green
                    break;
                case 'bug':
                case 'fix':
                case 'delete':
                    iconColor = '#cf222e'; // Red
                    break;
                case 'merge':
                    iconColor = '#ff9800'; // Orange
                    break;
                case 'edit':
                case 'modify':
                case 'push':
                case 'pull':
                    iconColor = '#a371f7'; // Violet
                    break;
                case 'undo':
                    iconColor = '#d29922'; // Orange
                    break;
                case 'initial':
                    iconColor = '#e3b341'; // Yellow
                    break;
                case 'tag':
                    iconColor = '#a371f7'; // Light Purple
                    break;
                case 'branch':
                    iconColor = '#24292f'; // Dark Grey (GitHub Dark) or use var
                    // For dark themes, this might be invisible. Let's use a visible color.
                    iconColor = '#00a8e8'; // Cyan
                    break;
                default:
                    // For 'normal' or unknown, use a distinct Grey instead of potentially light lane colors
                    iconColor = '#8c959f'; // Grey
                    break;
            }

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
                                    <!-- 1.5x size: scale(1.35). Center at 24*1.35/2 = 16.2. Translate by -16.2 to center it. -->
                                    <!-- Commit Node Icons (Multi-Icon Support) -->
                                    <g transform="translate(0, 0)"> 
                                        ${(() => {
                    // Determine icons to show
                    // Priority: Structural types take precedence.
                    // User Request: "if the commit is merge or pull use respective ison. no need for the delete add, edit etc"
                    const structuralTypes = ['merge', 'pull', 'initial', 'branch', 'tag', 'undo'];
                    // console.log('Node Hash:', node.hash, 'Types:', node.types);
                    const primary = node.types.find(t => structuralTypes.includes(t));

                    let iconsToShow = [];
                    // Logic: If it's a structural type (especially merge/pull), ONLY show that one.
                    if (primary) {
                        iconsToShow.push(primary);
                    } else {
                        // Show file ops ONLY if no primary structural type found
                        const ops = node.types.filter(t => !structuralTypes.includes(t) && t !== 'normal');
                        if (ops.length > 0) {
                            // Sort Order determines Position match: 
                            // i=0 -> Top-Left, i=1 -> Middle, i=2 -> Bottom-Right
                            // User wants: Delete Top, then Add, then Modify.
                            // So Priority: Delete, Add, Modify.
                            const priority = ['delete', 'bug', 'fix', 'add', 'create', 'push', 'edit', 'modify'];
                            iconsToShow = ops.sort((a, b) => {
                                let idxA = priority.indexOf(a);
                                let idxB = priority.indexOf(b);
                                if (idxA === -1) idxA = 99;
                                if (idxB === -1) idxB = 99;
                                return idxA - idxB;
                            });
                        } else {
                            iconsToShow.push('normal');
                        }
                    }

                    // Helper for colors
                    const getIconColor = (t: string) => {
                        switch (t) {
                            case 'add': case 'feat': return '#2ea043'; // Green
                            case 'bug': case 'fix': case 'delete': return '#cf222e'; // Red
                            case 'merge': case 'pull': return '#ff9800'; // Orange
                            case 'edit': case 'modify': case 'push': return '#a371f7'; // Violet
                            case 'undo': return '#d29922'; // Darker Orange
                            case 'initial': return '#e3b341'; // Yellow
                            case 'tag': return '#a371f7'; // Light Purple
                            case 'branch': return '#00a8e8'; // Cyan
                            default: return '#8c959f'; // Grey
                        }
                    };

                    // Render Icons
                    if (iconsToShow.length === 1) {
                        const t = iconsToShow[0];
                        const iconId = `icon-${t}`;
                        const color = getIconColor(t);
                        return `<g transform="translate(-16.2, -16.2) scale(1.35)"><use href="#${iconId}" fill="${color}" class="node-icon" /></g>`;
                    } else {
                        // Multi-icon stack
                        // 1. Calculate Positions based on Priority Order (Delete at Top-Left)
                        const count = iconsToShow.length;
                        const items = iconsToShow.map((t, i) => {
                            const step = 12 / (count > 1 ? count - 1 : 1);
                            // i=0 (Delete) -> -6 (Top-Left)
                            const offset = -6 + (i * step);
                            const trans = offset - 14.4;
                            return { t, trans, color: getIconColor(t) };
                        });

                        // 2. Reverse for Draw Order (Draw Bottom-Right first (background), Top-Left last (foreground))
                        // Reverse in-place or create new
                        items.reverse();

                        return items.map((item, i) => {
                            const iconId = `icon-${item.t}`;
                            // Use unique mask id
                            return `<g transform="translate(${item.trans}, ${item.trans}) scale(1.2)">
                                                                <defs>
                                                                    <mask id="mask-${node.hash}-${i}">
                                                                        <rect x="-10" y="-10" width="50" height="50" fill="white" />
                                                                    </mask>
                                                                </defs>
                                                                <use href="#${iconId}" fill="${item.color}" class="node-icon" stroke="var(--vscode-editor-background)" stroke-width="2" />
                                                            </g>`;
                        }).join('');
                    }
                })()}
                                    </g>
                                    
                                    <!-- Restored Text Labels with Multiline Support -->
                                    <foreignObject x="15" y="-14" width="300" height="80">
                                        <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: var(--vscode-font-family); font-size: 16px; line-height: 1.2; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; word-wrap: break-word;">
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
