require("dotenv").config();
const mysql = require("mysql2");

if (!process.env.MYSQLHOST || !process.env.MYSQLUSER || !process.env.MYSQLPASSWORD || !process.env.MYSQLDATABASE || !process.env.MYSQLPORT) {
    console.error("❌ Erreur: Variables MySQL manquantes !");
    process.exit(1);
}

const connection = mysql.createConnection({
    host: process.env.MYSQLHOST,
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQLDATABASE,
    port: process.env.MYSQLPORT
});

connection.connect(err => {
    if (err) {
        console.error("❌ Erreur de connexion à MySQL:", err.message);
    } else {
        console.log("✅ Connexion MySQL réussie !");
    }
});

module.exports = connection;
