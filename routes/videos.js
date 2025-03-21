const express = require("express");
const fs = require("fs");
const path = require("path");

const videoRouter = express.Router();
const UPLOADS_DIR = path.join(__dirname, "..", "uploads");

// 📌 Middleware pour vérifier l'abonnement avant téléchargement
const verifyAbonné = (req, res, next) => {
    const user = req.headers["user-email"]; // L'email est envoyé dans l'en-tête

    // Simuler une base de données des abonnés (à remplacer par une vraie DB)
    const abonnés = ["user1@email.com", "user2@email.com"];

    if (!user || !abonnés.includes(user)) {
        return res.status(403).json({ message: "🚫 Accès refusé : Vous devez être abonné." });
    }
    next();
};

// 📌 Route pour récupérer la liste des vidéos
videoRouter.get("/", async (req, res) => {
    try {
        const files = fs.readdirSync(UPLOADS_DIR).map((file) => ({
            file,
            url: `/uploads/${file}`,
        }));
        res.json(files);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 📌 Route sécurisée pour télécharger une vidéo
videoRouter.get("/download/:filename", verifyAbonné, (req, res) => {
    const filePath = path.join(UPLOADS_DIR, req.params.filename);
    if (fs.existsSync(filePath)) {
        res.download(filePath);
    } else {
        res.status(404).json({ message: "❌ Fichier introuvable." });
    }
});

module.exports = videoRouter;
