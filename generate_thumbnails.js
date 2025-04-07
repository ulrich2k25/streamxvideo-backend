// 📁 backend/generate_thumbnails.js (ESModule)
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import AWS from 'aws-sdk';
import dotenv from 'dotenv';

dotenv.config();

// ✅ Configuration AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// ✅ Extensions vidéo supportées
const videoMimeTypes = {
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.mkv': 'video/x-matroska',
  '.webm': 'video/webm',
  '.flv': 'video/x-flv',
  '.wmv': 'video/x-ms-wmv',
  '.mpeg': 'video/mpeg',
  '.mpg': 'video/mpeg',
  '.3gp': 'video/3gpp',
  '.m4v': 'video/x-m4v'
};

// ✅ Dossier des vidéos locales
const videosFolder = 'C:/VideosTest';

fs.readdir(videosFolder, (err, files) => {
  if (err) return console.error('Erreur lecture dossier vidéos :', err);

  files.forEach(file => {
    const ext = path.extname(file).toLowerCase();
    if (!Object.keys(videoMimeTypes).includes(ext)) return;

    const inputPath = path.join(videosFolder, file);
    const thumbnailName = file.replace(ext, '.jpg');
    const thumbnailPath = path.join(videosFolder, thumbnailName);

    // ✅ Génère miniature si elle n'existe pas localement
    if (!fs.existsSync(thumbnailPath)) {
      ffmpeg(inputPath)
        .screenshots({
          timestamps: ['3'],
          filename: thumbnailName,
          folder: videosFolder,
          size: '320x240'
        })
        .on('end', () => {
          console.log(`✅ Miniature créée : ${thumbnailName}`);
          uploadToS3(thumbnailPath, thumbnailName);
        })
        .on('error', err => {
          console.error(`Erreur ffmpeg pour ${file} :`, err.message);
        });
    } else {
      // ✅ Miniature existe localement, on vérifie si elle est déjà sur S3
      s3.headObject({
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: `thumbnails/${thumbnailName}`
      }, (err, data) => {
        if (err && err.code === 'NotFound') {
          console.log(`📤 Miniature absente sur S3, upload : ${thumbnailName}`);
          uploadToS3(thumbnailPath, thumbnailName);
        } else {
          console.log(`🟡 Miniature déjà existante sur S3 : ${thumbnailName}, on saute...`);
        }
      });
    }
  });
});

// ✅ Fonction upload S3
function uploadToS3(thumbnailPath, thumbnailName) {
  fs.readFile(thumbnailPath, (err, data) => {
    if (err) return console.error('Erreur lecture miniature :', err);

    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: `thumbnails/${thumbnailName}`,
      Body: data,
      ContentType: 'image/jpeg',
      ACL: 'public-read'
    };

    s3.upload(params, (err, result) => {
      if (err) return console.error('❌ Upload échoué :', err);
      console.log(`🚀 Upload réussi sur S3 : ${result.Location}`);
    });
  });
}
