import { exec } from "child_process";
import path from "path";
import fs from "fs";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import mime from "mime-types";
import { limitFunction } from "p-limit";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import Redis from "ioredis";

dotenv.config();

const PROJECT_ID = process.env.PROJECT_ID;
const BUILD_DIR = "dist";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publisher = new Redis(process.env.REDIS_URL);

const s3Client = new S3Client({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  region: process.env.AWS_REGION,
});

const limitedUploadFunction = limitFunction(
  async(file) => {
    return uploadFile(file);
  },
  { concurrency: 3 }
);

async function publishLog(log) {
  try {
    await publisher.publish(`logs_${PROJECT_ID}`, JSON.stringify({ log }));
    console.log("Log published successfully:", log);
  } catch (error) {
    console.error("Failed to publish log:", error.message);
  }
}

function getAllFiles(_path) {
  try {
    let arrayOfFilePaths = [];
    const pathFolderContent = fs.readdirSync(_path, { recursive: true });

    for (const file of pathFolderContent) {
      const filePath = path.join(_path, file);
      if (fs.lstatSync(filePath).isDirectory()) {
        const returnedFilePaths = getAllFiles(filePath);
        arrayOfFilePaths = [...returnedFilePaths, ...arrayOfFilePaths];
      } else {
        arrayOfFilePaths.push(filePath);
      }
    }

    return arrayOfFilePaths;
  } catch (error) {
    return error;
  }
}

async function uploadFile(file) {
  try {
    const relativePath = file.split(`/${BUILD_DIR}/`)[1] || file;

    const command = new PutObjectCommand({
      Bucket: "vercel-main",
      Key: `__outputs/${PROJECT_ID}/${relativePath}`,
      Body: fs.createReadStream(file),
      ContentType: mime.lookup(file),
    });

    await s3Client.send(command);
    console.log("uploaded: ", file);
    publishLog(`uploaded: ${file}`);
  } catch (error) {
    publishLog(`upload error ${error.message}`);
    throw error;
  }
}

async function main() {
  console.log("Executing script");
  publishLog("Executing script");
  const outputDirPath = path.join(__dirname, "output");
  const process = exec(`cd ${outputDirPath} && npm install && npm run build`);

  // const process = exec(
  //   `cd ${outputDirPath}`
  // );

  process.stdout.on("data", (logs) => {
    console.log(logs.toString());
    publishLog(logs.toString());
  });
  process.stderr.on("data", (data) => {
    console.error("Error", data.toString());
    publishLog(data.toString());
  });
  process.on("error", (error) => {
    console.error("Execution Error:", error.message);
    publishLog(error.message);
  });

  process.on("close", async () => {
    console.log("Build Complete");
    publishLog("Build Complete");
    const distFolderPath = path.join(outputDirPath, BUILD_DIR);

    const files = getAllFiles(distFolderPath);
    if (files instanceof Error) {
      throw new Error(files.message);
    }

    const s3FileSendPromises = [];
    for (const file of files) {
      s3FileSendPromises.push(limitedUploadFunction(file));
    }

    await Promise.allSettled(s3FileSendPromises);

    console.log("All files uploaded Successfully: ", PROJECT_ID);
    publishLog(`All files uploaded Successfully: , ${PROJECT_ID}`);

    publisher.disconnect();
  });
}

main();
