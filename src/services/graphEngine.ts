import { GitGraphNode } from './types';

export interface GraphNode extends GitGraphNode {
    x: number;
    y: number;
    lane: number;
    color: string;
    type: string; // Primary type (legacy/fallback)
    types: string[]; // List of specific action types for multi-icon support
}

export interface GraphLink {
    source: string; // hash
    target: string; // hash
    sourceLane: number;
    targetLane: number;
}

export interface GraphData {
    nodes: GraphNode[];
    links: GraphLink[];
    height: number;
    width: number;
    hasMore?: boolean;
}

export class GraphEngine {
    private laneColors = [
        '#00a8e8', // Cyan
        '#f25f5c', // Red
        '#ffe066', // Yellow
        '#247ba0', // Blue
        '#70c1b3', // Green
        '#b2dbbf'  // Light Green
    ];

    /**
     * Process raw commits into a visual graph.
     * @param commits Sorted list of commits (time descending)
     */
    process(commits: GitGraphNode[]): GraphData {
        const nodes: GraphNode[] = [];
        const links: GraphLink[] = [];

        // Map to track active branches in lanes
        // lane index -> commit hash of the 'tip' of that lane
        const lanes: (string | null)[] = [];

        const commitMap = new Map<string, GraphNode>();
        let maxLaneIndex = 0;

        // Y position is simply the index (chronological)
        commits.forEach((commit, index) => {
            // Determine Node Types
            const types: string[] = [];
            let primaryType = 'normal';

            const lowerMsg = (commit.message || '').toLowerCase();
            const refs = (commit.branch || '').toLowerCase(); // branch property holds refs string usually
            const files = commit.files || [];

            // 1. High Priority Structural Types
            if (commit.parents.length === 0) {
                types.push('initial');
                primaryType = 'initial';
            } else if (commit.parents.length > 1) {
                types.push('merge');
                primaryType = 'merge';
            } else if (refs.includes('tag:')) {
                types.push('tag');
                primaryType = 'tag';
            } else if (lowerMsg.includes('pull') || lowerMsg.includes('merge')) {
                // Enhanced Pull/Merge detection
                if (!types.includes('merge') && !types.includes('pull')) {
                    // If it says 'merge', treat as merge unless we want to distinguish
                    if (lowerMsg.includes('pull')) {
                        types.push('pull');
                        primaryType = 'pull';
                    } else {
                        types.push('merge');
                        primaryType = 'merge';
                    }
                }
            } else if (lowerMsg.includes('revert') || lowerMsg.includes('undo')) {
                types.push('undo');
                primaryType = 'undo';
            }

            // 2. File Operation Types (Only if not a merge/pull, or if we want to show everything)
            // User request: "if the commit is merge or pull use respective ison. else ..."
            // So if we have merge/pull, we STOP here (effectively).

            if (types.length === 0) {
                // Analyze file stats
                const hasAdd = files.some(f => f.status === 'A');
                // Git status 'D' is delete. 'M' is modify. 'R' is rename (treat as modify/edit).
                const hasDelete = files.some(f => f.status === 'D');
                const hasModify = files.some(f => f.status === 'M' || f.status === 'R' || f.status === 'C' || f.status === 'T');

                if (hasAdd) types.push('add');
                if (hasDelete) types.push('delete');
                if (hasModify) types.push('edit');

                // Fallback to message heuristics if no file stats available (e.g. old data or errors)
                if (types.length === 0) {
                    if (lowerMsg.includes('fix') || lowerMsg.includes('bug')) {
                        types.push('bug');
                    } else if (lowerMsg.includes('feat') || lowerMsg.includes('add')) {
                        types.push('add');
                    } else if (lowerMsg.includes('delete') || lowerMsg.includes('remove')) {
                        types.push('delete');
                    } else if (lowerMsg.includes('edit') || lowerMsg.includes('update')) {
                        types.push('edit');
                    } else if (lowerMsg.includes('push')) {
                        types.push('push');
                    }
                }
            }

            // Default
            if (types.length === 0) {
                types.push('normal');
            }

            // Set primary type for backward compatibility / color default
            if (primaryType === 'normal' && types.length > 0) {
                primaryType = types[0];
            }

            const node: GraphNode = {
                ...commit,
                x: 0,
                y: index * 80 + 30, // 80px vertical spacing for multiline messages
                lane: 0,
                color: '',
                type: primaryType,
                types: types
            };
            commitMap.set(commit.hash, node);
            nodes.push(node);
        });

        // Assign lanes
        // This is a simplified "git graph" algorithm
        nodes.forEach((node) => {
            // 1. Try to find a lane that connects to this node (is a child of a previous node in that lane)
            // But wait, we are iterating newest to oldest.
            // So we are looking for a lane that "expects" this commit as a parent.

            // Actually, standard git graph algo:
            // Iterate from newest to oldest.
            // If this node is the first time we see a branch, assign a new lane.
            // If this node is a parent of a previously seen node, try to reuse that lane.

            // Simplified approach for MVP:
            // Just use the branch name if available, otherwise reuse parent logic.

            let assignedLane = -1;

            // Check if any existing lane is "waiting" for this commit (as a parent)
            for (let i = 0; i < lanes.length; i++) {
                if (lanes[i] === node.hash) {
                    assignedLane = i;
                    break;
                }
            }

            // If no lane is waiting for this, it's a new tip (or a merge sink)
            if (assignedLane === -1) {
                // Find empty lane - Simple approach for now
                assignedLane = lanes.findIndex(l => l === null);
                if (assignedLane === -1) {
                    assignedLane = lanes.length;
                    lanes.push(null);
                }
            }

            node.lane = assignedLane;
            if (assignedLane > maxLaneIndex) maxLaneIndex = assignedLane;
            lanes[assignedLane] = null; // Occupy this lane for now

            // Propagate to parents
            // The first parent continues the lane.
            // Subsequent parents (merge) will need to find their own lanes later, 
            // but we register "expectations" here.

            if (node.parents.length > 0) {
                // 1. Primary Parent (First Parent)
                // Continues the current lane.
                const firstParent = node.parents[0];
                lanes[assignedLane] = firstParent;

                // 2. Secondary Parents (Merges)
                // These need to start new lanes if they aren't already tracked.
                for (let i = 1; i < node.parents.length; i++) {
                    const parentHash = node.parents[i];

                    // Check if this parent is already waiting in a lane
                    if (!lanes.includes(parentHash)) {
                        // Assign a new lane for this parent
                        // OPTIMIZATION: Try to find a free lane CLOSE to the current one
                        // to minimize the arrow length (Manhattan distance)
                        let bestLane = -1;
                        let minDist = Infinity;

                        // Search existing lanes for a free spot
                        for (let l = 0; l < lanes.length; l++) {
                            if (lanes[l] === null) {
                                const dist = Math.abs(l - assignedLane);
                                if (dist < minDist) {
                                    minDist = dist;
                                    bestLane = l;
                                }
                            }
                        }

                        if (bestLane !== -1) {
                            lanes[bestLane] = parentHash;
                        } else {
                            // No free lane, append a new one
                            lanes.push(parentHash);
                            if (lanes.length - 1 > maxLaneIndex) maxLaneIndex = lanes.length - 1;
                        }
                    }
                }
            } else {
                // Root commit (or disjoint root), frees the lane
                lanes[assignedLane] = null;
            }


            node.x = node.lane * 30 + 50; // 30px horizontal spacing, 50px base offset for avatars
            node.color = this.laneColors[node.lane % this.laneColors.length];
        });

        // Generate Links
        nodes.forEach(node => {
            node.parents.forEach(parentHash => {
                // Only link if parent exists in our current graph (pagination support)
                const parentNode = commitMap.get(parentHash);
                if (parentNode) {
                    links.push({
                        source: node.hash,
                        target: parentHash,
                        sourceLane: node.lane,
                        targetLane: parentNode.lane
                    });
                }
            });
        });

        return {
            nodes,
            links,
            height: nodes.length * 80 + 200, // Increased buffer at bottom
            width: (maxLaneIndex + 1) * 50 + 400 // Dynamic width based on lanes used + space for messages
        };
    }
    /**
     * Process commits into a linear timeline (e.g. for single file history).
     * Ignoring branching/merging topology, just linking previous to next in the list.
     */
    processLinear(commits: GitGraphNode[], hasMore: boolean = false): GraphData {
        console.log(`[GraphEngine] processLinear called with ${commits.length} commits, hasMore=${hasMore}`);
        const nodes: GraphNode[] = [];
        const links: GraphLink[] = [];

        commits.forEach((commit, index) => {
            // Determine Node Types (simplified for linear view)
            const types: string[] = [];
            let primaryType = 'normal';

            // ... (keep existing type logic or simplify)
            // Reuse logic from process() or extract it? 
            // For now, let's duplicate the relevant type detection for safety/speed
            // or we can refactor later. Let's keep it simple.

            // 1. Strict File Status Logic (No Structural Types like Merge/Pull)
            // User Request: "only allowed icons are flag for origin then edit... delete... add... no other like merge pull"

            // 1. Strict File Status Logic (No Structural Types like Merge/Pull)
            // User Request: "flag should be also used the graph representing timeline of a file... starting one atleast"

            if (index === commits.length - 1 && !hasMore) {
                types.push('initial'); // Flag
                primaryType = 'initial';
            } else {
                // For all other commits, check status
                if (commit.files && commit.files.length > 0) {
                    const status = commit.files[0].status.toUpperCase();
                    if (status === 'A') {
                        types.push('initial'); // Flag (Creation)
                        primaryType = 'initial';
                    } else if (status === 'R' || status === 'C') {
                        types.push('add'); // Plus (Rename/Copy)
                        primaryType = 'add';
                    } else if (status === 'D') {
                        types.push('delete'); // Trash
                        primaryType = 'delete';
                    } else {
                        // M, T, etc. -> Edit
                        types.push('edit'); // Pencil
                        primaryType = 'edit';
                    }
                } else {
                    // Fallback
                    types.push('edit');
                    primaryType = 'edit';
                }
            }

            if (types.length === 0) types.push('normal');
            if (primaryType === 'normal' && types.length > 0) primaryType = types[0];

            const node: GraphNode = {
                ...commit,
                x: 50, // Fixed X for single lane
                y: index * 80 + 30,
                lane: 0,
                color: this.laneColors[0],
                type: primaryType,
                types: types
            };
            nodes.push(node);

            // Link to previous commit in the list (which is the child in time)
            // Wait, we process from Newest to Oldest usually.
            // So commits[0] is newest. commits[1] is older.
            // We want arrow from commits[0] to commits[1]? 
            // Standard graph is Parent -> Child (Old -> New).
            // But we draw links usually Source -> Target.
            // In process():
            // links.push({ source: node.hash, target: parentHash ... })
            // So we want source=New, target=Old.

            if (index < commits.length - 1) {
                const parent = commits[index + 1];
                links.push({
                    source: node.hash,
                    target: parent.hash,
                    sourceLane: 0,
                    targetLane: 0
                });
            }
        });

        return {
            nodes,
            links,
            height: nodes.length * 80 + 200,
            width: 1200 // Expanded width for full messages
        };
    }
}
