"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentGenerator = void 0;
const diffUtils_1 = require("../diffUtils");
class ContentGenerator {
    static generateSimilarityDisplay(data) {
        if (data.similarity !== undefined) {
            return `<strong>Similarity:</strong> <span class="similarity-badge">${data.similarity}%</span>`;
        }
        return '';
    }
    static generateCommitsSection(data) {
        if (data.commits.length === 0) {
            return '';
        }
        const currentCommit = data.commits[data.currentCommitIndex];
        const commitNavigation = `
      <div class="commit-navigation">
        <button class="nav-button" onclick="navigateToCommit(${Math.max(0, data.currentCommitIndex - 1)})" 
                ${data.currentCommitIndex === 0 ? 'disabled' : ''}>
            ← Previous
        </button>
        
        <div class="commit-info">
          <div class="commit-hash">${currentCommit?.hash.substring(0, 8) || 'Unknown'}</div>
          <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-top: 3px;">
            ${currentCommit?.message || 'No message'} 
            • ${currentCommit?.author || 'Unknown author'}
            • ${currentCommit?.date ? new Date(currentCommit.date).toLocaleDateString() : 'Unknown date'}
          </div>
        </div>
        
        <button class="nav-button" onclick="navigateToCommit(${Math.min(data.commits.length - 1, data.currentCommitIndex + 1)})"
                ${data.currentCommitIndex >= data.commits.length - 1 ? 'disabled' : ''}>
          Next →
        </button>
      </div>
    `;
        const timeline = `
      <div class="timeline">
        <div class="timeline-header">Commit History (${data.commits.length} commits)</div>
        <div class="commit-list">
          ${data.commits.map((commit, index) => `
            <div class="commit-item ${index === data.currentCommitIndex ? 'active' : ''}" 
                 onclick="navigateToCommit(${index})">
              <div class="commit-dot"></div>
              <div class="commit-details">
                <div class="commit-message">${diffUtils_1.DiffUtils.escapeHtml(commit.message)}</div>
                <div class="commit-meta">
                  ${commit.hash.substring(0, 8)} • ${diffUtils_1.DiffUtils.escapeHtml(commit.author)} • ${new Date(commit.date).toLocaleDateString()}
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
        return commitNavigation + timeline;
    }
    static generateDiffContent(data) {
        if (data.currentFunction || data.historicalFunction) {
            return data.diffHtml;
        }
        return '<div class="no-function-message">No function found in the selected code or historical versions.</div>';
    }
    static replaceTemplatePlaceholders(template, data) {
        return template
            .replace('{{SIMILARITY_DISPLAY}}', this.generateSimilarityDisplay(data))
            .replace('{{COMMITS_SECTION}}', this.generateCommitsSection(data))
            .replace('{{DIFF_CONTENT}}', this.generateDiffContent(data))
            .replace('{{CURRENT_COMMIT_INDEX}}', data.currentCommitIndex.toString())
            .replace('{{COMMITS_LENGTH}}', data.commits.length.toString());
    }
}
exports.ContentGenerator = ContentGenerator;
//# sourceMappingURL=contentGenerator.js.map