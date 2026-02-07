"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphEngine = void 0;
class GraphEngine {
    constructor() {
        this.laneColors = [
            '#00a8e8',
            '#f25f5c',
            '#ffe066',
            '#247ba0',
            '#70c1b3',
            '#b2dbbf' // Light Green
        ];
    }
    /**
     * Process raw commits into a visual graph.
     * @param commits Sorted list of commits (time descending)
     */
    process(commits) {
        const nodes = [];
        const links = [];
        // Map to track active branches in lanes
        // lane index -> commit hash of the 'tip' of that lane
        const lanes = [];
        const commitMap = new Map();
        let maxLaneIndex = 0;
        // Y position is simply the index (chronological)
        commits.forEach((commit, index) => {
            // Determine Node Type
            let type = 'normal';
            const lowerMsg = (commit.message || '').toLowerCase();
            const refs = (commit.branch || '').toLowerCase(); // branch property holds refs string usually
            if (commit.parents.length === 0) {
                type = 'initial';
            }
            else if (commit.parents.length > 1) {
                type = 'merge';
            }
            else if (refs.includes('tag:')) {
                type = 'tag';
            }
            else if (refs.includes('head') || refs.length > 0) { // If it has a branch name, it's a tip
                // But wait, many commits might be on a branch. 
                // We want "Branch Tip" specifically?
                // Usually simple-git refs only show up on the tip capable commits.
                // Let's assume if it has a ref (branch name), it is a tip of that ref.
                type = 'branch';
            }
            else if (lowerMsg.includes('fix') || lowerMsg.includes('bug') || lowerMsg.includes('issue')) {
                type = 'fix';
            }
            else if (lowerMsg.includes('feat') || lowerMsg.includes('add') || lowerMsg.includes('new')) {
                type = 'feat';
            }
            const node = {
                ...commit,
                x: 0,
                y: index * 80 + 30,
                lane: 0,
                color: '',
                type: type
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
            if (assignedLane > maxLaneIndex)
                maxLaneIndex = assignedLane;
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
                        }
                        else {
                            // No free lane, append a new one
                            lanes.push(parentHash);
                            if (lanes.length - 1 > maxLaneIndex)
                                maxLaneIndex = lanes.length - 1;
                        }
                    }
                }
            }
            else {
                // Root commit (or disjoint root), frees the lane
                lanes[assignedLane] = null;
            }
            node.x = node.lane * 30 + 30; // 30px horizontal spacing
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
            height: nodes.length * 80 + 200,
            width: (maxLaneIndex + 1) * 50 + 400 // Dynamic width based on lanes used + space for messages
        };
    }
}
exports.GraphEngine = GraphEngine;
//# sourceMappingURL=graphEngine.js.map