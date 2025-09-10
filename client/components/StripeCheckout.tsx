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
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
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

      // Read JSON once
      let data: any = null;
      try {
        data = await resp.json();
      } catch (e) {
        // If parsing JSON fails, provide helpful error
        const txt = await resp.text().catch(() => "");
        throw new Error(
          data?.error || data?.message || txt || "invalid_json_response",
        );
      }

      if (!resp.ok)
        throw new Error(data?.error || data?.message || "request_failed");

      const sessionId = data?.id as string | undefined;
      if (!sessionId) throw new Error("no_session_id_returned");

      // Load Stripe.js and redirect using the public key
      const key =
        (import.meta.env.VITE_STRIPE_PUBLIC_KEY as string | undefined) ||
        (window as any).__STRIPE_PUBLIC_KEY;
      if (!key) throw new Error("stripe_public_key_not_configured");

      // Ensure Stripe.js loaded
      if (!(window as any).Stripe) {
        const s = document.createElement("script");
        s.src = "https://js.stripe.com/v3/";
        s.async = true;
        document.head.appendChild(s);
        await new Promise((res) => {
          s.onload = res;
          s.onerror = res;
        });
      }

      const stripe = (window as any).Stripe(key);
      const { error: stripeError } = await stripe.redirectToCheckout({
        sessionId,
      });
      if (stripeError)
        throw new Error(stripeError.message || "stripe_redirect_failed");
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={createSession}
        disabled={loading}
        size="sm"
        variant="secondary"
      >
        {loading ? "Redirection…" : "Payer avec Stripe"}
      </Button>
      {error && (
        <span className="text-xs text-destructive">Erreur: {error}</span>
      )}
    </div>
  );
}
