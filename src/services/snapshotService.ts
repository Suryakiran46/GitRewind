import { GitService } from './gitService';
import { Scope, ScopeType } from './types';
import * as path from 'path';

export interface Snapshot {
    content: string; // File content or Function body
    metadata?: any; // e.g., file list for folders
}

export class SnapshotService {
    private gitService: GitService;

    constructor(gitService: GitService) {
        this.gitService = gitService;
    }

    /**
     * Get a snapshot of the code at a specific commit based on scope.
     */
    async getSnapshot(scope: Scope, commitHash: string): Promise<Snapshot | null> {
        switch (scope.type) {
            case 'file':
                return this.getFileSnapshot(scope.target, commitHash);
            case 'function':
                // For function scope, we first get the file content, then extract the function.
                // Note: Function extraction logic requires the AST parser (to be refactored).
                // For now, we return the full file content as a placeholder or raw text.
                return this.getFileSnapshot(scope.target, commitHash);
            case 'folder':
                // Folder snapshot implementation (File list)
                return this.getFolderSnapshot(scope.target, commitHash);
            default:
                return null;
        }
    }

    private async getFileSnapshot(filePath: string, commitHash: string): Promise<Snapshot> {
        const content = await this.gitService.getFileAtCommit(filePath, commitHash);
        return { content };
    }

    private async getFolderSnapshot(folderPath: string, commitHash: string): Promise<Snapshot> {
        // Implementation for folder scope (listing files at commit)
        const files = await this.gitService.getTree(commitHash);
        return {
            content: 'Folder Snapshot',
            metadata: {
                files: files.sort()
            }
        };
    }
}
