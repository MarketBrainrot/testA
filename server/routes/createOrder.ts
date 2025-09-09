import type { RequestHandler } from "express";

const PAYPAL_API = "https://api-m.paypal.com";

async function getAccessToken(clientId: string, secret: string) {
  const auth = Buffer.from(`${clientId}:${secret}`).toString("base64");
  const res = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Failed to obtain PayPal token: ${res.status} ${txt}`);
  }
  const data = await res.json();
  return data.access_token as string;
}

export const createOrder: RequestHandler = async (req, res) => {
  try {
    const { amount, currency = "EUR", return_url, cancel_url, custom_id } = req.body as any;
    const clientId = process.env.VITE_PAYPAL_CLIENT_ID || process.env.PAYPAL_CLIENT_ID;
    const secret = process.env.PAYPAL_CLIENT_SECRET || process.env.VITE_PAYPAL_CLIENT_SECRET;
    if (!clientId || !secret) return res.status(400).json({ error: "paypal_not_configured" });

    if (!amount) return res.status(400).json({ error: "missing_amount" });

    const accessToken = await getAccessToken(clientId, secret);

    const orderBody: any = {
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: currency,
            value: Number(amount).toFixed(2),
          },
        },
      ],
    };
    if (custom_id) orderBody.purchase_units[0].custom_id = String(custom_id);
    if (return_url || cancel_url) {
      orderBody.application_context = {
        return_url: return_url || undefined,
        cancel_url: cancel_url || undefined,
      };
    }

    const createRes = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderBody),
    });

    if (!createRes.ok) {
      const txt = await createRes.text();
      console.error("PayPal create order failed:", createRes.status, txt);
      return res.status(500).json({ error: "create_order_failed", details: txt });
    }

    const order = await createRes.json();
    // find approval link
    const approve = (order.links || []).find((l: any) => l.rel === "approve");
    res.json({ order, approveUrl: approve?.href || null });
  } catch (e: any) {
    console.error("createOrder error", e?.message || e);
    res.status(500).json({ error: "server_error", message: e?.message });
  }
};
