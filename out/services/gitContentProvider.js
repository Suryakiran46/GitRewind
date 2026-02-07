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
exports.GitContentProvider = void 0;
const vscode = __importStar(require("vscode"));
class GitContentProvider {
    get onDidChange() { return this._onDidChange.event; }
    constructor(gitServiceFactory) {
        this.gitServiceFactory = gitServiceFactory;
        // Event checking mechanism
        this._onDidChange = new vscode.EventEmitter();
    }
    async provideTextDocumentContent(uri) {
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
        }
        catch (e) {
            return `Error loading content: ${e}`;
        }
    }
}
exports.GitContentProvider = GitContentProvider;
GitContentProvider.scheme = 'gitrewind-remote';
//# sourceMappingURL=gitContentProvider.js.map