import { useEffect, useRef, useState } from "react";

import React, { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    paypal?: any;
  }
}

export default function PayPalCheckout({
  amount,
  currency = "EUR",
  onSuccess,
}: {
  amount: string;
  currency?: string;
  onSuccess: (orderId: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [fallbackLoading, setFallbackLoading] = useState(false);
  const [fallbackError, setFallbackError] = useState<string | null>(null);
  const FALLBACK_PAYPAL_CLIENT_ID = "EDbaSQog99RXGYk9yW1-WBSslvtRvD5tf51RtiEUSE1rs5Fk9AktXNt6eUt3hWW1Yq9NqQqXKgzN0sLn";
  const clientId =
    (import.meta.env.VITE_PAYPAL_CLIENT_ID as string | undefined) ||
    FALLBACK_PAYPAL_CLIENT_ID;

  useEffect(() => {
    if (!clientId) return;

    const buildSrc = (cid: string) =>
      `https://www.paypal.com/sdk/js?${new URLSearchParams({
        "client-id": cid,
        currency,
        intent: "capture",
        commit: "true",
      }).toString()}`;

    let attempts = 0;
    const maxAttempts = 2;
    let mounted = true;
    let timeoutHandle: any;
    let currentScript: HTMLScriptElement | null = null;

    const cleanup = () => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      if (currentScript) {
        try {
          currentScript.removeEventListener("load", onLoad);
          currentScript.removeEventListener("error", onError);
        } catch {}
      }
    };

    const onLoad = () => {
      if (!mounted) return;
      if ((window as any).paypal) {
        setReady(true);
        cleanup();
      } else {
        console.error("PayPal script loaded but window.paypal is missing", {
          src: currentScript?.src,
          clientId,
        });
        setReady(false);
        cleanup();
      }
    };

    const onError = (ev: Event) => {
      if (!mounted) return;
      console.error("PayPal script failed to load:", JSON.stringify({
        src: currentScript?.src,
        clientId,
        error: (ev as any)?.message || ev,
      }));
      setReady(false);
      cleanup();
      // retry logic
      if (attempts < maxAttempts) {
        attempts += 1;
        // remove script element if present
        try {
          currentScript?.remove();
        } catch {}
        // retry after short delay
        setTimeout(loadScript, 800);
      }
    };

    const loadScript = () => {
      const src = buildSrc(clientId);
      // if an existing script already present with same src, reuse
      const existing = document.querySelector(`script[src^="https://www.paypal.com/sdk/js"]`) as HTMLScriptElement | null;
      if (existing && existing.getAttribute("data-paypal-client-id") === clientId) {
        currentScript = existing;
        // if paypal already loaded
        if ((window as any).paypal) {
          setReady(true);
          return;
        }
      } else {
        // remove any old paypal script to avoid conflicts
        if (existing) {
          try { existing.remove(); } catch {}
        }
        currentScript = document.createElement("script");
        currentScript.src = src;
        currentScript.async = true;
        currentScript.crossOrigin = "anonymous";
        try {
          currentScript.setAttribute("data-paypal-client-id", clientId);
        } catch {}
        document.body.appendChild(currentScript);
      }

      currentScript.addEventListener("load", onLoad);
      currentScript.addEventListener("error", onError);

      // timeout fallback
      timeoutHandle = setTimeout(() => {
        if (!(window as any).paypal) {
          console.error("PayPal SDK load timed out:", JSON.stringify({ src: currentScript?.src, clientId }));
          setReady(false);
          // attempt retry
          if (attempts < maxAttempts) {
            attempts += 1;
            try { currentScript?.remove(); } catch {}
            setTimeout(loadScript, 800);
          }
        }
      }, 20000);
    };

    loadScript();

    return () => {
      mounted = false;
      cleanup();
    };
  }, [clientId, currency]);

  useEffect(() => {
    if (!ready || !window.paypal || !ref.current) return;
    const buttons = window.paypal.Buttons({
      style: {
        layout: "horizontal",
        color: "blue",
        shape: "pill",
        label: "pay",
      },
      createOrder: (_: any, actions: any) =>
        actions.order.create({
          intent: "CAPTURE",
          application_context: {
            brand_name:
              (import.meta.env.VITE_PAYPAL_APP_NAME as string) ||
              "BrainrotMarket",
          },
          purchase_units: [{ amount: { value: amount } }],
        }),
      onApprove: async (_: any, actions: any) => {
        try {
          const details = await actions.order.capture();
          onSuccess(details.id);
        } catch (err) {
          console.error("PayPal onApprove error", err);
        }
      },
    });
    try {
      buttons.render(ref.current);
    } catch (err) {
      console.error("PayPal render failed", err);
      setReady(false);
    }
    return () => {
      try {
        buttons.close();
      } catch {}
    };
  }, [ready, amount, currency, onSuccess]);

  if (!clientId) {
    return (
      <div className="rounded-md border border-border/60 bg-card p-3 text-sm text-foreground/80">
        PayPal non configuré. Ajoutez VITE_PAYPAL_CLIENT_ID dans les variables
        d'environnement puis rechargez.
      </div>
    );
  }

  // If SDK ready, render buttons container
  if (ready) return <div ref={ref} />;

  // Fallback: create order via server and open approve URL in a new window
  const createOrderFallback = async () => {
    setFallbackError(null);
    setFallbackLoading(true);
    try {
      const resp = await fetch("/api/paypal/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, currency }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data?.message || data?.error || "create_order_failed");
      }
      const url = data.approveUrl || data.order?.links?.find((l: any) => l.rel === "approve")?.href;
      if (!url) throw new Error("approve_url_missing");
      // open approval in a new tab/window
      window.open(url, "_blank", "noopener,noreferrer");
      // notify user that payment will be processed via webhook
      setFallbackLoading(false);
      setFallbackError(null);
      // Give feedback to the UI: the server/webhook will process the capture and update user credits
      return;
    } catch (e: any) {
      console.error("createOrderFallback failed", e);
      setFallbackError(String(e?.message || e));
      setFallbackLoading(false);
    }
  };

  return (
    <div>
      <div className="rounded-md border border-border/60 bg-card p-3 text-sm text-foreground/80">
        <div>Le bouton PayPal n'a pas pu se charger. Vous pouvez ouvrir le paiement dans une nouvelle fenêtre.</div>
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={createOrderFallback}
            disabled={fallbackLoading}
            className="rounded-md bg-primary px-3 py-2 text-white"
          >
            {fallbackLoading ? "Ouverture…" : "Payer via PayPal"}
          </button>
          {fallbackError && <div className="text-sm text-destructive">Erreur: {fallbackError}</div>}
        </div>
      </div>
    </div>
  );
}
