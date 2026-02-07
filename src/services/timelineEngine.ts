export class TimelineEngine {
    private history: string[] = []; // List of commit hashes (sorted new -> old)
    private currentIndex: number = 0;

    constructor() { }

    /**
     * Initialize the timeline with a list of commit hashes.
     * @param hashes Array of commit hashes, typically from GitService.getCommitGraph()
     */
    init(hashes: string[]) {
        this.history = hashes;
        this.currentIndex = 0;
    }

    get count(): number {
        return this.history.length;
    }

    get currentHash(): string | null {
        if (this.history.length === 0) return null;
        return this.history[this.currentIndex];
    }

    get canGoNext(): boolean {
        // "Next" in time means going to a newer commit (lower index)
        return this.currentIndex > 0;
    }

    get canGoPrev(): boolean {
        // "Prev" in time means going to an older commit (higher index)
        return this.currentIndex < this.history.length - 1;
    }

    next(): string | null {
        if (this.canGoNext) {
            this.currentIndex--;
            return this.currentHash;
        }
        return null;
    }

    prev(): string | null {
        if (this.canGoPrev) {
            this.currentIndex++;
            return this.currentHash;
        }
        return null;
    }

    jumpTo(hash: string): boolean {
        const index = this.history.indexOf(hash);
        if (index !== -1) {
            this.currentIndex = index;
            return true;
        }
        return false;
    }
}
