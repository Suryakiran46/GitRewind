import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class FileTreeProvider implements vscode.TreeDataProvider<FileItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<FileItem | undefined | null | void> = new vscode.EventEmitter<FileItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<FileItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private workspaceRoot: string | undefined) { }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: FileItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: FileItem): Thenable<FileItem[]> {
        if (!this.workspaceRoot) {
            vscode.window.showInformationMessage('No dependency in empty workspace');
            return Promise.resolve([]);
        }

        const dirPath = element ? element.resourceUri.fsPath : this.workspaceRoot;

        return Promise.resolve(this.getFilesAndDirectories(dirPath));
    }

    private getFilesAndDirectories(dirPath: string): FileItem[] {
        if (!this.pathExists(dirPath)) {
            return [];
        }

        const items: FileItem[] = [];
        const files = fs.readdirSync(dirPath);

        files.forEach(file => {
            // Skip .git folder
            if (file === '.git') return;

            const filePath = path.join(dirPath, file);
            const stat = fs.statSync(filePath);

            items.push(new FileItem(
                file,
                vscode.Uri.file(filePath),
                stat.isDirectory() ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
                stat.isDirectory()
            ));
        });

        // Sort: Directories first, then files
        return items.sort((a, b) => {
            if (a.isDirectory === b.isDirectory) {
                return a.label!.toString().localeCompare(b.label!.toString());
            }
            return a.isDirectory ? -1 : 1;
        });
    }

    private pathExists(p: string): boolean {
        try {
            fs.accessSync(p);
            return true;
        } catch (err) {
            return false;
        }
    }
}

class FileItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly resourceUri: vscode.Uri,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly isDirectory: boolean
    ) {
        super(label, collapsibleState);
        this.tooltip = this.resourceUri.fsPath;
        this.description = ''; // No description for now

        if (!isDirectory) {
            this.command = {
                command: 'gitrewind.openFileTimeline',
                title: 'Open Timeline',
                arguments: [this.resourceUri.fsPath]
            };
            this.contextValue = 'file';
        } else {
            this.contextValue = 'folder';
        }
    }
}
