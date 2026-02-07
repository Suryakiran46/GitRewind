import * as vscode from 'vscode';
import { Scope, ScopeType } from './types';

export class ScopeResolver {

    /**
     * Resolve the scope based on current selection or arguments.
     */
    resolve(uri?: vscode.Uri, selection?: vscode.Selection): Scope | null {
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

        if (!uri) return null;

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

function helperGetSelection(editor: vscode.TextEditor): vscode.Selection | undefined {
    return editor.selection;
}
