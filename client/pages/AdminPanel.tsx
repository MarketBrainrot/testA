import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  addDoc,
  deleteDoc,
  arrayUnion,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import { useProfile } from "@/context/ProfileProvider";
import { useAuth } from "@/context/AuthProvider";

const ROLES = ["user", "verified", "helper", "moderator", "founder"] as const;

type Role = (typeof ROLES)[number];

function AdminLogin({ onOk }: { onOk: () => void }) {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  return (
    <div className="container max-w-sm py-16">
      <h1 className="font-display text-2xl font-bold">Admin Login</h1>
      <div className="mt-4 space-y-3">
        <Input
          placeholder="Identifiant"
          value={u}
          onChange={(e) => setU(e.target.value)}
        />
        <Input
          type="password"
          placeholder="Mot de passe"
          value={p}
          onChange={(e) => setP(e.target.value)}
        />
        <Button
          onClick={() => {
            if (u === "Admin" && p === "Antoine80@") {
              localStorage.setItem("brm_admin", "1");
              onOk();
            }
          }}
        >
          Se connecter
        </Button>
      </div>
    </div>
  );
}

export default function AdminPanel() {
  const [ok, setOk] = useState<boolean>(
    () => localStorage.getItem("brm_admin") === "1",
  );
  const { toast } = useToast();
  const { role } = useProfile();
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<any | null>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [filter, setFilter] = useState("");
  const [activeTicket, setActiveTicket] = useState<string | null>(null);
  const [ticketMsgs, setTicketMsgs] = useState<any[]>([]);
  const [reply, setReply] = useState("");
  const [promo, setPromo] = useState<number>(0);
  const [announcement, setAnnouncement] = useState("");
  const [banDays, setBanDays] = useState<number>(0);
  const [banHours, setBanHours] = useState<number>(0);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [savingRole, setSavingRole] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [searching, setSearching] = useState(false);
  const [warnOpen, setWarnOpen] = useState(false);
  const [warnReason, setWarnReason] = useState("");
  const WARN_PRESETS = [
    "Comportement inapproprié",
    "Violation des règles",
    "Spam / Publicité",
    "Autre (préciser)",
  ];

  const sendWarning = async (targetUserId: string, reason: string) => {
    try {
      await updateDoc(doc(db, "users", targetUserId), {
        notifications: arrayUnion({
          type: "warn",
          text: `Avertissement: ${reason}`,
          reason,
          createdAt: Timestamp.now(),
          read: false,
        }),
      });
      toast({ title: "Avertissement envoyé" });
    } catch (e) {
      console.error("sendWarning failed", e);
      toast({ title: "Erreur envoi avertissement", variant: "destructive" });
    }
  };

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoadingUsers(false);
    });
    return () => unsub();
  }, []);

  // load product count and maintenance flag for founder
  useEffect(() => {
    let unsubProducts: any = () => {};
    const maintRef = doc(db, "maintenance", "global");
    const unsubMeta = onSnapshot(maintRef, (d) => {
      const data = d.data() as any | undefined;
      const toggle = document.getElementById(
        "maintenance-toggle",
      ) as HTMLInputElement | null;
      const scope = document.getElementById(
        "maintenance-scope",
      ) as HTMLSelectElement | null;
      const msg = document.getElementById(
        "maintenance-message",
      ) as HTMLInputElement | null;
      if (toggle) toggle.checked = Boolean(data?.on);
      if (scope && data?.scope) scope.value = data.scope;
      if (msg && data?.message) msg.value = data.message;
    });

    (async () => {
      const snap = await getDocs(query(collection(db, "products")));
      const count = snap.size;
      const el = document.getElementById("product-count");
      if (el) el.textContent = `${count} produit(s) actifs`;

      // subscribe to products to update count live
      const q = query(collection(db, "products"));
      unsubProducts = onSnapshot(q, (s) => {
        const c = s.docs.filter(
          (d) => (d.data() as any).status === "active",
        ).length;
        const el2 = document.getElementById("product-count");
        if (el2) el2.textContent = `${c} produit(s) actifs`;
      });
    })();

    const scopeSelect = document.getElementById(
      "maintenance-scope",
    ) as HTMLSelectElement | null;
    const toggle = document.getElementById(
      "maintenance-toggle",
    ) as HTMLInputElement | null;
    const onChange = async () => {
      if (!toggle) return;
      try {
        const scope = scopeSelect?.value || "global";
        let message = "";
        if (toggle.checked) {
          message =
            (
              document.getElementById("maintenance-message") as HTMLInputElement
            )?.value?.trim?.() || "";
          if (!message) {
            // default messages per scope
            const defaults: Record<string, string> = {
              global: "Site en maintenance. Retour rapide.",
              marketplace: "Marketplace momentanément indisponible.",
              shop: "Boutique en maintenance.",
              tickets: "Service support momentanément indisponible.",
            };
            message = defaults[scope] || "Maintenance en cours";
          }
        }
        // write to maintenance/global for a clear global maintenance document
        const maintRef2 = doc(db, "maintenance", "global");
        await setDoc(
          maintRef2,
          { on: toggle.checked, scope, message },
          { merge: true },
        );
        toast({
          title: `Maintenance ${toggle.checked ? "activée" : "désactivée"}`,
        });
      } catch (e) {
        console.error("set maintenance failed", e);
      }
    };
    toggle?.addEventListener("change", onChange);
    scopeSelect?.addEventListener("change", onChange);

    return () => {
      unsubMeta();
      unsubProducts && unsubProducts();
      toggle?.removeEventListener("change", onChange);
      scopeSelect?.removeEventListener("change", onChange);
    };
  }, [toast]);

  // Users overview table for easier management

  useEffect(() => {
    if (!userId) return;
    const unsub = onSnapshot(doc(db, "users", userId), (d) => {
      if (d.exists()) {
        const data = { id: d.id, ...d.data() } as any;
        setUserInfo(data);
        if (selectedRole == null)
          setSelectedRole((data.role ?? "user") as Role);
      }
    });
    return () => unsub();
  }, [userId]);

  useEffect(() => {
    const q = query(
      collection(db, "tickets"),
      where("status", "in", ["open", "pending"]),
    );
    const unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setTickets(rows);
      if (!activeTicket && rows.length) setActiveTicket(rows[0].id);
    });
    return () => unsub();
  }, [activeTicket]);

  useEffect(() => {
    if (!activeTicket) return;
    const unsub = onSnapshot(
      collection(db, "tickets", activeTicket, "messages"),
      (snap) => {
        setTicketMsgs(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })),
        );
      },
    );
    return () => unsub();
  }, [activeTicket]);

  const findUser = async () => {
    try {
      setSearching(true);
      const q = query(collection(db, "users"), where("email", "==", email));
      const res = await getDocs(q);
      if (!res.empty) {
        const d = res.docs[0];
        setUserId(d.id);
        setUserInfo(d.data());
        setSelectedRole(((d.data() as any).role ?? "user") as Role);
        toast({
          title: "Utilisateur trouvé",
          description: (d.data() as any).email,
        });
      } else {
        toast({ title: "Introuvable", description: email });
      }
    } finally {
      setSearching(false);
    }
  };

  const saveRole = async () => {
    if (!userId || !selectedRole) return;
    try {
      setSavingRole(true);
      await setDoc(
        doc(db, "users", userId),
        { role: selectedRole, updatedAt: serverTimestamp() },
        { merge: true },
      );

      // add a notification to the user about their new role
      try {
        await updateDoc(doc(db, "users", userId), {
          notifications: arrayUnion({
            type: "role",
            role: selectedRole,
            text: `Vous avez reçu le rôle ${selectedRole}`,
            createdAt: Timestamp.now(),
            read: false,
          }),
        });
      } catch (e) {
        console.error("notify role change failed", e);
      }

      toast({ title: "Rôle sauvegardé", description: `${selectedRole}` });
    } finally {
      setSavingRole(false);
    }
  };

  const { user: currentUser } = useAuth();

  const adjustCredits = async (amount: number) => {
    if (!userId) return;
    try {
      setAdjusting(true);

      // Atomically increment balances.available on user doc
      await updateDoc(doc(db, "users", userId), {
        "balances.available": increment(amount),
      } as any);

      // Create a transaction record to keep history and show admin as giver
      try {
        await addDoc(collection(db, "transactions"), {
          uid: userId,
          type: "admin_grant",
          credits: amount,
          adminId: currentUser?.uid || "admin",
          adminName: currentUser?.displayName || currentUser?.email || "admin",
          note: `Grant by admin ${currentUser?.displayName || currentUser?.email || "admin"}`,
          status: "completed",
          createdAt: serverTimestamp(),
        });
      } catch (e) {
        console.error("admin:create transaction failed", e);
      }

      toast({
        title: "Crédits modifiés",
        description: `${amount > 0 ? "+" : ""}${amount} RC`,
      });
    } finally {
      setAdjusting(false);
    }
  };

  const createTicket = async (title: string, body: string) => {
    const ref = doc(collection(db, "tickets"));
    await setDoc(ref, {
      title,
      body,
      status: "open",
      createdAt: serverTimestamp(),
    });
  };
  const sendReply = async () => {
    if (!activeTicket || !reply.trim()) return;
    try {
      await setDoc(doc(collection(db, "tickets", activeTicket, "messages")), {
        text: reply.trim(),
        senderId: currentUser?.uid || "admin",
        senderName: currentUser?.displayName || currentUser?.email || "admin",
        senderRole: role || "admin",
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "tickets", activeTicket), {
        updatedAt: serverTimestamp(),
        status: "pending",
      });
      setReply("");
    } catch (e) {
      console.error("ticket:reply failed", e);
    }
  };
  const closeTicket = async (id: string, reason = "Closed by staff") => {
    try {
      await updateDoc(doc(db, "tickets", id), {
        status: "closed",
        closeReason: reason,
        closedAt: serverTimestamp(),
      });
      toast({ title: "Ticket fermé" });
    } catch (e) {
      console.error("ticket:close failed", e);
    }
  };

  const deleteTicket = async (id: string) => {
    if (!id) return;
    try {
      await deleteDoc(doc(db, "tickets", id));
      toast({ title: "Ticket supprimé" });
      if (activeTicket === id) setActiveTicket(null);
    } catch (e) {
      console.error("ticket:delete failed", e);
      toast({ title: "Erreur suppression" });
    }
  };

  if (!ok) return <AdminLogin onOk={() => setOk(true)} />;

  if (role === "user" || role === "verified") {
    return (
      <div className="container py-10">
        <h1 className="font-display text-2xl font-bold">Accès refus��</h1>
        <p className="text-sm text-foreground/70">
          Vous n'avez pas les permissions pour accéder à l'Admin Panel.
        </p>
      </div>
    );
  }

  return (
    <div className="container py-10">
      <h1 className="font-display text-3xl font-extrabold">Admin Panel</h1>
      <p className="text-sm text-foreground/70">
        CTRL + F1 pour ouvrir rapidement cet écran.
      </p>

      {/* Users overview - big table */}
      <div className="mt-6 rounded-xl border border-border/60 bg-card p-4">
        <h2 className="font-semibold mb-3">Utilisateurs (aperçu)</h2>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-foreground/60">
                <th className="p-2">Email / Nom</th>
                <th className="p-2">Rôle</th>
                <th className="p-2">Crédits</th>
                <th className="p-2">Ventes</th>
                <th className="p-2">Achats</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-border/50">
                  <td className="p-2">{u.displayName || u.email || u.id}</td>
                  <td className="p-2">{u.role}</td>
                  <td className="p-2">
                    {(u.balances?.available || 0).toLocaleString()} RC
                  </td>
                  <td className="p-2">
                    {Number(u.sales || u.stats?.sales || 0)}
                  </td>
                  <td className="p-2">
                    {Number(u.purchases || u.stats?.purchases || 0)}
                  </td>
                  <td className="p-2">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          setUserId(u.id);
                          setUserInfo(u);
                          setSelectedRole((u.role ?? "user") as any);
                          window.scrollTo({ top: 400, behavior: "smooth" });
                        }}
                      >
                        Gérer
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border/60 bg-card p-3 md:col-span-1">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Filtrer par email/nom"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          {loadingUsers ? (
            <div className="mt-3 text-sm text-foreground/70">Chargement…</div>
          ) : (
            <div className="mt-2 max-h-80 overflow-auto divide-y divide-border/50">
              {users
                .filter((u) => {
                  const q = filter.toLowerCase();
                  if (!q) return true;
                  return (
                    (u.email ?? "").toLowerCase().includes(q) ||
                    (u.displayName ?? "").toLowerCase().includes(q) ||
                    (u.role ?? "").toLowerCase().includes(q)
                  );
                })
                .map((u) => (
                  <button
                    key={u.id}
                    onClick={() => {
                      setUserId(u.id);
                      setUserInfo(u);
                      setSelectedRole((u.role ?? "user") as Role);
                    }}
                    className={`w-full text-left px-2 py-2 hover:bg-muted transition-colors ${
                      userId === u.id ? "bg-muted" : ""
                    }`}
                  >
                    <div className="text-sm">
                      {u.displayName || u.email || u.id}
                    </div>
                    <div className="text-xs text-foreground/60">
                      {(u.role ?? "user").toString()} ·{" "}
                      {(u.credits ?? 0).toLocaleString()} RC
                    </div>
                  </button>
                ))}
            </div>
          )}
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4 md:col-span-2">
          <div className="flex flex-wrap items-end gap-2">
            <Input
              placeholder="Email utilisateur"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-64"
            />
            <Button onClick={findUser} disabled={searching}>
              {searching ? "Recherche…" : "Rechercher"}
            </Button>
            {userInfo && (
              <div className="text-sm text-foreground/80">
                {userInfo.displayName || userInfo.email}
              </div>
            )}
          </div>

          {/* Notifications management for selected user */}
          {userInfo && (
            <div className="mt-3">
              <h4 className="text-sm font-semibold">
                Notifications utilisateur
              </h4>
              <div className="mt-2 space-y-2">
                {Array.isArray(userInfo.notifications) &&
                userInfo.notifications.length > 0 ? (
                  userInfo.notifications
                    .slice()
                    .reverse()
                    .map((n: any, i: number) => (
                      <div
                        key={i}
                        className="rounded-md border border-border/60 bg-card p-2 flex items-start justify-between gap-3"
                      >
                        <div className="text-sm">
                          <div className="font-medium">
                            {n.title ||
                              (n.type === "role"
                                ? `Rôle: ${n.role}`
                                : n.type === "warn"
                                  ? "Avertissement"
                                  : n.type || "Notification")}
                          </div>
                          <div className="text-xs text-foreground/70 mt-1">
                            {n.text || JSON.stringify(n).slice(0, 150)}
                          </div>
                          <div className="text-xs text-foreground/60 mt-1">
                            {n.createdAt
                              ? n.createdAt.toDate
                                ? n.createdAt.toDate().toLocaleString()
                                : String(n.createdAt)
                              : ""}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <button
                            className="text-xs text-destructive"
                            onClick={async () => {
                              try {
                                const ref = doc(db, "users", userInfo.id);
                                const cur = Array.isArray(
                                  userInfo.notifications,
                                )
                                  ? userInfo.notifications.slice()
                                  : [];
                                // find the item to remove by index from original array (reverse order mapping)
                                const realIndex = cur.length - 1 - i;
                                cur.splice(realIndex, 1);
                                await updateDoc(ref, { notifications: cur });
                                toast({ title: "Notification supprimée" });
                              } catch (e) {
                                console.error(
                                  "admin: remove notification failed",
                                  e,
                                );
                                toast({
                                  title: "Erreur",
                                  variant: "destructive",
                                });
                              }
                            }}
                          >
                            Supprimer
                          </button>
                        </div>
                      </div>
                    ))
                ) : (
                  <div className="text-sm text-foreground/70">
                    Aucune notification
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        const ref = doc(db, "users", userInfo.id);
                        await updateDoc(ref, { notifications: [] });
                        toast({ title: "Notifications effacées" });
                      } catch (e) {
                        console.error("admin: clear notifications failed", e);
                        toast({ title: "Erreur", variant: "destructive" });
                      }
                    }}
                  >
                    Effacer toutes
                  </Button>
                </div>
              </div>
            </div>
          )}

          {userId && (
            <div className="mt-4">
              {role === "moderator" || role === "founder" ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-foreground/70">Rôle:</span>
                  {ROLES.map((r) => (
                    <Button
                      key={r}
                      size="sm"
                      variant={selectedRole === r ? "default" : "outline"}
                      onClick={() => setSelectedRole(r as Role)}
                    >
                      {r}
                    </Button>
                  ))}
                  <Button
                    size="sm"
                    className="ml-2"
                    onClick={saveRole}
                    disabled={savingRole}
                  >
                    {savingRole ? "Sauvegarde…" : "Sauvegarder"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-2"
                    onClick={() => setWarnOpen(true)}
                  >
                    Avertir
                  </Button>
                  <span className="ml-4 text-xs text-foreground/70">
                    Crédits:
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => adjustCredits(100)}
                    disabled={adjusting}
                  >
                    {adjusting ? "…" : "+100"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => adjustCredits(1000)}
                    disabled={adjusting}
                  >
                    {adjusting ? "…" : "+1000"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => adjustCredits(-100)}
                    disabled={adjusting}
                  >
                    {adjusting ? "…" : "-100"}
                  </Button>
                </div>
              ) : (
                <div className="mt-2 text-sm text-foreground/70">
                  Vous n'avez pas la permission de modifier les rôles ou
                  crédits.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Tabs
        defaultValue={
          role === "founder"
            ? "founder"
            : role === "moderator"
              ? "moderator"
              : "helper"
        }
        className="mt-8"
      >
        <TabsList>
          {(role === "helper" ||
            role === "moderator" ||
            role === "founder") && (
            <TabsTrigger value="helper">Helper</TabsTrigger>
          )}
          {(role === "moderator" || role === "founder") && (
            <TabsTrigger value="moderator">Modérateur</TabsTrigger>
          )}
          {role === "founder" && (
            <TabsTrigger value="founder">Fondateur</TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="helper">
          <div className="grid gap-3 md:grid-cols-[300px,1fr]">
            <div className="rounded-xl border border-border/60 bg-card p-4">
              <h3 className="font-semibold">Tickets (ouverts)</h3>
              <div className="mt-3 max-h-[60vh] overflow-auto divide-y divide-border/60">
                {tickets.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTicket(t.id)}
                    className={`w-full text-left px-2 py-2 hover:bg-muted ${activeTicket === t.id ? "bg-muted" : ""}`}
                  >
                    <div className="text-sm font-semibold">{t.title}</div>
                    <div className="text-xs text-foreground/70 capitalize">
                      {t.status}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-border/60 bg-card p-4">
              <h3 className="font-semibold">Chat</h3>
              {role === "founder" && (
                <div className="mt-4">
                  <h4 className="font-medium">
                    Envoyer un message global (système)
                  </h4>
                  <div className="mt-2 grid gap-2">
                    <Input
                      placeholder="Titre (optionnel)"
                      id="broadcast-title"
                    />
                    <Input placeholder="Message système" id="broadcast-text" />
                    <div className="flex items-center gap-2">
                      <Button
                        id="broadcast-send"
                        onClick={async () => {
                          const titleEl = document.getElementById(
                            "broadcast-title",
                          ) as HTMLInputElement | null;
                          const textEl = document.getElementById(
                            "broadcast-text",
                          ) as HTMLInputElement | null;
                          const msg = textEl?.value?.trim();
                          const title =
                            titleEl?.value?.trim() || "Message système";
                          if (!msg) {
                            toast({
                              title: "Message vide",
                              description: "Entrez le texte du message",
                              variant: "destructive",
                            });
                            return;
                          }
                          try {
                            // fetch all users
                            const usersSnap = await getDocs(
                              query(collection(db, "users")),
                            );
                            for (const d of usersSnap.docs) {
                              const u = { id: d.id, ...(d.data() as any) };
                              const threadId = `system_${u.id}`;
                              // create or update thread doc
                              await setDoc(
                                doc(db, "threads", threadId),
                                {
                                  participants: [u.id],
                                  title,
                                  system: true,
                                  lastMessage: {
                                    text: msg,
                                    senderId: "system",
                                  },
                                  updatedAt: serverTimestamp(),
                                },
                                { merge: true },
                              );
                              // add the system message
                              await addDoc(
                                collection(db, "threads", threadId, "messages"),
                                {
                                  senderId: "system",
                                  text: msg,
                                  createdAt: serverTimestamp(),
                                },
                              );
                              // notify user
                              try {
                                await updateDoc(doc(db, "users", u.id), {
                                  notifications: arrayUnion({
                                    type: "thread",
                                    threadId,
                                    text: msg,
                                    createdAt: Timestamp.now(),
                                    system: true,
                                  }),
                                });
                              } catch (e) {}
                            }
                            toast({ title: "Message envoyé" });
                            if (textEl) textEl.value = "";
                            if (titleEl) titleEl.value = "";
                          } catch (e) {
                            console.error("broadcast failed", e);
                            toast({
                              title: "Erreur",
                              description:
                                "Impossible d'envoyer le message global",
                              variant: "destructive",
                            });
                          }
                        }}
                      >
                        Envoyer globalement
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              {activeTicket ? (
                <div className="flex h-[60vh] flex-col">
                  <div className="flex-1 space-y-2 overflow-auto">
                    {ticketMsgs.map((m) => (
                      <div
                        key={m.id}
                        className={`max-w-[70%] rounded-md px-3 py-2 text-sm ${m.senderId === currentUser?.uid ? "ml-auto bg-secondary/20" : "bg-muted"}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className="text-xs text-foreground/60">
                            {m.senderName ||
                              (m.senderId === "admin"
                                ? "Admin"
                                : "Utilisateur")}
                          </div>
                          {m.senderRole && m.senderRole !== "user" && (
                            <div className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">
                              {m.senderRole}
                            </div>
                          )}
                        </div>
                        {m.text}
                      </div>
                    ))}
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <Input
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      placeholder="Réponse…"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") sendReply();
                      }}
                    />
                    <Button size="sm" onClick={sendReply}>
                      Envoyer
                    </Button>
                    {/* Close allowed for helpers+ */}
                    {(role === "helper" ||
                      role === "moderator" ||
                      role === "founder") && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => closeTicket(activeTicket)}
                      >
                        Fermer
                      </Button>
                    )}
                    {/* Delete only for moderator/founder */}
                    {(role === "moderator" || role === "founder") && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteTicket(activeTicket)}
                      >
                        Supprimer
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-foreground/70">
                  Sélectionnez un ticket.
                </div>
              )}
            </div>
          </div>
        </TabsContent>
        <TabsContent value="moderator">
          <div className="rounded-xl border border-border/60 bg-card p-4">
            <h3 className="font-semibold">Modération</h3>
            <p className="text-sm text-foreground/70">
              Bannir / avertir via mise à jour du document utilisateur.
            </p>
            {userId ? (
              <div className="mt-3 grid gap-2">
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="Jours"
                    value={banDays}
                    onChange={(e) => setBanDays(Number(e.target.value))}
                    className="w-24"
                  />
                  <Input
                    type="number"
                    placeholder="Heures"
                    value={banHours}
                    onChange={(e) => setBanHours(Number(e.target.value))}
                    className="w-24"
                  />
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={userId === currentUser?.uid}
                    onClick={async () => {
                      if (userId === currentUser?.uid) {
                        toast({
                          title: "Action interdite",
                          description: "Vous ne pouvez pas vous auto-bannir.",
                          variant: "destructive",
                        });
                        return;
                      }
                      const ms = (banDays * 24 + banHours) * 60 * 60 * 1000;
                      const until = new Date(Date.now() + ms);
                      await setDoc(
                        doc(db, "users", userId),
                        { bannedUntil: until },
                        { merge: true },
                      );
                      toast({ title: "Ban temporaire appliqué" });
                    }}
                  >
                    Ban temporaire
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={userId === currentUser?.uid}
                    onClick={async () => {
                      if (userId === currentUser?.uid) {
                        toast({
                          title: "Action interdite",
                          description: "Vous ne pouvez pas vous auto-bannir.",
                          variant: "destructive",
                        });
                        return;
                      }
                      await setDoc(
                        doc(db, "users", userId),
                        { banned: true, bannedAt: serverTimestamp() },
                        { merge: true },
                      );
                      toast({ title: "Ban permanent" });
                    }}
                  >
                    Ban permanent
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={userId === currentUser?.uid}
                    onClick={async () => {
                      if (userId === currentUser?.uid) {
                        toast({
                          title: "Action interdite",
                          description:
                            "Vous ne pouvez pas lever votre propre ban via cet écran.",
                          variant: "destructive",
                        });
                        return;
                      }
                      await setDoc(
                        doc(db, "users", userId),
                        { banned: false, bannedUntil: null },
                        { merge: true },
                      );
                      toast({ title: "Ban levé" });
                    }}
                  >
                    Lever
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await setDoc(
                        doc(db, "users", userId),
                        { warnings: increment(1) },
                        { merge: true },
                      );
                      toast({ title: "Avertissement envoyé" });
                    }}
                  >
                    Warn
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-sm text-foreground/70">
                Recherchez un utilisateur ci-dessus.
              </div>
            )}
          </div>
        </TabsContent>
        <TabsContent value="founder">
          <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
            <h3 className="font-semibold">Fondateur</h3>
            <div>
              <div className="text-sm font-semibold">Etat Marketplace</div>
              <div className="mt-2 text-sm text-foreground/70">
                <span id="product-count">Chargement…</span>
              </div>
              <div className="mt-2">
                <div className="space-y-2">
                  <label className="inline-flex items-center gap-2">
                    <input
                      id="maintenance-toggle"
                      type="checkbox"
                      className="rounded"
                    />{" "}
                    Activer le mode maintenance
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      id="maintenance-scope"
                      className="rounded-md bg-background px-2 py-1 border border-border/60"
                    >
                      <option value="global">Global (tout le site)</option>
                      <option value="marketplace">Marketplace</option>
                      <option value="shop">Boutique</option>
                      <option value="tickets">Tickets</option>
                    </select>
                    <input
                      id="maintenance-message"
                      className="flex-1 rounded-md bg-background px-3 py-2 border border-border/60"
                      placeholder="Message affiché pendant la maintenance"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div>
              <div className="text-sm font-semibold">Annonce globale</div>
              <Input
                placeholder="Message à afficher"
                value={announcement}
                onChange={(e) => setAnnouncement(e.target.value)}
              />
              <Button
                className="mt-2"
                size="sm"
                onClick={async () => {
                  await setDoc(doc(collection(db, "announcements")), {
                    text: announcement,
                    createdAt: serverTimestamp(),
                  });
                  setAnnouncement("");
                  toast({ title: "Annonce publiée" });
                }}
              >
                Publier
              </Button>
              {role === "founder" && (
                <div className="mt-3">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={async () => {
                      if (
                        !confirm(
                          "Effacer toutes les notifications pour tous les utilisateurs ?",
                        )
                      )
                        return;
                      try {
                        const usersSnap = await getDocs(
                          query(collection(db, "users")),
                        );
                        const batch = writeBatch(db);
                        usersSnap.docs.forEach((d) => {
                          const ref = doc(db, "users", d.id);
                          batch.update(ref, { notifications: [] });
                        });
                        await batch.commit();
                        toast({
                          title:
                            "Notifications de tous les utilisateurs effacées",
                        });
                      } catch (e) {
                        console.error(
                          "admin: clear all notifications failed",
                          e,
                        );
                        toast({ title: "Erreur", variant: "destructive" });
                      }
                    }}
                  >
                    Effacer notifications (tous utilisateurs)
                  </Button>
                </div>
              )}
            </div>
            <div>
              <div className="text-sm font-semibold">
                Promotions RotCoins (%)
              </div>
              <Input
                type="number"
                placeholder="Réduction % pour tous les packs"
                value={promo}
                onChange={(e) => setPromo(Number(e.target.value))}
                className="w-40"
              />
              <Button
                className="ml-2"
                size="sm"
                onClick={async () => {
                  await setDoc(
                    doc(db, "promotions", "packs"),
                    { all: Number(promo) || 0 },
                    { merge: true },
                  );
                  toast({ title: "Promo mise à jour" });
                }}
              >
                Appliquer
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Warn modal */}
      {warnOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
          <div className="rounded-xl bg-card p-4 w-full max-w-md">
            <h3 className="font-semibold">Avertir l'utilisateur</h3>
            <div className="mt-3 space-y-2">
              <div className="text-sm text-foreground/70">Raison</div>
              <div className="flex flex-wrap gap-2">
                {WARN_PRESETS.map((p) => (
                  <button
                    key={p}
                    className={`px-3 py-2 rounded-md border ${warnReason === p ? "border-primary bg-primary/10" : "border-border/60"}`}
                    onClick={() => setWarnReason(p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <Input
                placeholder="Précisez si 'Autre'"
                value={warnReason}
                onChange={(e) => setWarnReason(e.target.value)}
              />
              <div className="mt-3 flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setWarnOpen(false);
                    setWarnReason("");
                  }}
                >
                  Annuler
                </Button>
                <Button
                  onClick={async () => {
                    if (!userId) return;
                    await sendWarning(userId, warnReason || "Avertissement");
                    setWarnOpen(false);
                    setWarnReason("");
                  }}
                >
                  Envoyer avertissement
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CreateTicket({
  onCreate,
}: {
  onCreate: (title: string, body: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  return (
    <div className="space-y-2">
      <Input
        placeholder="Titre"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <Input
        placeholder="Message"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <Button
        onClick={() => {
          if (title) {
            onCreate(title, body);
            setTitle("");
            setBody("");
          }
        }}
      >
        Créer
      </Button>
    </div>
  );
}
