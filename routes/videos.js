const express = require("express");
const db = require("../db"); // Connexion MySQL
const AWS = require("aws-sdk");

const videoRouter = express.Router();

// 📌 🔥 Configuration d'Amazon S3
const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
});

// 📌 Middleware pour vérifier l'abonnement
const verifyAbonné = (req, res, next) => {
    const { userEmail } = req.headers;

    if (!userEmail) {
        return res.status(400).json({ message: "⚠️ Email requis pour vérifier l'abonnement." });
    }

    db.query("SELECT isSubscribed FROM users WHERE email = ?", [userEmail], (err, results) => {
        if (err) {
            return res.status(500).json({ error: "❌ Erreur MySQL lors de la vérification." });
        }
        if (results.length === 0 || results[0].isSubscribed !== 1) {
            return res.status(403).json({ message: "🚫 Accès refusé : Vous devez être abonné." });
        }
        next();
    });
};

// 📌 Route GET : Récupérer la liste des vidéos depuis MySQL
videoRouter.get("/", (req, res) => {
    db.query("SELECT id, title, file_path, uploaded_at FROM videos", (err, results) => {
        if (err) {
            return res.status(500).json({ error: "❌ Erreur lors de la récupération des vidéos." });
        }
        res.json(results);
    });
});

// 📌 Route sécurisée pour récupérer une URL de lecture vidéo S3
videoRouter.get("/watch/:id", verifyAbonné, async (req, res) => {
    const { id } = req.params;

    db.query("SELECT file_path FROM videos WHERE id = ?", [id], async (err, results) => {
        if (err || results.length === 0) {
            return res.status(404).json({ message: "❌ Vidéo introuvable." });
        }

        const fileUrl = results[0].file_path;

        // Générer une URL signée S3 (expirable)
        const url = s3.getSignedUrl("getObject", {
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: fileUrl.split("/").pop(),
            Expires: 3600, // URL valable 1 heure
        });

        res.json({ message: "✅ Accès autorisé", videoUrl: url });
    });
});

module.exports = videoRouter;
