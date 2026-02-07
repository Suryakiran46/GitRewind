
import * as vscode from 'vscode';
import { GitService } from './gitService';

export class GitFileSystemProvider implements vscode.FileSystemProvider {
    static scheme = 'gitrewind-remote';

    // Event checking mechanism
    private _onDidChangeFile = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    get onDidChangeFile(): vscode.Event<vscode.FileChangeEvent[]> { return this._onDidChangeFile.event; }

    constructor(private gitServiceFactory: (path: string) => Promise<GitService | null>) { }

    watch(uri: vscode.Uri, options: { recursive: boolean; excludes: string[]; }): vscode.Disposable {
        // Read-only, no watching needed
        return new vscode.Disposable(() => { });
    }

    async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
        // We act as if everything exists for now. 
        // In a real impl we might check git, but for diff/viewing it's okay.
        // We can try to get actual size if needed, but VS Code usually just needs valid stat.
        return {
            type: vscode.FileType.File,
            ctime: Date.now(),
            mtime: Date.now(),
            size: 0, // Git doesn't give size easily without extra command, usually 0 is fine for read-only
            permissions: vscode.FilePermission.Readonly
        };
    }

    async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
        // Not supporting directory browsing via this scheme yet, only direct file access
        return [];
    }

    async createDirectory(uri: vscode.Uri): Promise<void> {
        throw vscode.FileSystemError.NoPermissions('Read-only file system');
    }

    async readFile(uri: vscode.Uri): Promise<Uint8Array> {
        // URI format: gitrewind-remote://<hash>/<path>?<workspaceRoot>
        // authority: <hash>
        // path: /<path/to/file>
        // query: <workspaceRoot>

        const hash = uri.authority;
        const filePath = uri.path.substring(1); // Remove leading slash
        const workspaceRoot = uri.query;

        if (!hash || !filePath || !workspaceRoot) {
            throw vscode.FileSystemError.FileNotFound(uri);
        }

        const gitService = await this.gitServiceFactory(workspaceRoot);
        if (!gitService) {
            throw vscode.FileSystemError.Unavailable(uri);
        }

        try {
            const buffer = await gitService.getFileBufferAtCommit(filePath, hash);
            if (buffer) {
                return new Uint8Array(buffer);
            } else {
                return new Uint8Array(0);
            }
        } catch (e) {
            console.error('FS Provider Read Error:', e);
            throw vscode.FileSystemError.FileNotFound(uri);
        }
    }

    async writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean; }): Promise<void> {
        throw vscode.FileSystemError.NoPermissions('Read-only file system');
    }

    async delete(uri: vscode.Uri, options: { recursive: boolean; }): Promise<void> {
        throw vscode.FileSystemError.NoPermissions('Read-only file system');
    }

    async rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean; }): Promise<void> {
        throw vscode.FileSystemError.NoPermissions('Read-only file system');
    }
}
