require("dotenv").config();
const mysql = require("mysql2");

// Affiche les valeurs en développement (mais cache en production)
if (process.env.NODE_ENV !== "production") {
  console.log("🔍 Vérification des variables d'environnement MySQL :");
  console.log("MYSQLHOST :", process.env.MYSQLHOST);
  console.log("MYSQLUSER :", process.env.MYSQLUSER);
  console.log("MYSQLPASSWORD :", process.env.MYSQLPASSWORD ? "" : "non défini");
  console.log("MYSQLDATABASE :", process.env.MYSQLDATABASE);
  console.log("MYSQLPORT :", process.env.MYSQLPORT);
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

const db = mysql.createPool({
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
  port: process.env.MYSQLPORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});


// Connexion à la base
connection.connect((err) => {
  if (err) {
    console.error("❌ Erreur de connexion à MySQL :", err.message);
  } else {
    console.log("✅ Connexion MySQL réussie !");
  }
});

module.exports = connection;