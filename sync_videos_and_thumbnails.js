// 📁 backend/sync_videos_and_thumbnails.js (Fusion complet corrigé)
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import AWS from 'aws-sdk';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// 🔑 Config AWS S3
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
const bucketVideoUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/videos/`;
const bucketThumbUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/thumbnails/`;

async function syncVideosAndThumbnails() {
  const connection = await mysql.createConnection({
    host: process.env.MYSQLHOST,
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQLDATABASE,
    port: process.env.MYSQLPORT
  });

  const [existingRows] = await connection.execute('SELECT file_path FROM videos');
  const existingFilePaths = existingRows.map(row => row.file_path);

  const files = fs.readdirSync(videosFolder);

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (!videoMimeTypes[ext]) continue;

    const videoPath = path.join(videosFolder, file);
    const videoUrl = bucketVideoUrl + file;
    const thumbnailName = file.replace(ext, '.jpg');
    const thumbnailPath = path.join(videosFolder, thumbnailName);
    const thumbnailUrl = bucketThumbUrl + thumbnailName;

    // 🔢 Miniature : générer si manquante localement
    if (!fs.existsSync(thumbnailPath)) {
      await new Promise((resolve, reject) => {
        ffmpeg(videoPath)
          .screenshots({ timestamps: ['3'], filename: thumbnailName, folder: videosFolder, size: '320x240' })
          .on('end', () => { console.log(`✅ Miniature créée : ${thumbnailName}`); resolve(); })
          .on('error', err => { console.error(`Erreur ffmpeg :`, err.message); reject(err); });
      });
    }

    // ✨ Upload miniature sur S3
    const thumbKey = `thumbnails/${thumbnailName}`;
    await uploadFileToS3(thumbnailPath, thumbKey, 'image/jpeg');

    // ✨ Upload vidéo sur S3 si absente
    const videoKey = `videos/${file}`;
    const videoExists = await checkS3Exists(videoKey);
    if (!videoExists) await uploadFileToS3(videoPath, videoKey, videoMimeTypes[ext]);
    else console.log(`🔹 Vidéo déjà sur S3 : ${file}`);

    // 🔢 Insert ou update dans la BDD
    if (!existingFilePaths.includes(videoUrl)) {
      await connection.execute(
        'INSERT INTO videos (title, file_path, thumbnail_path, uploaded_at) VALUES (?, ?, ?, NOW())',
        [file, videoUrl, thumbnailUrl]
      );
      console.log(`✅ Vidéo ajoutée à la BDD : ${file}`);
    } else {
      await connection.execute(
        'UPDATE videos SET thumbnail_path = ? WHERE file_path = ?',
        [thumbnailUrl, videoUrl]
      );
      console.log(`✅ Miniature mise à jour pour : ${file}`);
    }
  }

  // ✅ Fermeture après traitement complet
  console.log('✅ Tous les fichiers traités, fermeture de la connexion...');
  await connection.end();
  console.log('🎉 Synchronisation complète terminée !');
}

function uploadFileToS3(localPath, key, contentType) {
  return new Promise((resolve, reject) => {
    fs.readFile(localPath, (err, data) => {
      if (err) return reject(err);
      s3.upload({
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: key,
        Body: data,
        ContentType: contentType,
        ACL: 'public-read'
      }, (err, result) => {
        if (err) return reject(err);
        console.log(`🚀 Upload réussi : ${result.Key}`);
        resolve();
      });
    });
  });
}

function checkS3Exists(key) {
  return new Promise((resolve) => {
    s3.headObject({ Bucket: process.env.AWS_S3_BUCKET_NAME, Key: key }, (err) => {
      if (err && err.code === 'NotFound') return resolve(false);
      resolve(true);
    });
  });
}

syncVideosAndThumbnails().catch(console.error);

