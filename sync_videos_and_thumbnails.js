// 📁 backend/sync_videos_and_thumbnails.js (Version anti-doublons + nettoyage auto)
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

  // 🔁 Nettoyage automatique des doublons (même basename)
  await connection.execute(`
    DELETE v1 FROM videos v1
    JOIN videos v2 ON v1.id > v2.id AND v1.title = v2.title
  `);
  console.log("🧼 Doublons supprimés automatiquement.");

  const [existingRows] = await connection.execute('SELECT file_path FROM videos');
  const uploadedFilenames = existingRows.map(row => path.basename(row.file_path));

  const files = fs.readdirSync(videosFolder);
  const erreurs = [];
  const ajoutes = [];

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (!videoMimeTypes[ext]) continue;
    if (uploadedFilenames.includes(file)) {
      console.log(`⏩ Déjà en base, ignoré : ${file}`);
      continue;
    }

    try {
      const videoPath = path.join(videosFolder, file);
      const videoUrl = bucketVideoUrl + file;
      const thumbnailName = file.replace(ext, '.jpg');
      const thumbnailPath = path.join(videosFolder, thumbnailName);
      const thumbnailUrl = bucketThumbUrl + thumbnailName;

      if (!fs.existsSync(thumbnailPath)) {
        await new Promise((resolve, reject) => {
          ffmpeg(videoPath)
            .screenshots({ timestamps: ['3'], filename: thumbnailName, folder: videosFolder, size: '320x240' })
            .on('end', () => { console.log(`✅ Miniature créée : ${thumbnailName}`); resolve(); })
            .on('error', err => { console.error(`Erreur ffmpeg :`, err.message); reject(err); });
        });
      }

      await uploadFileToS3(thumbnailPath, `thumbnails/${thumbnailName}`, 'image/jpeg');

      const videoKey = `videos/${file}`;
      const videoExists = await checkS3Exists(videoKey);
      if (!videoExists) await uploadFileToS3(videoPath, videoKey, videoMimeTypes[ext]);
      else console.log(`🔹 Vidéo déjà sur S3 : ${file}`);

      await connection.execute(
        'INSERT INTO videos (title, file_path, thumbnail_path, uploaded_at) VALUES (?, ?, ?, NOW())',
        [file, videoUrl, thumbnailUrl]
      );
      console.log(`✅ Vidéo ajoutée à la BDD : ${file}`);
      ajoutes.push(file);
    } catch (error) {
      console.error(`❌ Erreur avec ${file} :`, error.message);
      erreurs.push(file);
    }
  }

  await connection.end();

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
