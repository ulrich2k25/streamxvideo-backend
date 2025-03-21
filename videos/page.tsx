
"use client";

import { useEffect, useState } from "react";
import { Button, TextField, Typography, Container, Grid, Card, CardContent } from "@mui/material";

export default function VideosPage() {
    const [videos, setVideos] = useState([]);
    const [userEmail, setUserEmail] = useState(""); // Pour simuler un abonné
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false); // Ajout d'un état de chargement

    useEffect(() => {
        // Récupération des vidéos lors du chargement de la page
        setLoading(true);
        fetch("http://localhost:5000/api/videos")
            .then((res) => res.json())
            .then((data) => {
                setVideos(data);
                setLoading(false); // On arrête le chargement une fois les données récupérées
            })
            .catch((err) => {
                console.error("Erreur de chargement des vidéos :", err);
                setLoading(false);
                setMessage("❌ Impossible de charger les vidéos.");
            });
    }, []);

    const handleDownload = async (filename: string) => {
        if (!userEmail) {
            alert("Veuillez entrer votre email d'abonné pour télécharger.");
            return;
        }

        try {
            const response = await fetch(`http://localhost:5000/api/videos/download/${filename}`, {
                headers: { "user-email": userEmail },
            });

            if (!response.ok) throw new Error("Accès refusé ou fichier introuvable.");

            const blob = await response.blob();
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            setMessage("❌ Impossible de télécharger cette vidéo.");
        }
    };

    return (
        <Container component="main" maxWidth="lg" sx={{ padding: "40px" }}>
            <Typography variant="h4" component="h1" sx={{ color: "white", marginBottom: "20px" }}>
                📺 Liste des Vidéos
            </Typography>
            {/* Ajout du champ d'email */}
            <TextField
                type="email"
                label="Entrez votre email d'abonné"
                placeholder="Email"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                fullWidth
                sx={{
                    marginBottom: "20px",
                    input: { color: "white" },
                    label: { color: "white" },
                    backgroundColor: "rgba(255, 255, 255, 0.1)", // Ajout d'un fond clair pour le champ
                    borderRadius: "5px",
                }}
            />
            <Grid container spacing={4}>
                {loading ? (
                    <Typography variant="h6" sx={{ color: "white" }}>
                        Chargement des vidéos...
                    </Typography>
                ) : (
                    videos.map((video) => (
                        <Grid item xs={12} sm={6} md={4} key={video.file}>
                            <Card sx={{ backgroundColor: "#2D3748", color: "white" }}>
                                <CardContent>
                                    <Typography variant="h6">{video.file}</Typography>
                                    <video className="w-full rounded-lg" controls>
                                        <source src={`http://localhost:5000${video.url}`} type="video/mp4" />
                                        Votre navigateur ne supporte pas la lecture de vidéos.
                                    </video>
                                    <Button
                                        onClick={() => handleDownload(video.file)}
                                        fullWidth
                                        variant="contained"
                                        color="primary"
                                        sx={{
                                            marginTop: "10px",
                                            backgroundColor: "#1D6A98", // Amélioration visuelle du bouton
                                            "&:hover": {
                                                backgroundColor: "#155D84", // Changement de couleur au survol
                                            },
                                        }}
                                    >
                                        📥 Télécharger
                                    </Button>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))
                )}
            </Grid>
            {message && <Typography variant="body1" sx={{ color: "red", marginTop: "20px" }}>{message}</Typography>}
        </Container>
    );
}
