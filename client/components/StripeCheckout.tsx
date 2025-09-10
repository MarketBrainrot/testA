import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function StripeCheckout({
  amount,
  currency = "EUR",
  packId,
  description,
  uid,
  email,
}: {
  amount: string | number;
  currency?: string;
  packId?: string;
  description?: string;
  uid?: string | null;
  email?: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createSession = async () => {
    setError(null);
    setLoading(true);
    try {
      const origin = window.location.origin;
      const resp = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          currency,
          packId,
          description,
          uid,
          email,
          success_url: `${origin}/shop`,
          cancel_url: `${origin}/shop`,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || data?.message || "request_failed");
      if (!data?.url) throw new Error("no_session_url");
      window.location.href = data.url as string;
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button onClick={createSession} disabled={loading} size="sm" variant="secondary">
        {loading ? "Redirection…" : "Payer avec Stripe"}
      </Button>
      {error && <span className="text-xs text-destructive">Erreur: {error}</span>}
    </div>
  );
}
