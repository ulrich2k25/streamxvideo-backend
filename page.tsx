import React from "react";
import Link from "next/link";

export default function Home() {
  return (
    <div>
      <h1>Bienvenue sur mon site de vidéos !</h1>
      <p>Connecte-toi ou inscris-toi pour accéder au contenu exclusif.</p>
      <div>
        <Link href="/login">Se connecter</Link> | <Link href="/signup">S'inscrire</Link>
      </div>
    </div>
  );
}
