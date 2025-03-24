require("dotenv").config();
const mysql = require("mysql2");

// Vérifie les variables en développement
if (process.env.NODE_ENV !== "production") {
    console.log("🔍 Vérification des variables MySQL :");
    console.log("MYSQLHOST:", process.env.MYSQLHOST);
    console.log("MYSQLUSER:", process.env.MYSQLUSER);
    console.log("MYSQLPASSWORD:", process.env.MYSQLPASSWORD ? "✔️ défini" : "❌ manquant");
    console.log("MYSQLDATABASE:", process.env.MYSQLDATABASE);
    console.log("MYSQLPORT:", process.env.MYSQLPORT);
}

// Vérifie si une variable est manquante
if (
    !process.env.MYSQLHOST ||
    !process.env.MYSQLUSER ||
    !process.env.MYSQLPASSWORD ||
    !process.env.MYSQLDATABASE ||
    !process.env.MYSQLPORT
) {
    console.error("❌ Erreur : Variables MySQL manquantes !");
    process.exit(1);
}

// Connexion à la base (avec pool)
const pool = mysql.createPool({
    host: process.env.MYSQLHOST,
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQLDATABASE,
    port: process.env.MYSQLPORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

// Vérification de connexion (facultatif mais utile pour logs)
pool.getConnection((err) => {
    if (err) {
        console.error("❌ Erreur de connexion à MySQL :", err.message);
    } else {
        console.log("✅ Connexion MySQL réussie !");
    }
});

// Export du pool
module.exports = pool;
