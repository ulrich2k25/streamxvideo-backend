import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import AWS from 'aws-sdk';
import dotenv from 'dotenv';

dotenv.config();

// Configuration AWS
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const videosFolder = "C:/Users/pouke/Desktop/New_Projekt";
const thumbnailsFolder = path.join(videosFolder, 'thumbnails');

if (!fs.existsSync(thumbnailsFolder)) {
  fs.mkdirSync(thumbnailsFolder, { recursive: true });
}

fs.readdir(videosFolder, (err, files) => {
  if (err) return console.error('Erreur en lisant le dossier vidéos:', err);

  files.forEach((file) => {
    const ext = path.extname(file).toLowerCase();
    if (!['.mp4', '.mov', '.avi', '.mkv'].includes(ext)) return;

    const inputPath = path.join(videosFolder, file);
    const baseName = path.parse(file).name;
    const thumbnailPath = path.join(thumbnailsFolder, `${baseName}.jpg`);

    ffmpeg(inputPath)
      .screenshots({
        timestamps: ['5'],
        filename: `${baseName}.jpg`,
        folder: thumbnailsFolder,
        size: '320x240',
      })
      .on('end', () => {
        console.log(`Miniature générée: ${thumbnailPath}`);

        // Upload vers S3
        fs.readFile(thumbnailPath, (err, data) => {
          if (err) return console.error('Erreur lecture miniature:', err);

          const params = {
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: `thumbnails/${baseName}.jpg`,
            Body: data,
            ContentType: 'image/jpeg',
            ACL: 'public-read',
          };

          s3.upload(params, (err, result) => {
            if (err) return console.error('Erreur upload S3:', err);
            console.log(`✅ Uploadé sur S3: ${result.Location}`);
          });
        });
      })
      .on('error', (err) => {
        console.error(`Erreur génération miniature pour ${file}:`, err.message);
      });
  });
});