import trash from "trash";
import os from "os";
import path from "path";
import fs from "fs";
import readline from "readline";
import { exec } from "child_process";
import { fileURLToPath } from "url";
import notifier from "node-notifier";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_FILE = "config.json";
const LOG_FILE = "movedToTrash.log";
const HISTORY_FILE = path.join(__dirname, "history.json");
const TASK_NAME = "CleanDownloads";

const DEFAULT_CONFIG = {
  folders: ["~/Downloads"],
  daysThreshold: 30,
  whitelist: [],
  blacklist: [],
  dryRun: false,
  interactive: false,
  notify: true,
};

let silentMode = false;

function log(message) {
  const timeStamp = new Date().toISOString();
  const logMessage = `${timeStamp}: ${message}\n`;
  fs.appendFileSync(LOG_FILE, logMessage);
  if (!silentMode) {
    console.log(message);
  }
}

function output(message) {
  if (!silentMode) {
    console.log(message);
  }
}

function expandPath(folderPath) {
  if (folderPath.startsWith("~/") || folderPath === "~") {
    return path.join(os.homedir(), folderPath.slice(2));
  }
  return folderPath;
}

function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
    output(`Created default ${CONFIG_FILE}`);
  }
  const configData = fs.readFileSync(CONFIG_FILE, "utf-8");
  return { ...DEFAULT_CONFIG, ...JSON.parse(configData) };
}

function loadHistory() {
  if (!fs.existsSync(HISTORY_FILE)) {
    return { runs: [] };
  }
  try {
    const data = fs.readFileSync(HISTORY_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return { runs: [] };
  }
}

function saveHistory(runStats) {
  const history = loadHistory();
  history.runs.push({
    timestamp: new Date().toISOString(),
    filesScanned: runStats.processed,
    filesDeleted: runStats.deleted,
    bytesReclaimed: runStats.bytes,
    errors: runStats.errors,
    folders: runStats.folders,
  });
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

function clearHistory() {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify({ runs: [] }, null, 2));
  console.log("History cleared.");
}

function showStats(clear = false) {
  if (clear) {
    clearHistory();
    return;
  }

  const history = loadHistory();

  if (history.runs.length === 0) {
    console.log("No cleanup history found.");
    return;
  }

  const totalRuns = history.runs.length;
  const totalFiles = history.runs.reduce((sum, r) => sum + r.filesDeleted, 0);
  const totalBytes = history.runs.reduce((sum, r) => sum + r.bytesReclaimed, 0);

  console.log("\n=== CleanDownloads History ===");
  console.log(`Total runs: ${totalRuns}`);
  console.log(`Total files deleted: ${totalFiles}`);
  console.log(`Total space reclaimed: ${formatBytes(totalBytes)}`);
  console.log("\nRecent runs:");

  const recentRuns = history.runs.slice(-10).reverse();
  for (const run of recentRuns) {
    const date = new Date(run.timestamp);
    const dateStr = date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    console.log(`  ${dateStr} - ${run.filesDeleted} files (${formatBytes(run.bytesReclaimed)})`);
  }
  console.log("");
}

function sendNotification(stats) {
  const title = "CleanDownloads Complete";
  const message = `Deleted ${stats.deleted} files\nReclaimed ${formatBytes(stats.bytes)}`;

  notifier.notify({
    title,
    message,
    sound: true,
    wait: false,
  });
}

function execPromise(command) {
  return new Promise((resolve, reject) => {
    exec(command, { shell: true }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
      } else {
        resolve(stdout);
      }
    });
  });
}

async function scheduleTask(frequency) {
  const scriptPath = __filename;
  const nodeExe = process.execPath;
  const command = `"${nodeExe}" "${scriptPath}" --silent --notify`;

  let scheduleArgs;
  switch (frequency) {
    case "daily":
      scheduleArgs = "/sc daily /st 10:00";
      break;
    case "weekly":
      scheduleArgs = "/sc weekly /d MON /st 10:00";
      break;
    case "startup":
      scheduleArgs = "/sc onlogon";
      break;
    default:
      console.log(`Invalid frequency: ${frequency}. Use daily, weekly, or startup.`);
      return;
  }

  const schtasksCmd = `schtasks /create /tn "${TASK_NAME}" /tr "${command}" ${scheduleArgs} /f`;

  try {
    await execPromise(schtasksCmd);
    console.log(`Scheduled task "${TASK_NAME}" created (${frequency}).`);
    console.log(`Task will run: ${command}`);
  } catch (error) {
    console.log(`Failed to create scheduled task: ${error.message}`);
    console.log("You may need to run this command as Administrator.");
  }
}

async function unscheduleTask() {
  const schtasksCmd = `schtasks /delete /tn "${TASK_NAME}" /f`;

  try {
    await execPromise(schtasksCmd);
    console.log(`Scheduled task "${TASK_NAME}" removed.`);
  } catch (error) {
    if (error.message.includes("cannot find")) {
      console.log(`No scheduled task named "${TASK_NAME}" found.`);
    } else {
      console.log(`Failed to remove scheduled task: ${error.message}`);
    }
  }
}

function parseArgs(config) {
  const args = process.argv.slice(2);
  const result = {
    ...config,
    folders: [...config.folders],
    schedule: null,
    unschedule: false,
    stats: false,
    clearStats: false,
    silent: false,
  };
  let customFolders = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help") {
      console.log(`
Usage: npm start -- [options]

Options:
  --folder <path>      Override folders (can be used multiple times)
  --days <number>      Override days threshold
  --dry-run            Preview without deleting
  --interactive        Prompt before each deletion
  --notify             Enable toast notification for this run
  --silent             Suppress console output (for scheduled runs)
  --schedule <freq>    Create scheduled task (daily|weekly|startup)
  --unschedule         Remove scheduled task
  --stats              Show cleanup history
  --stats --clear      Clear history
  --help               Show this help message

Configuration is loaded from config.json. CLI arguments override config values.
`);
      process.exit(0);
    } else if (arg === "--folder" && args[i + 1]) {
      customFolders.push(args[++i]);
    } else if (arg === "--days" && args[i + 1]) {
      result.daysThreshold = parseInt(args[++i], 10);
    } else if (arg === "--dry-run") {
      result.dryRun = true;
    } else if (arg === "--interactive") {
      result.interactive = true;
    } else if (arg === "--notify") {
      result.notify = true;
    } else if (arg === "--silent") {
      result.silent = true;
    } else if (arg === "--schedule" && args[i + 1]) {
      result.schedule = args[++i];
    } else if (arg === "--unschedule") {
      result.unschedule = true;
    } else if (arg === "--stats") {
      result.stats = true;
    } else if (arg === "--clear") {
      result.clearStats = true;
    }
  }

  if (customFolders.length > 0) {
    result.folders = customFolders;
  }

  return result;
}

function shouldProcessFile(filename, whitelist, blacklist) {
  const ext = path.extname(filename).toLowerCase();

  if (whitelist.length > 0) {
    return whitelist.map((e) => e.toLowerCase()).includes(ext);
  }

  if (blacklist.length > 0) {
    return !blacklist.map((e) => e.toLowerCase()).includes(ext);
  }

  return true;
}

function formatBytes(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

async function promptUser(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase().startsWith("y"));
    });
  });
}

(async () => {
  const config = parseArgs(loadConfig());

  if (config.silent) {
    silentMode = true;
  }

  if (config.schedule) {
    await scheduleTask(config.schedule);
    process.exit(0);
  }

  if (config.unschedule) {
    await unscheduleTask();
    process.exit(0);
  }

  if (config.stats) {
    showStats(config.clearStats);
    process.exit(0);
  }

  const { folders, daysThreshold, whitelist, blacklist, dryRun, interactive, notify } = config;

  const stats = { processed: 0, deleted: 0, skipped: 0, errors: 0, bytes: 0, folders: [] };

  if (dryRun) {
    output("=== DRY RUN MODE - No files will be deleted ===\n");
  }

  for (const folder of folders) {
    const folderPath = expandPath(folder);

    if (!fs.existsSync(folderPath)) {
      log(`Invalid folder path: ${folderPath}`);
      continue;
    }

    stats.folders.push(folderPath);
    output(`\nProcessing: ${folderPath}`);
    const folderFiles = fs.readdirSync(folderPath);

    for (const file of folderFiles) {
      const fileFullPath = path.join(folderPath, file);
      const fileStat = fs.statSync(fileFullPath);

      if (!fileStat.isFile()) continue;

      stats.processed++;

      if (!shouldProcessFile(file, whitelist, blacklist)) {
        continue;
      }

      const currentDate = new Date();
      const fileCreationDate = new Date(fileStat.birthtime);
      const daysDifference =
        (currentDate - fileCreationDate) / (1000 * 60 * 60 * 24);

      if (daysDifference < daysThreshold) continue;

      const fileSize = fileStat.size;
      const daysOld = Math.floor(daysDifference);

      if (dryRun) {
        output(
          `[DRY RUN] Would delete: ${file} (${formatBytes(fileSize)}, ${daysOld} days old)`
        );
        stats.deleted++;
        stats.bytes += fileSize;
        continue;
      }

      if (interactive) {
        const confirm = await promptUser(
          `Delete "${file}" (${formatBytes(fileSize)}, ${daysOld} days old)? [y/N]: `
        );
        if (!confirm) {
          stats.skipped++;
          continue;
        }
      }

      try {
        await trash(fileFullPath);
        log(`${file} moved to Recycle Bin`);
        stats.deleted++;
        stats.bytes += fileSize;
      } catch (error) {
        log(`${file} failed to move to Recycle Bin: ${error.message}`);
        stats.errors++;
      }
    }
  }

  output("\n=== Summary ===");
  output(`Files scanned: ${stats.processed}`);
  output(`Files ${dryRun ? "would be " : ""}deleted: ${stats.deleted}`);
  output(`Space ${dryRun ? "would be " : ""}reclaimed: ${formatBytes(stats.bytes)}`);
  if (stats.skipped > 0) output(`Files skipped: ${stats.skipped}`);
  if (stats.errors > 0) output(`Errors: ${stats.errors}`);

  if (!dryRun && stats.deleted > 0) {
    saveHistory(stats);
  }

  if (notify && stats.deleted > 0) {
    sendNotification(stats);
  }
})();
