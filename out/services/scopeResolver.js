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
exports.ScopeResolver = void 0;
const vscode = __importStar(require("vscode"));
class ScopeResolver {
    /**
     * Resolve the scope based on current selection or arguments.
     */
    resolve(uri, selection) {
        // 1. If explicit URI provided (e.g. from context menu on file explorer)
        if (uri) {
            // Check if it's a folder? (Not easy synchronously without stat, assuming file for now or checking FS)
            // For MVP, if it's from command palette with active editor:
        }
        const editor = vscode.window.activeTextEditor;
        // 2. If no URI, use active editor
        if (!uri && editor) {
            uri = editor.document.uri;
            selection = helperGetSelection(editor);
        }
        if (!uri)
            return null;
        // 3. Check for specific function selection
        // Refactored logic from legacy parser would go here.
        // For now, if there is a non-empty selection, we assume "Function/Block" scope if we can parse it.
        // Otherwise "File" scope.
        if (selection && !selection.isEmpty) {
            // TODO: Connect to FunctionTracker
            return {
                type: 'function',
                target: uri.fsPath,
                metadata: { selection }
            };
        }
        // Default to File scope
        return {
            type: 'file',
            target: uri.fsPath
        };
    }
}
exports.ScopeResolver = ScopeResolver;
function helperGetSelection(editor) {
    return editor.selection;
}
//# sourceMappingURL=scopeResolver.js.map