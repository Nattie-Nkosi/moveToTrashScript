# CleanDownloads

Automatically move old files from your Downloads folder (or any folder) to the Recycle Bin. Supports scheduling, notifications, and cleanup history tracking.

## Features

- Move files older than a configurable threshold to the Recycle Bin
- Multiple folder support with whitelist/blacklist filtering
- Dry-run mode to preview changes
- Interactive mode for per-file confirmation
- Windows toast notifications
- Automatic scheduling (startup, daily, weekly)
- Cleanup history and statistics tracking

## Requirements

- Node.js v14.0 or later
- Windows (for notifications and scheduling features)

## Installation

```bash
npm install
```

## Usage

```bash
# Run cleanup with default settings
npm start

# Preview what would be deleted (no actual deletion)
npm start -- --dry-run

# Run with notification
npm start -- --notify

# Run interactively (confirm each file)
npm start -- --interactive

# Override settings via CLI
npm start -- --folder "C:\Users\Me\Desktop" --days 7
```

## CLI Options

| Option | Description |
|--------|-------------|
| `--folder <path>` | Override folders (can use multiple times) |
| `--days <number>` | Override days threshold |
| `--dry-run` | Preview without deleting |
| `--interactive` | Prompt before each deletion |
| `--notify` | Show Windows toast notification |
| `--silent` | Suppress console output |
| `--schedule <freq>` | Create scheduled task (daily/weekly/startup) |
| `--unschedule` | Remove scheduled task |
| `--stats` | Show cleanup history |
| `--stats --clear` | Clear history |
| `--help` | Show help message |

## Configuration

Settings are stored in `config.json`:

```json
{
  "folders": ["~/Downloads"],
  "daysThreshold": 30,
  "whitelist": [],
  "blacklist": [],
  "dryRun": false,
  "interactive": false,
  "notify": true
}
```

| Setting | Description |
|---------|-------------|
| `folders` | Array of folders to clean (supports `~` for home directory) |
| `daysThreshold` | Files older than this many days are deleted |
| `whitelist` | Only delete files with these extensions (e.g., `[".tmp", ".log"]`) |
| `blacklist` | Never delete files with these extensions |
| `dryRun` | If true, preview mode by default |
| `interactive` | If true, prompt for each file by default |
| `notify` | If true, show notification after cleanup |

## Scheduling

### Option 1: Windows Startup Folder (Recommended)

Create a batch file at:
```
%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\CleanDownloads.bat
```

With contents:
```batch
@echo off
cd /d "C:\path\to\cleanDownloads"
node index.js --silent --notify
```

### Option 2: Task Scheduler (Requires Admin)

```bash
# Run as Administrator
npm start -- --schedule startup   # Run on login
npm start -- --schedule daily     # Run daily at 10:00 AM
npm start -- --schedule weekly    # Run weekly on Monday

# Remove scheduled task
npm start -- --unschedule
```

## History & Stats

Cleanup history is saved to `history.json`. View statistics with:

```bash
npm start -- --stats
```

Output:
```
=== CleanDownloads History ===
Total runs: 15
Total files deleted: 423
Total space reclaimed: 12.5 GB

Recent runs:
  1/20/2026 10:30 AM - 45 files (1.2 GB)
  1/19/2026 10:30 AM - 38 files (890 MB)
  ...
```

Clear history:
```bash
npm start -- --stats --clear
```

## Files

| File | Purpose |
|------|---------|
| `index.js` | Main script |
| `config.json` | Configuration settings |
| `history.json` | Cleanup run history (auto-created) |
| `movedToTrash.log` | Detailed log of deleted files |

## Note

Files are moved to the Recycle Bin, not permanently deleted. You can restore them if needed. Always test with `--dry-run` first.
