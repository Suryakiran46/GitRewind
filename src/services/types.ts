
export interface CommitInfo {
    hash: string;
    parents: string[];
    date: string;
    message: string;
    author: string;
    email: string; // Added for Avatar/Gravatar
    branch?: string;
    timestamp: number;
    stats?: {      // Added for Impact visualization
        insertions: number;
        deletions: number;
        filesChanged: number;
    };
    files?: { status: string; path: string }[]; // Added for detailed view
}

export interface GitGraphNode extends CommitInfo {
    // UI specific properties can be added here later
    lane?: number;
}

export type ScopeType = 'function' | 'file' | 'folder' | 'repo';

export interface Scope {
    type: ScopeType;
    target: string; // Absolute path or function signature
    metadata?: any;
}

export interface FileChange {
    path: string;
    type: 'added' | 'modified' | 'deleted' | 'renamed';
}
