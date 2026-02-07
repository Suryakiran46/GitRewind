"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiffUtils = void 0;
const diff_1 = require("diff");
/**
 * Utility class for generating and formatting diffs
 */
class DiffUtils {
    /**
     * Generate a line-by-line diff between two pieces of code
     */
    static generateLineDiff(oldCode, newCode) {
        const changes = (0, diff_1.diffLines)(oldCode || '', newCode || '');
        const oldLines = [];
        const newLines = [];
        let hasChanges = false;
        for (const change of changes) {
            const lines = change.value.split('\n');
            // Remove the last empty line if it exists
            if (lines[lines.length - 1] === '') {
                lines.pop();
            }
            if (change.removed) {
                oldLines.push(...lines);
                hasChanges = true;
            }
            else if (change.added) {
                newLines.push(...lines);
                hasChanges = true;
            }
            else {
                oldLines.push(...lines);
                newLines.push(...lines);
            }
        }
        return {
            changes,
            oldLines,
            newLines,
            hasChanges
        };
    }
    /**
     * Generate a word-level diff for more granular changes
     */
    static generateWordDiff(oldCode, newCode) {
        return (0, diff_1.diffWordsWithSpace)(oldCode || '', newCode || '');
    }
    /**
     * Create HTML representation of side-by-side diff
     */
    static generateSideBySideHtml(oldCode, newCode, title1 = 'Previous Version', title2 = 'Current Version', fileName = '') {
        const diff = this.generateLineDiff(oldCode, newCode);
        if (!diff.hasChanges) {
            return this.generateNoChangesHtml(newCode, title2, fileName);
        }
        const changes = (0, diff_1.diffLines)(oldCode || '', newCode || '');
        let oldHtml = '';
        let newHtml = '';
        let oldLineNum = 1;
        let newLineNum = 1;
        let changeBlockId = 1;
        for (const change of changes) {
            const lines = change.value.split('\n');
            // Remove the last empty line only if the change doesn't end with newline
            if (lines.length > 0 && lines[lines.length - 1] === '' && !change.value.endsWith('\n')) {
                lines.pop();
            }
            if (change.removed) {
                const blockId = `change-${changeBlockId++}`;
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    const escapedLine = this.escapeHtml(line);
                    const changeMarker = i === 0 ? `id="${blockId}" data-change-block="${blockId}"` : '';
                    oldHtml += `<div class="line removed" data-line="${oldLineNum}" ${changeMarker}>
            <span class="line-number">${oldLineNum}</span>
            <span class="line-content">${escapedLine}</span>
          </div>`;
                    oldLineNum++;
                }
            }
            else if (change.added) {
                const blockId = `change-${changeBlockId++}`;
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    const escapedLine = this.escapeHtml(line);
                    const changeMarker = i === 0 ? `id="${blockId}" data-change-block="${blockId}"` : '';
                    newHtml += `<div class="line added" data-line="${newLineNum}" ${changeMarker}>
            <span class="line-number">${newLineNum}</span>
            <span class="line-content">${escapedLine}</span>
          </div>`;
                    newLineNum++;
                }
            }
            else {
                for (const line of lines) {
                    const escapedLine = this.escapeHtml(line);
                    oldHtml += `<div class="line unchanged" data-line="${oldLineNum}">
            <span class="line-number">${oldLineNum}</span>
            <span class="line-content">${escapedLine}</span>
          </div>`;
                    newHtml += `<div class="line unchanged" data-line="${newLineNum}">
            <span class="line-number">${newLineNum}</span>
            <span class="line-content">${escapedLine}</span>
          </div>`;
                    oldLineNum++;
                    newLineNum++;
                }
            }
        }
        return `
      <div class="diff-container">
        <div class="diff-side">
          <div class="diff-header">${this.escapeHtml(title1)}</div>
          <div class="diff-content old-content">${oldHtml}</div>
        </div>
        <div class="diff-side">
          <div class="diff-header">${this.escapeHtml(title2)}</div>
          <div class="diff-content new-content">${newHtml}</div>
        </div>
      </div>
    `;
    }
    /**
     * Generate HTML when there are no changes
     */
    static generateNoChangesHtml(code, title, fileName = '') {
        const lines = code.split('\n');
        let html = '';
        for (let i = 0; i < lines.length; i++) {
            const escapedLine = this.escapeHtml(lines[i]);
            html += `<div class="line unchanged" data-line="${i + 1}">
        <span class="line-number">${i + 1}</span>
        <span class="line-content">${escapedLine}</span>
      </div>`;
        }
        return `
      <div class="diff-container no-changes">
        <div class="diff-side single">
          <div class="diff-header">${this.escapeHtml(title)} (No Changes Found)</div>
          <div class="diff-content">${html}</div>
        </div>
      </div>
    `;
    }
    /**
     * Escape HTML entities (minimal for clean display)
     */
    static escapeHtml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        // Keep quotes as-is for better readability
    }
    /**
     * Apply basic syntax highlighting to code (simplified version)
     */
    static applySyntaxHighlighting(code, fileName = '') {
        // For now, just escape HTML and return clean text
        // We'll add minimal highlighting that doesn't interfere with display
        return this.escapeHtml(code);
    }
    /**
     * Generate unified diff format (like git diff)
     */
    static generateUnifiedDiff(oldCode, newCode, filename = 'file') {
        const changes = (0, diff_1.diffLines)(oldCode || '', newCode || '');
        let result = `--- a/${filename}\n+++ b/${filename}\n`;
        let oldLine = 1;
        let newLine = 1;
        for (const change of changes) {
            const lines = change.value.split('\n').filter((line) => line !== '' || change.value.endsWith('\n'));
            if (change.removed) {
                for (const line of lines) {
                    if (line !== '') {
                        result += `-${line}\n`;
                        oldLine++;
                    }
                }
            }
            else if (change.added) {
                for (const line of lines) {
                    if (line !== '') {
                        result += `+${line}\n`;
                        newLine++;
                    }
                }
            }
            else {
                for (const line of lines) {
                    if (line !== '') {
                        result += ` ${line}\n`;
                        oldLine++;
                        newLine++;
                    }
                }
            }
        }
        return result;
    }
    /**
     * Calculate similarity percentage between two code blocks
     */
    static calculateSimilarity(oldCode, newCode) {
        if (!oldCode && !newCode) {
            return 100;
        }
        if (!oldCode || !newCode) {
            return 0;
        }
        const changes = (0, diff_1.diffWordsWithSpace)(oldCode, newCode);
        let totalLength = 0;
        let unchangedLength = 0;
        for (const change of changes) {
            totalLength += change.value.length;
            if (!change.added && !change.removed) {
                unchangedLength += change.value.length;
            }
        }
        return totalLength > 0 ? Math.round((unchangedLength / totalLength) * 100) : 0;
    }
    /**
     * Calculate change statistics including change blocks for navigation
     */
    static calculateChangeStats(oldCode, newCode) {
        const changes = (0, diff_1.diffLines)(oldCode || '', newCode || '');
        let additions = 0;
        let deletions = 0;
        let oldLineNum = 1;
        let newLineNum = 1;
        const changeBlocks = [];
        let blockId = 1;
        for (const change of changes) {
            const lines = change.value.split('\n');
            if (lines.length > 0 && lines[lines.length - 1] === '' && !change.value.endsWith('\n')) {
                lines.pop();
            }
            if (change.removed) {
                deletions += lines.length;
                const startLine = oldLineNum;
                const endLine = oldLineNum + lines.length - 1;
                changeBlocks.push({
                    id: `change-${blockId++}`,
                    type: 'removed',
                    startLine,
                    endLine,
                    summary: `${lines.length} line${lines.length === 1 ? '' : 's'} removed`
                });
                oldLineNum += lines.length;
            }
            else if (change.added) {
                additions += lines.length;
                const startLine = newLineNum;
                const endLine = newLineNum + lines.length - 1;
                changeBlocks.push({
                    id: `change-${blockId++}`,
                    type: 'added',
                    startLine,
                    endLine,
                    summary: `${lines.length} line${lines.length === 1 ? '' : 's'} added`
                });
                newLineNum += lines.length;
            }
            else {
                oldLineNum += lines.length;
                newLineNum += lines.length;
            }
        }
        return {
            totalChanges: additions + deletions,
            additions,
            deletions,
            changeBlocks
        };
    }
}
exports.DiffUtils = DiffUtils;
//# sourceMappingURL=diffUtils.js.map