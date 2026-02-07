import { simpleGit, SimpleGit, LogResult, DefaultLogFields } from 'simple-git';
import * as path from 'path';
import { CommitInfo, GitGraphNode } from './types';

export class GitService {
    private git: SimpleGit;
    private workspaceRoot: string;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.git = simpleGit(workspaceRoot);
    }

    /**
     * static factory to initialize with a file path, finding the repo root.
     */
    static async create(startPath: string): Promise<GitService | null> {
        try {
            // If startPath is a file, use its directory. If it's a directory, use it directly.
            // However, to be safe, we can try both or relies on simple-git's resolution.
            // Simple-git init expects a directory. 

            let targetDir = startPath;
            // Basic check if it looks like a file (has extension), though not perfect.
            // Better to rely on VS Code's knowledge if possible, but here we just have a string.
            // Let's assume if it has an extension it's a file, or we can try to stat it if we imported fs.
            // For now, let's just use the logic: "git rev-parse --show-toplevel" works from within a subdir too.

            // If startPath is "C:\Projects\Repo\file.ts", dirname is "C:\Projects\Repo".
            // If startPath is "C:\Projects\Repo", dirname is "C:\Projects". This is BAD if we are at root.

            // FIX: We should attempt to use startPath directly if it is a directory. 
            // Since we can't easily check if it's a file vs dir without fs, let's use a try-catch approach
            // or just assume simple-git handles it if we pass the right thing.

            // Actually, we can use 'path.parse' or just try to initialize simple-git on startPath.
            // If startPath is a file, simple-git(startPath) might fail or work depending on implementation.

            // SAFEST APPROACH:
            // 1. Try to initialize in startPath.
            // 2. Check isRepo.
            // 3. If that fails, try dirname(startPath).

            let git = simpleGit(startPath);
            let isRepo = false;
            try {
                isRepo = await git.checkIsRepo();
            } catch (e) {
                // simple-git might throw if startPath is a file
            }

            if (!isRepo) {
                // Try parent dir (assuming startPath was a file)
                const parent = path.dirname(startPath);
                if (parent !== startPath) {
                    git = simpleGit(parent);
                    isRepo = await git.checkIsRepo();
                }
            }

            if (!isRepo) return null;

            const root = await git.revparse(['--show-toplevel']);
            return new GitService(root.trim());
        } catch (e) {
            console.error('Failed to create GitService:', e);
            return null;
        }
    }

    getWorkspaceRoot(): string {
        return this.workspaceRoot;
    }

    /**
     * Get the commit graph for the repository.
     * This is the raw topological data needed for the visualization.
     */
    async getCommitGraph(limit: number = 50): Promise<GitGraphNode[]> {
        try {
            // Use a custom separator for parsing. '::::' is unlikely to appear in commit messages.
            const separator = '::::';
            // %H: hash, %P: parent hashes, %an: author, %ae: email, %ad: date, %s: message, %D: refs/branches, %at: timestamp
            const format = `%H${separator}%P${separator}%an${separator}%ae${separator}%ad${separator}%s${separator}%D${separator}%at`;

            // Use .raw to bypass simple-git's option parsing which was causing "unrecognized argument: --format" errors
            const result = await this.git.raw([
                'log',
                `--max-count=${limit}`,
                `--format=${format}`
            ]);

            return result.split('\n')
                .filter(line => line.trim().length > 0)
                .map(line => {
                    const parts = line.split(separator);
                    if (parts.length < 8) return null; // Skip malformed lines

                    const [hash, parents, author, email, date, message, refs, timestamp] = parts;

                    return {
                        hash: hash,
                        parents: parents ? parents.split(' ').filter(p => p.length > 0) : [],
                        author: author,
                        email: email,
                        date: date,
                        message: message,
                        branch: this.parseBranchName(refs),
                        timestamp: parseInt(timestamp, 10)
                    };
                })
                .filter(node => node !== null) as GitGraphNode[];

        } catch (error) {
            console.error('Error fetching commit graph:', error);
            return [];
        }
    }

    /**
     * Get history for a specific file (File Scope)
     */
    async getFileHistory(filePath: string, limit: number = 20): Promise<CommitInfo[]> {
        let relativePath = filePath;
        if (path.isAbsolute(filePath)) {
            relativePath = path.relative(this.workspaceRoot, filePath);
        }
        const normalizedPath = relativePath.split(path.sep).join('/');

        try {
            const log = await this.git.log({
                file: normalizedPath,
                maxCount: limit,
                format: {
                    hash: '%H',
                    parents: '%P',
                    author: '%an',
                    email: '%ae',
                    date: '%ad',
                    message: '%s',
                    timestamp: '%at'
                }
            } as any);

            return log.all.map((commit: any) => ({
                hash: commit.hash,
                parents: commit.parents ? commit.parents.split(' ') : [],
                author: commit.author,
                email: commit.email,
                date: commit.date,
                message: commit.message,
                timestamp: parseInt(commit.timestamp, 10)
            }));
        } catch (error) {
            console.error(`Error fetching history for ${filePath}:`, error);
            return [];
        }
    }

    /**
     * Get the content of a file at a specific commit.
     */
    async getFileAtCommit(filePath: string, commitHash: string): Promise<string> {
        try {
            let relativePath = filePath;
            if (path.isAbsolute(filePath)) {
                relativePath = path.relative(this.workspaceRoot, filePath);
            }
            // git show <commit>:<path> - Git requires forward slashes even on Windows
            const normalizedPath = relativePath.split(path.sep).join('/');
            return await this.git.show([`${commitHash}:${normalizedPath}`]);
        } catch (error) {
            console.error(`Error fetching file ${filePath} at ${commitHash}:`, error);
            return ''; // Return empty string if deleted or not found
        }
    }

    /**
     * Get raw diff between two commits for a file.
     */
    async getDiff(filePath: string, hashA: string, hashB: string): Promise<string> {
        let relativePath = filePath;
        if (path.isAbsolute(filePath)) {
            relativePath = path.relative(this.workspaceRoot, filePath);
        }
        const normalizedPath = relativePath.split(path.sep).join('/');
        try {
            return await this.git.diff([hashA, hashB, '--', normalizedPath]);
        } catch (error) {
            console.error('Error getting diff:', error);
            return '';
        }
    }

    /**
     * Get list of changed files for a specific commit.
     */
    async getChangedFiles(hash: string): Promise<{ status: string; path: string }[]> {
        try {
            // git show --name-status --format= <commit>
            // Passing arguments as separate array items avoids parsing ambiguity
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

    /**
     * Get the file tree of a specific commit.
     */
    async getTree(hash: string): Promise<string[]> {
        try {
            // git ls-tree -r --name-only <commit>
            const result = await this.git.raw(['ls-tree', '-r', '--name-only', hash]);
            return result.split('\n').filter(line => line.trim().length > 0);
        } catch (error) {
            console.error(`Error fetching tree for ${hash}:`, error);
            return [];
        }
    }

    private parseBranchName(refs: string): string | undefined {
        if (!refs) return undefined;
        // refs example: "HEAD -> master, origin/master"
        const matches = refs.match(/HEAD -> ([^,]+)/);
        if (matches && matches[1]) return matches[1];

        const branchMatch = refs.split(',').find(r => !r.includes('tag:') && !r.includes('HEAD'));
        return branchMatch ? branchMatch.trim() : undefined;
    }

    /**
     * Revert a specific commit.
     */
    async revert(hash: string): Promise<void> {
        try {
            await this.git.revert(hash);
        } catch (error) {
            throw new Error(`Failed to revert commit ${hash}: ${error}`);
        }
    }

    /**
     * Checkout a specific commit (detached HEAD).
     */
    async checkout(hash: string): Promise<void> {
        try {
            await this.git.checkout(hash);
        } catch (error) {
            throw new Error(`Failed to checkout commit ${hash}: ${error}`);
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
                email: email,
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
}
