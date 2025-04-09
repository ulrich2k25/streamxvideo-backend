// 📁 backend/generate_missing_thumbnails.js
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

const videoMimeTypes = {
  '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.avi': 'video/x-msvideo',
  '.mkv': 'video/x-matroska', '.webm': 'video/webm', '.flv': 'video/x-flv',
  '.wmv': 'video/x-ms-wmv', '.mpeg': 'video/mpeg', '.mpg': 'video/mpeg',
  '.3gp': 'video/3gpp', '.m4v': 'video/x-m4v'
};

const videosFolder = 'C:/VideosTest';

fs.readdir(videosFolder, async (err, files) => {
  if (err) return console.error('❌ Erreur lecture dossier vidéos :', err);

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (!videoMimeTypes[ext]) continue;

    const videoPath = path.join(videosFolder, file);
    const thumbnailName = file.replace(ext, '.jpg');
    const thumbnailPath = path.join(videosFolder, thumbnailName);
    const thumbnailKey = `thumbnails/${thumbnailName}`;

    const exists = await checkS3Exists(thumbnailKey);
    if (exists) {
      console.log(`🟡 Déjà sur S3 : ${thumbnailName}`);
      continue;
    }

    // Si la miniature n'existe même pas en local
    if (!fs.existsSync(thumbnailPath)) {
      console.log(`🛠️ Génération locale : ${thumbnailName}`);
      await new Promise((resolve, reject) => {
        ffmpeg(videoPath)
          .screenshots({ timestamps: ['3'], filename: thumbnailName, folder: videosFolder, size: '320x240' })
          .on('end', resolve)
          .on('error', err => {
            console.error(`❌ Erreur ffmpeg :`, err.message);
            reject(err);
          });
      });
    }

    // Upload vers S3
    fs.readFile(thumbnailPath, (err, data) => {
      if (err) return console.error(`❌ Lecture échouée : ${thumbnailName}`);
      s3.upload({
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: thumbnailKey,
        Body: data,
        ContentType: 'image/jpeg',
        ACL: 'public-read'
      }, (err, result) => {
        if (err) return console.error(`❌ Upload échoué : ${thumbnailName}`);
        console.log(`🚀 Uploadé sur S3 : ${result.Key}`);
      });
    });
  }
});

function checkS3Exists(key) {
  return new Promise((resolve) => {
    s3.headObject({ Bucket: process.env.AWS_S3_BUCKET_NAME, Key: key }, (err) => {
      if (err && err.code === 'NotFound') return resolve(false);
      resolve(true);
    });
  });
}
