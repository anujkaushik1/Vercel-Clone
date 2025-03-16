const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const { PutObjectCommand, S3Client, S3Client } = require("@aws-sdk/client-s3");
const mime = require("mime-types");

const s3Client = new S3Client({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  region: process.env.AWS_REGION,
});

const PROJECT_ID = process.env.PROJECT_ID;

async function main() {
  console.log("Executing script");
  const outputDirPath = path.join(__dirname, "output");
  const process = exec(`cd ${outputDirPath} && npm install && npm run build`);

  process.stdout.on("data", (logs) => console.log(logs.toString()));
  process.stderr.on("data", (data) => console.error("Error:", data.toString()));
  process.on("error", (error) =>
    console.error("Execution Error:", error.message)
  );

  process.on("close", async () => {
    console.log("Build Complete");
    const distFolderPath = path.join(outputDirPath, "dist");
    const distFolderContents = fs.readdirSync(distFolderPath, {
      recursive: true,
    });

    const s3FileSendPromises = [];
    for (const filePath of distFolderContents) {
      if (fs.lstatSync(filePath).isDirectory()) continue;

      const command = new PutObjectCommand({
        Bucket: "vercel-main",
        Key: `__outputs/${PROJECT_ID}`,
        Body: fs.createReadStream(filePath),
        ContentType: mime.lookup(path),
      });

      s3FileSendPromises.push(s3Client.send(command));
    }

    (await Promise.allSettled()).forEach((promise) =>
      promise.status == "rejected"
        ? console.log("File Uploading Failed: ", promise.reason)
        : console.log("File Uploaded Successfully")
    );
  });
}

main();
