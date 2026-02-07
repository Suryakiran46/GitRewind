import { simpleGit, SimpleGit, LogResult } from 'simple-git';
import * as vscode from 'vscode';
import * as path from 'path';

export interface CommitInfo {
  hash: string;
  parents?: string[];
  author: string;
  authorEmail?: string;
  date: string;
  message: string;
  timestamp?: number;
  files?: { status: string; path: string }[];
}

export class GitUtils {
  private git: SimpleGit;
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.git = simpleGit(workspaceRoot);
  }

  /**
   * Get the Git repository root for the given file
   */
  static async getRepoRoot(filePath: string): Promise<string | null> {
    try {
      const git = simpleGit(path.dirname(filePath));
      const isRepo = await git.checkIsRepo();
      if (!isRepo) {
        return null;
      }

      const root = await git.revparse(['--show-toplevel']);
      return root.trim();
    } catch (error) {
      console.error('Error getting repo root:', error);
      return null;
    }
  }

  /**
   * Get commit history for a specific file
   */
  async getFileHistory(filePath: string, maxCount: number = 10): Promise<CommitInfo[]> {
    try {
      let relativePath = path.relative(this.workspaceRoot, filePath);
      // Fix: Normalize path separators to forward slashes for Git
      relativePath = relativePath.split(path.sep).join('/');

      const log = await this.git.log({
        file: relativePath,
        maxCount
      });

      return log.all.map((commit: any) => ({
        hash: commit.hash,
        date: commit.date,
        message: commit.message,
        author: commit.author_name || commit.author || 'Unknown'
      }));
    } catch (error) {
      console.error('Error getting file history:', error);
      throw new Error(`Failed to get Git history: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get file contents at a specific commit
   */
  async getFileAtCommit(filePath: string, commitHash: string): Promise<string | null> {
    try {
      let relativePath = path.relative(this.workspaceRoot, filePath);
      // Fix: Normalize path separators to forward slashes for Git
      relativePath = relativePath.split(path.sep).join('/');

      const content = await this.git.show([`${commitHash}:${relativePath}`]);
      return content;
    } catch (error) {
      console.error(`Error getting file at commit ${commitHash}:`, error);
      return null;
    }
  }

  /**
   * Get raw diff between two commits for a specific file
   */
  async getDiff(filePath: string, hashA: string, hashB: string): Promise<string> {
    try {
      let relativePath = path.relative(this.workspaceRoot, filePath);
      relativePath = relativePath.split(path.sep).join('/');
      return await this.git.diff([hashA, hashB, '--', relativePath]);
    } catch (error) {
      console.error('Error getting diff:', error);
      return '';
    }
  }

  /**
   * Check if the workspace has Git initialized
   */
  async isGitRepository(): Promise<boolean> {
    try {
      return await this.git.checkIsRepo();
    } catch (error) {
      return false;
    }
  }

  /**
   * Get the current commit hash
   */
  async getCurrentCommit(): Promise<string | null> {
    try {
      const result = await this.git.revparse(['HEAD']);
      return result.trim();
    } catch (error) {
      console.error('Error getting current commit:', error);
      return null;
    }
  }

  /**
   * Get details for a single commit (header + files).
   */
  async getCommitDetails(hash: string): Promise<CommitInfo | null> {
    try {
      // Get header info
      const separator = '::::';
      const format = `%H${separator}%P${separator}%an${separator}%ae${separator}%ad${separator}%B${separator}%at`; // %B for full body
      const logResult = await this.git.show([hash, `--format=${format}`, '--no-patch']);

      const [fullHash, parents, author, email, date, message, timestamp] = logResult.trim().split(separator);

      // Get file stats
      const files = await this.getChangedFiles(hash);

      return {
        hash: fullHash,
        parents: parents ? parents.split(' ') : [],
        author: author,
        authorEmail: email,
        date: date,
        message: message ? message.trim() : '',
        timestamp: parseInt(timestamp, 10),
        files: files
      };
    } catch (error) {
      console.error(`Error fetching details for ${hash}:`, error);
      return null;
    }
  }

  /**
   * Get list of changed files for a specific commit.
   */
  async getChangedFiles(hash: string): Promise<{ status: string; path: string }[]> {
    try {
      // git show --name-status --format= <commit>
      const result = await this.git.show([hash, '--name-status', '--format=']);
      return result.split('\n')
        .filter(line => line.trim().length > 0)
        .map(line => {
          const [status, filePath] = line.split(/\t/);
          return {
            status: status || 'M',
            path: filePath || line
          };
        });
    } catch (error) {
      console.error('Error getting changed files:', error);
      return [];
    }
  }
}

/**
 * Create a GitUtils instance for the current workspace
 */
export async function createGitUtils(filePath: string): Promise<GitUtils | null> {
  const repoRoot = await GitUtils.getRepoRoot(filePath);
  if (!repoRoot) {
    vscode.window.showErrorMessage('This file is not in a Git repository.');
    return null;
  }

  const gitUtils = new GitUtils(repoRoot);
  const isRepo = await gitUtils.isGitRepository();

  if (!isRepo) {
    vscode.window.showErrorMessage('Git repository not found.');
    return null;
  }

  return gitUtils;
}
