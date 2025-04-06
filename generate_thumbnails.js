const ffmpeg = require('fluent-ffmpeg');
const AWS = require('aws-sdk');
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');

// Configuration AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// Configuration de la base MySQL
const db = await mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const generateAndUploadThumbnail = async (video) => {
  const thumbnailPath = `thumbnail-${video.id}.jpg`;
  const localOutput = path.join(__dirname, thumbnailPath);

  return new Promise((resolve, reject) => {
    ffmpeg(video.file_path)
      .screenshots({
        timestamps: ['5%'],
        filename: thumbnailPath,
        folder: __dirname,
        size: '320x240'
      })
      .on('end', async () => {
        try {
          const fileContent = fs.readFileSync(localOutput);

          const uploadResult = await s3.upload({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: `thumbnails/${thumbnailPath}`,
            Body: fileContent,
            ContentType: 'image/jpeg',
            ACL: 'public-read',
          }).promise();

          // Mettre à jour la base de données
          await db.execute(
            'UPDATE videos SET thumbnail_path = ? WHERE id = ?',
            [uploadResult.Location, video.id]
          );

          fs.unlinkSync(localOutput); // Supprimer le fichier local
          resolve();
        } catch (error) {
          reject(error);
        }
      })
      .on('error', reject);
  });
};

// Exemple d’utilisation
(async () => {
  const [rows] = await db.execute('SELECT * FROM videos WHERE thumbnail_path IS NULL');
  for (const video of rows) {
    await generateAndUploadThumbnail(video);
    console.log(`Miniature générée et uploadée pour la vidéo ID: ${video.id}`);
  }

  db.end();
})();
