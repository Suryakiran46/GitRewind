import * as vscode from "vscode";

/**
 * A single item in the sidebar
 */
export class TimelineItem extends vscode.TreeItem {
    constructor(label: string) {
        super(label);

        this.tooltip = label;
        this.command = {
            command: "repoRewind.itemClicked",
            title: "Item Clicked",
            arguments: [label]
        };
    }
}


/**
 * Provides data to the sidebar TreeView
 */
export class TimelineProvider implements vscode.TreeDataProvider<TimelineItem> {

    getTreeItem(element: TimelineItem): vscode.TreeItem {
        return element;
    }

    getChildren(): TimelineItem[] {
        return [
            new TimelineItem("Placeholder commit 1"),
            new TimelineItem("Placeholder commit 2"),
            new TimelineItem("Placeholder commit 3"),
        ];
    }
}
