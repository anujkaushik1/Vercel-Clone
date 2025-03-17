const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const { PutObjectCommand, S3Client } = require("@aws-sdk/client-s3");
const mime = require("mime-types");

require("dotenv").config();

const s3Client = new S3Client({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  region: process.env.AWS_REGION,
});

const PROJECT_ID = process.env.PROJECT_ID;

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
    const relativePath = file.split("/build/")[1] || file;

    const command = new PutObjectCommand({
      Bucket: "vercel-main",
      Key: `__outputs/${PROJECT_ID}/${relativePath}`,
      Body: fs.createReadStream(file),
      ContentType: mime.lookup(file),
    });

    await s3Client.send(command);
    console.log("completed");
  } catch (error) {
    console.log("error: ", error);

    throw error;
  }
}

async function main() {
  console.log("Executing script");
  const outputDirPath = path.join(__dirname, "output");
  const process = exec(
    `cd ${outputDirPath} && npm install --legacy-peer-deps  && npm run build`
  );

  process.stdout.on("data", (logs) => console.log(logs.toString()));
  process.stderr.on("data", (data) => console.error("Error:", data.toString()));
  process.on("error", (error) =>
    console.error("Execution Error:", error.message)
  );

  process.on("close", async () => {
    console.log("Build Complete");
    const distFolderPath = path.join(outputDirPath, "build");

    const files = getAllFiles(distFolderPath);
    if (files instanceof Error) {
      throw new Error(files.message);
    }

    const s3FileSendPromises = [];
    for (const file of files) {
      s3FileSendPromises.push(uploadFile(file));
    }

    await Promise.allSettled(s3FileSendPromises);
  });
}

main();
