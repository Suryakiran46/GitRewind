"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitFileSystemProvider = void 0;
const vscode = __importStar(require("vscode"));
class GitFileSystemProvider {
    get onDidChangeFile() { return this._onDidChangeFile.event; }
    constructor(gitServiceFactory) {
        this.gitServiceFactory = gitServiceFactory;
        // Event checking mechanism
        this._onDidChangeFile = new vscode.EventEmitter();
    }
    watch(uri, options) {
        // Read-only, no watching needed
        return new vscode.Disposable(() => { });
    }
    async stat(uri) {
        // We act as if everything exists for now. 
        // In a real impl we might check git, but for diff/viewing it's okay.
        // We can try to get actual size if needed, but VS Code usually just needs valid stat.
        return {
            type: vscode.FileType.File,
            ctime: Date.now(),
            mtime: Date.now(),
            size: 0,
            permissions: vscode.FilePermission.Readonly
        };
    }
    async readDirectory(uri) {
        // Not supporting directory browsing via this scheme yet, only direct file access
        return [];
    }
    async createDirectory(uri) {
        throw vscode.FileSystemError.NoPermissions('Read-only file system');
    }
    async readFile(uri) {
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
            const content = await gitService.getFileAtCommit(filePath, hash);
            if (content) {
                return new Uint8Array(Buffer.from(content, 'utf-8'));
            }
            else {
                return new Uint8Array(0);
            }
        }
        catch (e) {
            console.error('FS Provider Read Error:', e);
            throw vscode.FileSystemError.FileNotFound(uri);
        }
    }
    async writeFile(uri, content, options) {
        throw vscode.FileSystemError.NoPermissions('Read-only file system');
    }
    async delete(uri, options) {
        throw vscode.FileSystemError.NoPermissions('Read-only file system');
    }
    async rename(oldUri, newUri, options) {
        throw vscode.FileSystemError.NoPermissions('Read-only file system');
    }
}
exports.GitFileSystemProvider = GitFileSystemProvider;
GitFileSystemProvider.scheme = 'gitrewind-remote';
//# sourceMappingURL=gitFileSystemProvider.js.map