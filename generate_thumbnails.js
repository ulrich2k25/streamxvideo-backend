import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import AWS from 'aws-sdk';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

//const videosFolder = path.join(__dirname, 'videos');
//const thumbnailsFolder = path.join(__dirname, 'thumbnails');
const videoPath = "C:/Users/pouke/Desktop/New_Projekt/video1.mp4";
const thumbnailPath = "C:/Users/pouke/Desktop/New_Projekt/thumbnail1.jpg";


if (!fs.existsSync(thumbnailsFolder)) {
  fs.mkdirSync(thumbnailsFolder);
}
ffmpeg(videoPath)
  .screenshots({
    timestamps: ['5'],
    filename: path.basename(thumbnailPath),
    folder: path.dirname(thumbnailPath),
    size: '320x240'
  })
  .on('end', () => {
    console.log('Miniature générée avec succès à :', thumbnailPath);
  })
  .on('error', (err) => {
    console.error('Erreur ffmpeg :', err);
  });



fs.readdir(videosFolder, (err, files) => {
  if (err) return console.error('Erreur lecture dossier vidéos:', err);

  files.forEach(file => {
    const inputPath = path.join(videosFolder, file);
    const outputPath = path.join(thumbnailsFolder, `${path.parse(file).name}.jpg`);

    ffmpeg(inputPath)
      .screenshots({
        timestamps: ['5%'],
        filename: path.basename(outputPath),
        folder: thumbnailsFolder,
        size: '320x240'
      })
      .on('end', () => {
        console.log(`✅ Miniature créée pour ${file}`);

        const fileContent = fs.readFileSync(outputPath);
        const params = {
          Bucket: process.env.AWS_S3_BUCKET_NAME,
          Key: `thumbnails/${path.basename(outputPath)}`,
          Body: fileContent,
          ContentType: 'image/jpeg',
          ACL: 'public-read'
        };

        s3.upload(params, (err, data) => {
          if (err) console.error(`❌ Erreur upload miniature pour ${file}:`, err);
          else console.log(`☁️ Miniature uploadée sur S3: ${data.Location}`);
        });
      })
      .on('error', err => {
        console.error(`❌ Erreur ffmpeg pour ${file}:`, err);
      });
  });
});
