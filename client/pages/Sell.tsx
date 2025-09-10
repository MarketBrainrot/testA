import { Link } from "react-router-dom";

export default function Sell() {
  return (
    <div className="container py-24 text-center">
      <div className="mx-auto max-w-lg rounded-xl border border-border/60 bg-card p-8">
        <h1 className="font-display text-2xl font-bold">Vendre un produit</h1>
        <p className="mt-3 text-foreground/70">
          Créez une annonce pour vendre votre Brainrot. Vous devez être connecté
          et vérifier votre profil pour commencer.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link to="/profile" className="text-sm text-primary hover:underline">
            Aller au profil
          </Link>
          <Link
            to="/marketplace"
            className="text-sm text-foreground/80 hover:underline"
          >
            Voir le marketplace
          </Link>
        </div>
      </div>
    </div>
  );
}
