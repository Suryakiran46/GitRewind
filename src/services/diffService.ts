import * as Diff from 'diff';
import { Snapshot } from './snapshotService';

export interface DiffResult {
    rawDiff: string;
    addedLines: number[];
    removedLines: number[];
    modifiedLines: number[];
    changes: Diff.Change[];
}

export class DiffService {

    /**
     * Compare two text snapshots and return a structured diff.
     */
    compare(oldContent: string, newContent: string): DiffResult {
        const changes = Diff.diffLines(oldContent, newContent);

        const addedLines: number[] = [];
        const removedLines: number[] = [];
        const modifiedLines: number[] = [];

        let currentLine = 1;

        // Basic line tracking (simplistic, can be enhanced)
        changes.forEach(part => {
            // Logic to populate line numbers would go here
            // For now we expose the raw changes from the diff library
        });

        // Use createTwoFilesPatch for the raw unified diff string
        const patch = Diff.createTwoFilesPatch('Old', 'New', oldContent, newContent);

        return {
            rawDiff: patch,
            addedLines,
            removedLines,
            modifiedLines,
            changes
        };
    }
}
