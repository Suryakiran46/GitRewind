"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SnapshotService = void 0;
class SnapshotService {
    constructor(gitService) {
        this.gitService = gitService;
    }
    /**
     * Get a snapshot of the code at a specific commit based on scope.
     */
    async getSnapshot(scope, commitHash) {
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
    async getFileSnapshot(filePath, commitHash) {
        const content = await this.gitService.getFileAtCommit(filePath, commitHash);
        return { content };
    }
    async getFolderSnapshot(folderPath, commitHash) {
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
exports.SnapshotService = SnapshotService;
//# sourceMappingURL=snapshotService.js.map