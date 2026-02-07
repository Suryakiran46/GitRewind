import * as vscode from "vscode";
import { TimelineProvider } from "./sidebar";

export function activate(context: vscode.ExtensionContext) {

    const timelineProvider = new TimelineProvider();

    vscode.window.registerTreeDataProvider(
        "repoRewindTimeline",
        timelineProvider
    );

    const clickCommand = vscode.commands.registerCommand(
        "repoRewind.itemClicked",
        (label: string) => {
            vscode.window.showInformationMessage(
                `You clicked: ${label}`
            );
        }
    );

    const openGraphCommand = vscode.commands.registerCommand(
    "repoRewind.openGraph",
    (label?: string) => {

        const panel = vscode.window.createWebviewPanel(
            "repoRewindGraph",
            "Git Timeline Graph",
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        panel.webview.onDidReceiveMessage(message => {
            if (message.type === "commitClicked") {
                vscode.window.showInformationMessage(
                    `Commit clicked: ${message.hash}`
                );
            }
        });

        panel.webview.html = getGraphHtml(label ?? "All Commits");
    }
);


    context.subscriptions.push(clickCommand, openGraphCommand);
}

export function deactivate() {}

function getGraphHtml(title: string): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8" />
        <style>
            body {
                background: #1e1e1e;
                color: #ddd;
                font-family: sans-serif;
            }

            .commit {
                fill: #4CAF50;
                cursor: pointer;
            }

            .commit:hover {
                stroke: white;
                stroke-width: 2;
            }
        </style>
    </head>
    <body>
        <h2>${title}</h2>

        <svg width="500" height="300">
            <circle class="commit" cx="100" cy="60" r="6" data-hash="a1b2c3"/>
            <circle class="commit" cx="100" cy="120" r="6" data-hash="d4e5f6"/>
            <circle class="commit" cx="100" cy="180" r="6" data-hash="g7h8i9"/>
        </svg>

        <script>
            const vscode = acquireVsCodeApi();

            document.querySelectorAll(".commit").forEach(circle => {
                circle.addEventListener("click", () => {
                    const hash = circle.getAttribute("data-hash");

                    vscode.postMessage({
                        type: "commitClicked",
                        hash: hash
                    });
                });
            });
        </script>
    </body>
    </html>
    `;
}

