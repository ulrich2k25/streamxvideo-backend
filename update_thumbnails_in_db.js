// 📁 backend/update_thumbnails_in_db.js
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const bucketUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/thumbnails/`;

async function updateThumbnails() {
  const connection = await mysql.createConnection({
    host: process.env.MYSQLHOST,
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQLDATABASE,
    port: process.env.MYSQLPORT
  });

  const [rows] = await connection.execute('SELECT id, file_path FROM videos');

  for (const row of rows) {
    const filename = path.basename(row.file_path); // ex: Video10.mp4
    const thumbnailName = filename.replace(path.extname(filename), '.jpg');
    const thumbnailUrl = bucketUrl + thumbnailName;

    await connection.execute(
      'UPDATE videos SET thumbnail_path = ? WHERE id = ?',
      [thumbnailUrl, row.id]
    );

    console.log(`✅ BDD mise à jour pour : ${thumbnailName}`);
  }

  await connection.end();
  console.log('🎉 Mise à jour terminée !');
}

updateThumbnails().catch(console.error);
