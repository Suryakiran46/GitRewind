import { GitGraphNode } from './types';

export interface GraphNode extends GitGraphNode {
    x: number;
    y: number;
    lane: number;
    color: string;
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

        // Y position is simply the index (chronological)
        commits.forEach((commit, index) => {
            const node: GraphNode = {
                ...commit,
                x: 0,
                y: index * 50 + 30, // 50px vertical spacing
                lane: 0,
                color: ''
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
                // Find empty lane
                assignedLane = lanes.findIndex(l => l === null);
                if (assignedLane === -1) {
                    assignedLane = lanes.length;
                    lanes.push(null);
                }
            }

            node.lane = assignedLane;
            lanes[assignedLane] = null; // Occupy this lane for now

            // Propagate to parents
            // The first parent continues the lane.
            // Subsequent parents (merge) will need to find their own lanes later, 
            // but we register "expectations" here.

            if (node.parents.length > 0) {
                // First parent takes the current lane
                const firstParent = node.parents[0];
                if (lanes[node.lane] === null) {
                    lanes[node.lane] = firstParent;
                } else {
                    // Lane collision? (Merge logic can get complex)
                    // simplified: just search for next free lane for the parent
                    // For MVP, we might overwrite. 
                    // Let's protect against self-overwrite if possible, but keep it simple.
                    if (lanes[node.lane] !== firstParent) {
                        // This lane is already expecting something else?
                        // In a perfect world we handle this. 
                        // For now, let's just forcefully set it, visual glitches acceptable for MVP.
                        lanes[node.lane] = firstParent;
                    }
                }

                // Other parents (merge sources)
                for (let i = 1; i < node.parents.length; i++) {
                    const parentHash = node.parents[i];
                    // We need to register that 'parentHash' needs a lane.
                    // It will pick one up when we reach it.
                    // But we should try to reserve a slot? 
                    // Let's just Add it to a "pending" list? 
                    // Actually, if we just set a new lane for it:
                    let newLane = lanes.findIndex(l => l === parentHash);
                    if (newLane === -1) {
                        newLane = lanes.findIndex(l => l === null);
                        if (newLane === -1) {
                            newLane = lanes.length;
                            lanes.push(null);
                        }
                        lanes[newLane] = parentHash;
                    }
                }
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
            height: nodes.length * 50 + 50,
            width: lanes.length * 30 + 60
        };
    }
}
