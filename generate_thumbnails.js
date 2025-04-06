// 📁 backend/generate_thumbnails.js
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

// ✅ Config AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// ✅ Dossier contenant les vidéos locales
const videosFolder = "C:/Users/pouke/Desktop/New_Projekt/";

// ✅ Parcours des fichiers
fs.readdir(videosFolder, (err, files) => {
  if (err) return console.error('Erreur de lecture du dossier vidéo :', err);

  files.forEach((file) => {
    if (!file.toLowerCase().endsWith('.mp4')) return; // Ignore les fichiers non-vidéos

    const inputPath = path.join(videosFolder, file);
    const thumbnailFilename = file.replace(/\.mp4$/, '.jpg');
    const thumbnailPath = path.join(videosFolder, thumbnailFilename);

    // ✅ Génération de la miniature
    ffmpeg(inputPath)
      .screenshots({
        timestamps: ['3'], // capture à 3 sec
        filename: thumbnailFilename,
        folder: videosFolder,
        size: '320x240',
      })
      .on('end', () => {
        console.log(`📄 Miniature générée : ${thumbnailFilename}`);

        // ✅ Lecture et upload vers S3
        fs.readFile(thumbnailPath, (err, data) => {
          if (err) return console.error('Erreur lecture miniature :', err);

          const s3Params = {
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: `thumbnails/${thumbnailFilename}`,
            Body: data,
            ContentType: 'image/jpeg',
            ACL: 'public-read',
          };

          s3.upload(s3Params, (err, data) => {
            if (err) return console.error('Erreur upload S3 :', err);
            console.log(`🌌 Upload réussi : ${data.Location}`);
          });
        });
      })
      .on('error', (err) => {
        console.error('Erreur ffmpeg :', err.message);
      });
  });
});
