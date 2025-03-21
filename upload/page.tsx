"use client";

import { useState } from "react";
import { Button, TextField, Typography, Container, Box } from "@mui/material";

export default function UploadPage() {
    const [file, setFile] = useState<File | null>(null);
    const [message, setMessage] = useState("");

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files.length > 0) {
            setFile(event.target.files[0]);
        }
    };

    const handleUpload = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!file) {
            alert("Veuillez sélectionner une vidéo !");
            return;
        }

        let formData = new FormData();
        formData.append("video", file);

        try {
            let response = await fetch("http://localhost:5000/api/videos/upload", {
                method: "POST",
                headers: {
                    "Authorization": "Bearer mon_token_securise", // Sécurisation de l'upload
                },
                body: formData,
            });

            let result = await response.json();
            setMessage(result.message);
        } catch (error) {
            console.error("Erreur lors de l'upload :", error);
            setMessage("Erreur lors de l'upload.");
        }
    };

    return (
        <Container component="main" maxWidth="xs">
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    backgroundColor: "#1A202C",
                    padding: "20px",
                    borderRadius: "8px",
                }}
            >
                <Typography variant="h5" component="h1" sx={{ color: "white" }}>
                    📤 Uploader une Vidéo
                </Typography>
                <form onSubmit={handleUpload} style={{ width: "100%" }}>
                    <TextField
                        type="file"
                        accept="video/*"
                        onChange={handleFileChange}
                        fullWidth
                        required
                        sx={{
                            marginTop: "10px",
                            marginBottom: "20px",
                            input: {
                                color: "white",
                            },
                        }}
                    />
                    <Button
                        type="submit"
                        fullWidth
                        variant="contained"
                        color="primary"
                        sx={{
                            marginBottom: "10px",
                        }}
                    >
                        🚀 Uploader
                    </Button>
                </form>
                {message && (
                    <Typography variant="body1" sx={{ color: "green", marginTop: "20px" }}>
                        {message}
                    </Typography>
                )}
            </Box>
        </Container>
    );
}
