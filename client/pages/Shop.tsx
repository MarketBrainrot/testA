import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthProvider";
import { useProfile } from "@/context/ProfileProvider";
import StripeCheckout from "@/components/StripeCheckout";
import { ShieldCheck, Zap, BadgeDollarSign } from "lucide-react";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";

import { packs } from "@/lib/packs";

export default function Shop() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { addCredits } = useProfile();
  const [open, setOpen] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);
  const [promo, setPromo] = useState<number>(0);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "promotions", "packs"), (d) => {
      const data = d.data() as any;
      setPromo(Number(data?.all || 0));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get("success");
    const sid = params.get("sid");
    const packId = params.get("pack");
    if (!success || !sid || !packId || !user) return;
    const pack = packs.find((p) => p.id === packId);
    if (!pack) return;
    (async () => {
      try {
        setProcessing(true);
        const verify = await fetch(`/api/stripe/verify-session?id=${encodeURIComponent(sid)}`);
        const data = await verify.json();
        if (!verify.ok || !data?.paid) throw new Error("payment_not_verified");
        const credits = pack.coins + Math.round((pack.coins * pack.bonus) / 100);
        await addCredits(credits);
        await addDoc(collection(db, "transactions"), {
          uid: user?.uid,
          email: user?.email,
          type: "credits_purchase",
          orderId: sid,
          amountEUR: Number((pack.price * (1 - promo / 100)).toFixed(2)),
          credits,
          createdAt: serverTimestamp(),
        });
        setDone(true);
        toast({
          title: "Paiement réussi",
          description: `Vous avez reçu ${credits.toLocaleString()} RC`,
        });
      } catch (e) {
        console.error(e);
      } finally {
        setProcessing(false);
        const url = new URL(window.location.href);
        url.searchParams.delete("success");
        url.searchParams.delete("sid");
        url.searchParams.delete("pack");
        window.history.replaceState({}, document.title, url.toString());
      }
    })();
  }, [user, promo]);

  const onBuy = (id: string) => {
    const pack = packs.find((p) => p.id === id)!;
    if (!user) {
      toast({
        title: "Connexion requise",
        description: "Veuillez vous connecter pour acheter des RotCoins.",
      });
      return;
    }
    setOpen(id);
  };

  return (
    <div className="container py-10">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold">
            Boutique RotCoins
          </h1>
          <p className="text-sm text-foreground/70">
            Achetez des crédits instantanément. Paiements sécurisés via Stripe.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-foreground/70">
          <Badge
            icon={<ShieldCheck className="h-4 w-4" />}
            text="Paiements sécurisés"
          />
          <Badge
            icon={<Zap className="h-4 w-4" />}
            text="Livraison instantanée"
          />
          <Badge
            icon={<BadgeDollarSign className="h-4 w-4" />}
            text="Meilleur prix"
          />
        </div>
      </header>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {packs.map((p) => (
          <div
            key={p.id}
            className="group relative overflow-hidden rounded-xl border border-border/60 bg-card p-5 shadow-[0_10px_30px_rgba(0,0,0,0.25)] transform transition-transform duration-300 hover:scale-[1.03] hover:-translate-y-1 hover:shadow-2xl"
          >
            {p.popular && (
              <span className="absolute left-0 top-3 rounded-r-md bg-secondary px-2 py-1 text-[10px] font-semibold">
                Populaire
              </span>
            )}
            {p.best && (
              <span className="absolute left-0 top-3 rounded-r-md bg-primary px-2 py-1 text-[10px] font-semibold">
                Meilleur prix
              </span>
            )}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-foreground/60">
                  {p.name}
                </div>
                <div className="mt-1 text-2xl font-extrabold">
                  {p.coins.toLocaleString()} RC
                </div>
                <div className="text-xs text-emerald-400 font-semibold">
                  Bonus +{p.bonus}%
                </div>
              </div>
              <div className="transform transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                <GoldCoin size={52} />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div className="text-foreground/80">
                {promo > 0 ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm line-through opacity-70">
                      {p.price.toFixed(2)}€
                    </span>
                    <span className="text-xl font-extrabold">
                      {(p.price * (1 - promo / 100)).toFixed(2)}€
                    </span>
                  </div>
                ) : (
                  <span className="text-xl font-extrabold">
                    {p.price.toFixed(2)}€
                  </span>
                )}
              </div>
              <Button
                size="sm"
                onClick={() => onBuy(p.id)}
                variant="secondary"
                disabled={processing}
              >
                Acheter
              </Button>
            </div>
            {open === p.id && (
              <div className="mt-4">
                {processing ? (
                  <div className="flex items-center gap-2 text-sm text-foreground/80">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-primary" />
                    Traitement du paiement…
                  </div>
                ) : done ? (
                  <div className="text-sm text-emerald-400 font-semibold">
                    Crédits ajoutés ✔
                  </div>
                ) : (
                  <div>
                    {promo > 0 && (
                      <div className="mb-2 text-xs text-foreground/70">
                        Promo: -{promo}%
                      </div>
                    )}
                    <StripeCheckout
                      amount={(p.price * (1 - promo / 100)).toFixed(2)}
                      currency="EUR"
                      packId={p.id}
                      description={p.name}
                      uid={user?.uid || null}
                      email={user?.email || null}
                    />
                  </div>
                )}
              </div>
            )}
            <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/5" />
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-xl border border-border/60 bg-card p-5">
        <h3 className="font-semibold">Moyens de paiement</h3>
        <div className="mt-3 flex items-center gap-3 text-foreground/70">
          <StripeLogo />
          <VisaLogo />
          <MastercardLogo />
        </div>
      </div>
    </div>
  );
}

function Badge({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-card/60 px-2 py-1">
      {icon}
      {text}
    </span>
  );
}

function GoldCoin({ size = 48 }: { size?: number }) {
  const src =
    "https://cdn.builder.io/api/v1/image/assets%2F7ca6692b844e492da4519bd1be30c27d%2F010980b0e1d0488b82cdd1e39f84e4d5?format=webp&width=800";
  return (
    <img
      src={src}
      alt="RotCoin"
      style={{ width: size, height: size }}
      className="object-contain"
    />
  );
}

function StripeLogo() {
  return (
    <svg
      width="52"
      height="20"
      viewBox="0 0 52 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="52" height="20" rx="4" fill="hsl(var(--muted))" />
      <text
        x="26"
        y="13"
        textAnchor="middle"
        fontSize="9"
        fontWeight="700"
        fill="hsl(var(--secondary))"
      >
        Stripe
      </text>
    </svg>
  );
}
function VisaLogo() {
  return (
    <svg
      width="44"
      height="20"
      viewBox="0 0 44 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="44" height="20" rx="4" fill="hsl(var(--muted))" />
      <text
        x="22"
        y="13"
        textAnchor="middle"
        fontSize="9"
        fontWeight="800"
        fill="hsl(var(--primary))"
      >
        VISA
      </text>
    </svg>
  );
}
function MastercardLogo() {
  return (
    <svg
      width="44"
      height="20"
      viewBox="0 0 44 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="44" height="20" rx="4" fill="hsl(var(--muted))" />
      <circle cx="18" cy="10" r="5" fill="#EB001B" />
      <circle cx="26" cy="10" r="5" fill="#F79E1B" />
    </svg>
  );
}
