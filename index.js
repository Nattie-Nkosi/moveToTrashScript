import trash from "trash";
import os from "os";
import path from "path";
import fs from "fs";

const folderToCheck = path.join(os.homedir(), "Downloads");
const daysThreshold = 30; // You can enter your prefered days

const logFile = "movedToTrash.txt";

function log(message) {
  const timeStamp = new Date().toISOString();
  const logMessage = `${timeStamp}: ${message}`;
  fs.appendFileSync(logFile, logMessage);
  console.log(message);
}

(async () => {
  if (fs.existsSync(folderToCheck)) {
    const folderFiles = fs.readdirSync(folderToCheck);

    for (const file of folderFiles) {
      const fileFullPath = path.join(folderToCheck, file);

      if (fs.statSync(fileFullPath).isFile()) {
        const currentDate = new Date();
        const fileCreationDate = new Date(fs.statSync(fileFullPath).birthtime);
        const daysDifference =
          (currentDate - fileCreationDate) / (1000 * 60 * 60 * 24);

        if (daysDifference >= daysThreshold) {
          try {
            await trash(fileFullPath);
            log(`${file} moved to Recycle Bin`);
          } catch (error) {
            log(`${file} failed to move to Recycle Bin`);
          }
        }
      }
    }
  } else {
    log("Invalid folder path");
  }
})();
