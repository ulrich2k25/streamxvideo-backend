const express = require("express");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const router = express.Router();
const usersFilePath = "./data/users.json"; // Le fichier JSON où les utilisateurs sont stockés

// Fonction pour lire les utilisateurs depuis le fichier JSON
const getUsersFromFile = () => {
    const data = fs.readFileSync(usersFilePath);
    return JSON.parse(data);
};

// Inscription
router.post("/register", async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = { username, email, password: hashedPassword };
        const users = getUsersFromFile();
        users.push(newUser);
        fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
        res.status(201).json({ message: "Utilisateur créé avec succès !" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Connexion
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const users = getUsersFromFile();
        const user = users.find(u => u.email === email);
        if (!user) return res.status(400).json({ message: "Utilisateur non trouvé" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: "Mot de passe incorrect" });

        const token = jwt.sign({ id: user.email }, "your-secret-key", { expiresIn: "7d" });
        res.json({ token, user });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
