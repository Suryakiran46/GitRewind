"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimelineEngine = void 0;
class TimelineEngine {
    constructor() {
        this.history = []; // List of commit hashes (sorted new -> old)
        this.currentIndex = 0;
    }
    /**
     * Initialize the timeline with a list of commit hashes.
     * @param hashes Array of commit hashes, typically from GitService.getCommitGraph()
     */
    init(hashes) {
        this.history = hashes;
        this.currentIndex = 0;
    }
    get count() {
        return this.history.length;
    }
    get currentHash() {
        if (this.history.length === 0)
            return null;
        return this.history[this.currentIndex];
    }
    get canGoNext() {
        // "Next" in time means going to a newer commit (lower index)
        return this.currentIndex > 0;
    }
    get canGoPrev() {
        // "Prev" in time means going to an older commit (higher index)
        return this.currentIndex < this.history.length - 1;
    }
    next() {
        if (this.canGoNext) {
            this.currentIndex--;
            return this.currentHash;
        }
        return null;
    }
    prev() {
        if (this.canGoPrev) {
            this.currentIndex++;
            return this.currentHash;
        }
        return null;
    }
    jumpTo(hash) {
        const index = this.history.indexOf(hash);
        if (index !== -1) {
            this.currentIndex = index;
            return true;
        }
        return false;
    }
}
exports.TimelineEngine = TimelineEngine;
//# sourceMappingURL=timelineEngine.js.map