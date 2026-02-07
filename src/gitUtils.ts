import { simpleGit, SimpleGit, LogResult } from 'simple-git';
import * as vscode from 'vscode';
import * as path from 'path';

export interface CommitInfo {
  hash: string;
  date: string;
  message: string;
  author: string;
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
      const relativePath = path.relative(this.workspaceRoot, filePath);
      
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
      const relativePath = path.relative(this.workspaceRoot, filePath);
      const content = await this.git.show([`${commitHash}:${relativePath}`]);
      return content;
    } catch (error) {
      console.error(`Error getting file at commit ${commitHash}:`, error);
      return null;
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
