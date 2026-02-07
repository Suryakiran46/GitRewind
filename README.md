# 🕰️ GitRewind

Visualize your Git repository's history with an interactive timeline. See all commits at a glance, explore file changes across commits, and understand how your code evolved over time.

## ✨ Features

- **Repository Graph Visualization**: Beautiful commit timeline showing your repository's Git history
- **Click to Explore**: Click any commit to view its details and affected files
- **File Change Browser**: Browse and open files at specific commits with one click
- **Diff Viewer**: View side-by-side diffs to see exactly what changed between commits
- **Multi-language Support**: Works with JavaScript, TypeScript, Python, Java, C#, Go, and Rust
- **Sidebar Integration**: Quick access button in the VS Code activity bar
- **File History**: Track how individual files changed across commits

## 🚀 Quick Start

### Using the Sidebar Button
1. Click the **GitRewind icon** (⏱️) in the VS Code activity bar (left sidebar)
2. Click **"Open Repository Graph"** button
3. Explore your repository's commit history

### Using the Command Palette
1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS)
2. Type "GitRewind: Show Repository Graph"
3. Press Enter

### Interact with Commits
- **Click a commit node** to view commit details and changed files
- **Browse files** at that commit by clicking file names
- **Open diffs** to see what changed in a file
- **Copy commit hash** with the copy button
- **Checkout commits** or revert them (requires git permissions)

## 🎯 How It Works

### Repository Graph
- Displays your last 300 commits in an interactive timeline
- Shows commit authors, dates, and messages
- Visualizes branch structure

### Commit Details
- View all files changed in a commit
- See file change status (Added, Modified, Deleted)
- Browse file contents at that commit version

### File Diffs
- Side-by-side comparison showing what changed
- Syntax highlighting for code
- Easy navigation between changed files

## 📋 Requirements

- VS Code 1.74.0 or higher
- Git repository (local or remote)
- Git must be installed and accessible from command line

## 🔧 Development Setup

```bash
# Clone or navigate to the extension directory
cd GitRewind

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Open in VS Code for development
code .

# Start watching for changes
npm run watch
```

### Testing the Extension

1. Press **F5** or click **Run > Start Debugging** to open Extension Development Host
2. Open a Git repository folder
3. Click the GitRewind icon in the activity bar
4. Explore the commit history

## 📁 Project Structure

```
GitRewind/
├── src/
│   ├── extension.ts                    # Main extension entry point
│   ├── diffUtils.ts                    # Diff generation and HTML formatting
│   ├── parser.ts                       # Code parsing for function extraction
│   ├── languagePatterns.ts             # Regex patterns for multi-language support
│   ├── services/
│   │   ├── gitService.ts               # Git operations (commits, files, diffs)
│   │   ├── graphEngine.ts              # Graph visualization engine
│   │   ├── types.ts                    # TypeScript type definitions
│   │   ├── scopeResolver.ts            # Scope resolution for code analysis
│   │   ├── snapshotService.ts          # Commit snapshot handling
│   │   ├── timelineEngine.ts           # Timeline data processing
│   │   └── gitFileSystemProvider.ts    # Virtual file system for git content
│   └── webview/
│       ├── panel.ts                    # File history webview panel
│       ├── timelinePanel.ts            # Commit graph visualization panel
│       └── commitDetailsPanel.ts       # Commit details panel
├── images/
│   └── icon.png                        # Extension icon
├── package.json                        # Extension manifest and configuration
├── tsconfig.json                       # TypeScript configuration
└── README.md                           # This file
```

## 🎨 Supported Languages

- **JavaScript** (.js, .jsx)
- **TypeScript** (.ts, .tsx)
- **Python** (.py)
- **Java** (.java)
- **C#** (.cs)
- **Go** (.go)
- **Rust** (.rs)
- **And more** via fallback regex patterns

## 🔑 Key Commands

| Command | Description |
|---------|-------------|
| `GitRewind.showHistory` | Show the repository graph |
| `GitRewind.showCommitDetails` | Show commit details panel |
| `GitRewind.browseCommit` | Browse files at commit |
| `GitRewind.openFileAtCommit` | Open file at specific commit |
| `GitRewind.copyHash` | Copy commit hash |
| `GitRewind.checkoutCommit` | Checkout to commit |
| `GitRewind.revertCommit` | Revert a commit |

## 💡 Tips

- **Large repositories**: The extension loads the last 300 commits by default for performance
- **First time setup**: Make sure your Git repository is properly initialized (`git init`)
- **File viewing**: You can view any file in any commit without checking out
- **Diffs**: Diffs show changes from the parent commit

## 🐛 Troubleshooting

**"Git repository not found"**
- Make sure you have a folder open that contains a `.git` directory
- Run `git init` in your project folder if needed

**"Cannot find commits"**
- Ensure your repository has at least one commit
- Check that your Git is properly configured

**Graphs not displaying**
- Reload the VS Code window (Ctrl+Shift+P → "Developer: Reload Window")
- Check browser console for errors (Help → Toggle Developer Tools)

## 📦 Dependencies

- **simple-git**: Git operations wrapper
- **@babel/parser**: JavaScript/TypeScript AST parsing
- **diff**: Text diffing library
- **highlight.js**: Syntax highlighting for code

## 📄 License

MIT

## 🙏 Acknowledgments

Built with:
- [VS Code Extension API](https://code.visualstudio.com/api)
- [simple-git](https://github.com/steveukx/git-js)
- [Babel Parser](https://babeljs.io/)
- [diff library](https://github.com/kpdecker/jsdiff)
- [highlight.js](https://highlightjs.org/)
