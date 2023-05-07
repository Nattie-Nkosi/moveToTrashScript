# Move Old Files to Recycle Bin

This script helps you automatically move files older than a specified number of days from a specific folder (e.g., Downloads) to the Recycle Bin.

## Features

- Automatically move files older than a specified number of days (default: 30 days) to the Recycle Bin.
- Log the actions performed by the script, including successfully moved files and any errors.
- Customizable folder to check and days threshold.

## Requirements

- Node.js v14.0 or later
- `trash` package

## Setup

1. Install Node.js.
2. Install the `trash` package by running:

```bash
  npm install trash
```

3. Replace the `folderToCheck` and `daysThreshold` variables in the script to customize the folder to be checked and the number of days threshold.

```js
const folderToCheck = path.join(os.homedir(), "Downloads"); // Change this to the folder you want to check
const daysThreshold = 30; // Change this to the number of days threshold
```

4. Run the script with:

```bash
 node index.js
```

## How it Works

The script checks the specified folder for files older than the specified number of days. If it finds any files that meet the criteria, it moves them to the Recycle Bin. The script logs all actions, such as successfully moved files and any errors, to a file named `movedToTrash.txt`.

## Customization

You can further customize the script by modifying the following variables:

- `folderToCheck`: The path of the folder you want to check for old files. By default, it is set to the Downloads folder.
- `daysThreshold`: The number of days after which a file is considered old and moved to the Recycle Bin. By default, it is set to 30 days.

## Note

Please use this script with caution, as moving files to the Recycle Bin is a potentially destructive action. It is recommended to test the script on a non-critical folder first to ensure it works as expected.
