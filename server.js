require("dotenv").config();
const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const multer = require("multer");
const AWS = require("aws-sdk");

// 📌 Initialisation Express
const app = express();
app.use(express.json());
app.use(cors({ origin: process.env.FRONTEND_URL })); // ✅ CORS frontend autorisé

// 🔥 Connexion MySQL (via variables .env)
const db = mysql.createConnection({
    host: process.env.MYSQLHOST,
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQLDATABASE,
    port: process.env.MYSQLPORT,
});

db.connect((err) => {
    if (err) {
        console.error("❌ Erreur de connexion à MySQL :", err);
        return;
    }
    console.log("✅ Connexion réussie à MySQL !");
});

// 📌 Configuration d'Amazon S3
const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
});

// 📌 Configuration Multer
const storage = multer.memoryStorage();
const upload = multer({ storage });

// 📌 Upload vidéo
app.post("/api/videos/upload", upload.single("video"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "Aucun fichier trouvé." });

        const allowedTypes = ["video/mp4", "video/mkv", "video/webm"];
        if (!allowedTypes.includes(req.file.mimetype)) {
            return res.status(400).json({ error: "Format non supporté." });
        }

        const fileName = `${Date.now()}_${req.file.originalname}`;
        const params = {
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: fileName,
            Body: req.file.buffer,
            ContentType: req.file.mimetype,
        };

        const uploadResult = await s3.upload(params).promise();
        const videoUrl = uploadResult.Location;

        db.query(
            "INSERT INTO videos (title, file_path, uploaded_at) VALUES (?, ?, NOW())",
            [req.file.originalname, videoUrl],
            (err) => {
                if (err) return res.status(500).json({ error: "Erreur d'insertion en base." });
                res.json({ message: "✅ Vidéo uploadée avec succès !", url: videoUrl });
            }
        );
    } catch (error) {
        console.error("❌ Erreur lors de l'upload S3:", error);
        res.status(500).json({ error: "Erreur upload S3." });
    }
});

// 📌 GET : Liste vidéos
app.get("/api/videos", (req, res) => {
    db.query("SELECT id, title, file_path, uploaded_at FROM videos", (err, results) => {
        if (err) return res.status(500).json({ error: "Erreur récupération vidéos." });
        res.json(results);
    });
});

// 📌 DELETE : Supprimer une vidéo
app.delete("/api/videos/:id", async (req, res) => {
    const { id } = req.params;

    db.query("SELECT file_path FROM videos WHERE id = ?", [id], async (err, results) => {
        if (err || results.length === 0) {
            return res.status(404).json({ error: "Vidéo non trouvée." });
        }

        const filePath = results[0].file_path;
        const fileName = filePath.split("/").pop();

        try {
            await s3.deleteObject({ Bucket: process.env.AWS_S3_BUCKET_NAME, Key: fileName }).promise();
            db.query("DELETE FROM videos WHERE id = ?", [id], (err) => {
                if (err) return res.status(500).json({ error: "Erreur suppression en base." });
                res.json({ message: "✅ Vidéo supprimée avec succès." });
            });
        } catch (error) {
            console.error("❌ Erreur de suppression sur S3 :", error);
            res.status(500).json({ error: "Erreur suppression sur S3." });
        }
    });
});

// 📌 Authentification ou inscription
app.post("/api/auth", (req, res) => {
    const { email, password } = req.body;
    db.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
        if (err) return res.status(500).json({ error: "Erreur MySQL" });

        if (results.length > 0) {
            res.json({ message: "✅ Connexion réussie", user: results[0] });
        } else {
            db.query(
                "INSERT INTO users (email, password, isSubscribed) VALUES (?, ?, 0)",
                [email, password],
                (err, result) => {
                    if (err) return res.status(500).json({ error: "Erreur inscription" });
                    res.json({ message: "✅ Inscription réussie", user: { id: result.insertId, email, isSubscribed: 0 } });
                }
            );
        }
    });
});

// 📌 Test du serveur
app.get("/api/status", (req, res) => {
    res.json({ message: "✅ Serveur en ligne !" });
});

// 📌 Lancer serveur
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Serveur lancé sur le port ${PORT}`));
