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
exports.DiffService = void 0;
const Diff = __importStar(require("diff"));
class DiffService {
    /**
     * Compare two text snapshots and return a structured diff.
     */
    compare(oldContent, newContent) {
        const changes = Diff.diffLines(oldContent, newContent);
        const addedLines = [];
        const removedLines = [];
        const modifiedLines = [];
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
exports.DiffService = DiffService;
//# sourceMappingURL=diffService.js.map