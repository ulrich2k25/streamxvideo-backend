// 📁 backend/sync_videos_and_thumbnails.js (Corrigé : pool MySQL + robustesse)

import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import AWS from 'aws-sdk';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

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

const pool = mysql.createPool({
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
  port: process.env.MYSQLPORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function syncVideosAndThumbnails() {
  const [existingRows] = await pool.execute('SELECT file_path FROM videos');
  const uploadedFilenames = existingRows.map(row => path.basename(row.file_path));

  const files = fs.readdirSync(videosFolder);
  const erreurs = [];
  const ajoutes = [];

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (!videoMimeTypes[ext]) continue;

    const videoPath = path.join(videosFolder, file);
    const videoKey = `videos/${file}`;
    const videoUrl = bucketVideoUrl + file;
    const thumbnailName = file.replace(ext, '.jpg');
    const thumbnailPath = path.join(videosFolder, thumbnailName);
    const thumbnailKey = `thumbnails/${thumbnailName}`;
    const thumbnailUrl = bucketThumbUrl + thumbnailName;

    const alreadyUploaded = uploadedFilenames.includes(file);

    try {
      if (!fs.existsSync(thumbnailPath)) {
        await new Promise((resolve, reject) => {
          ffmpeg(videoPath)
            .screenshots({ timestamps: ['3'], filename: thumbnailName, folder: videosFolder, size: '320x240' })
            .on('end', () => {
              console.log(`✅ Miniature créée : ${thumbnailName}`);
              resolve();
            })
            .on('error', err => {
              console.error(`❌ Erreur ffmpeg :`, err.message);
              reject(err);
            });
        });
      }

      await uploadFileToS3(thumbnailPath, thumbnailKey, 'image/jpeg');
      console.log(`🚀 Upload réussi : ${thumbnailKey}`);

      const videoExists = await checkS3Exists(videoKey);
      if (!videoExists) {
        await uploadFileToS3(videoPath, videoKey, videoMimeTypes[ext]);
        console.log(`🚀 Upload réussi : ${videoKey}`);
      } else {
        console.log(`📦 Vidéo déjà sur S3 : ${file}`);
      }

      if (!alreadyUploaded) {
        await pool.execute(
          'INSERT INTO videos (title, file_path, thumbnail_path, uploaded_at) VALUES (?, ?, ?, NOW())',
          [file, videoUrl, thumbnailUrl]
        );
        console.log(`✅ Vidéo ajoutée à la BDD : ${file}`);
        ajoutes.push(file);
      } else {
        await pool.execute(
          'UPDATE videos SET thumbnail_path = ? WHERE file_path LIKE ?',
          [thumbnailUrl, `%/${file}`]
        );
        console.log(`🔄 Miniature mise à jour en BDD pour : ${file}`);
      }
    } catch (error) {
      console.error(`❌ Erreur avec ${file} :`, error.message);
      erreurs.push(file);
    }
  }

  await pool.end();

  console.log('\n📊 RÉSUMÉ :');
  console.log(`✅ Vidéos ajoutées : ${ajoutes.length}`);
  ajoutes.forEach(name => console.log(`  ➕ ${name}`));
  console.log(`❌ Échecs : ${erreurs.length}`);
  erreurs.forEach(name => console.log(`  ⚠️ ${name}`));
  console.log('\n🎉 Synchronisation complète terminée !');
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
        resolve(result);
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