
import * as vscode from 'vscode';
import { GitService } from './gitService';

export class GitContentProvider implements vscode.TextDocumentContentProvider {
    static scheme = 'gitrewind-remote';

    // Event checking mechanism
    private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
    get onDidChange(): vscode.Event<vscode.Uri> { return this._onDidChange.event; }

    constructor(private gitServiceFactory: (path: string) => Promise<GitService | null>) { }

    async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
        // URI format: gitrewind-remote://<hash>/<path>
        // However, VS Code URIs are complex. A safer pattern is:
        // scheme: gitrewind-remote
        // authority: <hash>
        // path: /<path/to/file>
        // query: <workspaceRoot> (to initialize GitService)

        const hash = uri.authority;
        const filePath = uri.path.substring(1); // Remove leading slash
        const workspaceRoot = uri.query;

        if (!hash || !filePath || !workspaceRoot) {
            return '';
        }

        const gitService = await this.gitServiceFactory(workspaceRoot);
        if (!gitService) {
            return `Error: Git service could not be initialized for ${workspaceRoot}`;
        }

        try {
            const content = await gitService.getFileAtCommit(filePath, hash);
            return content || '';
        } catch (e) {
            return `Error loading content: ${e}`;
        }
    }
}
