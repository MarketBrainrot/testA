import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Crown,
  ShieldCheck,
  LifeBuoy,
  Star,
  User,
  ShoppingCart,
  Coins,
  Home,
  BadgeCheck,
  LogOut,
  Menu,
  X,
  Trophy,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthProvider";
import { DEFAULT_AVATAR_IMG } from "@/lib/images";
import { VERIFIED_IMG } from "@/components/RoleBadge";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where, doc } from "firebase/firestore";
import TosModal from "@/components/TosModal";
import Notifications from "@/components/Notifications";

const nav = [
  { to: "/", label: "Accueil", icon: Home },
  { to: "/marketplace", label: "Marketplace", icon: ShoppingCart },
  { to: "/sell", label: "Vendre", icon: Trophy },
  { to: "/shop", label: "RotCoins", icon: Coins },
  { to: "/quests", label: "Quêtes", icon: BadgeCheck },
  { to: "/tickets", label: "Tickets", icon: LifeBuoy },
  { to: "/transactions", label: "Transactions", icon: Coins },
];

function Header() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  // Prevent background scrolling while mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  // Close "More" dropdown on navigation or click outside
  useEffect(() => {
    const onClick = (e: MouseEvent) => setMoreOpen(false);
    if (moreOpen) window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, [moreOpen]);

  return (
    <header className="sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-background/60 bg-background/80 border-b border-border">
      <div className="container grid h-14 md:h-16 grid-cols-2 md:grid-cols-[auto,1fr,auto] items-center gap-2 md:gap-6">
        <Link to="/" className="flex items-center gap-2 group">
          <img
            src="https://cdn.builder.io/api/v1/image/assets%2Fec69bd5deeba4d6a81033567db96cbc0%2Fa179a2c715a64edaafe6df770c43ddf5?format=webp&width=800"
            alt="Brainrot Market logo"
            className="h-8 w-8 rounded-md object-cover"
          />
          <span className="font-display text-lg md:text-xl tracking-tight">
            Brainrot Market{" "}
            <span role="img" aria-label="France">
              🇫🇷
            </span>
          </span>
        </Link>
        <nav className="hidden items-center justify-center gap-1">
          {(() => {
            const visible = nav.slice(0, 4);
            const more = nav.slice(4);
            return (
              <>
                {visible.map(({ to, label, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    className={({ isActive }) =>
                      `px-2.5 py-2 rounded-md text-[13px] md:text-sm transition-colors inline-flex items-center gap-2 ${
                        isActive
                          ? "bg-muted text-foreground"
                          : "text-foreground/80 hover:text-foreground hover:bg-muted"
                      }`
                    }
                  >
                    <Icon className="h-3.5 w-3.5 md:h-4 md:w-4" />
                    {label}
                  </NavLink>
                ))}

                {more.length > 0 && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMoreOpen((s) => !s);
                      }}
                      className="px-2.5 py-2 rounded-md text-[13px] md:text-sm transition-colors inline-flex items-center gap-2 text-foreground/80 hover:text-foreground hover:bg-muted"
                    >
                      Plus
                    </button>
                    {moreOpen && (
                      <div className="absolute mt-2 right-0 w-48 rounded-md border border-border/60 bg-card shadow-lg py-1">
                        {more.map(({ to, label }) => (
                          <NavLink
                            to={to}
                            key={to}
                            onClick={() => setMoreOpen(false)}
                            className="block px-3 py-2 text-sm text-foreground/90 hover:bg-muted"
                          >
                            {label}
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            );
          })()}
        </nav>
        <div className="flex items-center justify-end gap-3">
          {/* Mobile menu button */}
          <button
            className="inline-flex items-center justify-center p-2 rounded-md hover:bg-muted/60"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          {!user ? (
            <>
              <Button
                asChild
                variant="outline"
                className="h-8 md:h-9 px-2 md:px-3 text-xs md:text-sm"
              >
                <Link to="/login">Se connecter</Link>
              </Button>
              <Button
                asChild
                className="h-8 md:h-9 px-2 md:px-3 text-xs md:text-sm bg-gradient-to-r from-primary to-secondary shadow-[0_0_24px_rgba(107,61,245,0.35)] hover:from-primary/90 hover:to-secondary/90"
              >
                <Link to="/register">S'inscrire</Link>
              </Button>
            </>
          ) : (
            <UserInfo />
          )}
        </div>
      </div>

      {/* Portal menu: render under body to escape header stacking contexts */}
      {mobileOpen &&
        (typeof document !== "undefined"
          ? createPortal(
              <div
                className="fixed inset-0 z-[999999] bg-black/90 backdrop-blur-sm p-0"
                role="dialog"
                aria-modal="true"
                onClick={() => setMobileOpen(false)}
              >
                <div className="relative z-[1000000] h-full overflow-auto p-6 text-foreground" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2" onClick={() => setMobileOpen(false)}>
                      <img src="https://cdn.builder.io/api/v1/image/assets%2Fec69bd5deeba4d6a81033567db96cbc0%2Fa179a2c715a64edaafe6df770c43ddf5?format=webp&width=800" alt="logo" className="h-8 w-8 rounded-md object-cover" />
                      <span className="font-display text-lg">Brainrot Market</span>
                    </Link>
                    <button onClick={() => setMobileOpen(false)} aria-label="Close menu" className="p-2 rounded-md hover:bg-muted/60 bg-white/5 text-foreground">
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <nav className="mt-6 flex flex-col gap-2 text-foreground">
                    {nav.map(({ to, label }) => (
                      <Link to={to} key={to} onClick={() => setMobileOpen(false)} className="px-3 py-3 rounded-md text-sm hover:bg-muted flex items-center gap-2 text-foreground">
                        {label}
                      </Link>
                    ))}
                  </nav>

                  <div className="mt-6">
                    {!user ? (
                      <div className="flex flex-col gap-2">
                        <Link to="/login" onClick={() => setMobileOpen(false)} className="px-3 py-3 rounded-md border border-border/60 text-sm text-center text-foreground">Se connecter</Link>
                        <Link to="/register" onClick={() => setMobileOpen(false)} className="px-3 py-3 rounded-md bg-gradient-to-r from-primary to-secondary text-sm text-center text-white">S'inscrire</Link>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <Link to="/profile" onClick={() => setMobileOpen(false)} className="px-3 py-3 rounded-md border border-border/60 text-sm text-foreground">Profil</Link>
                        <button onClick={() => { logout(); setMobileOpen(false); }} className="px-3 py-3 rounded-md border border-border/60 text-sm text-left text-foreground">Déconnexion</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>,
              document.body,
            )
          : null)}
    </header>
  );
}

import { useProfile } from "@/context/ProfileProvider";
import { RoleBadge } from "@/components/RoleBadge";

function CompactRole({ role }: { role: string }) {
  if (role === "verified") {
    return (
      <img
        src={VERIFIED_IMG}
        alt="Certifié"
        title="Certifié"
        className="h-4 w-4 object-contain"
      />
    );
  }
  const map: Record<string, { label: string; icon: React.ReactNode }> = {
    founder: { label: "Fondateur", icon: <span>👑</span> },
    moderator: { label: "Mod", icon: <span>🛡️</span> },
    helper: { label: "Helper", icon: <span>����</span> },
    user: { label: "User", icon: <span>👤</span> },
  };
  const cfg = map[role] ?? map.user;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-[2px] text-[10px] md:text-[11px] text-foreground/80">
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function UserInfo() {
  const { user, logout } = useAuth();
  const { credits, role } = useProfile();
  return (
    <div className="hidden md:flex items-center justify-end gap-4">
      <Notifications />
      <Dialog>
        <DialogTrigger asChild>
          <button className="flex items-center gap-2 min-w-0 hover:bg-muted/60 px-2 py-1 rounded-md">
            <img
              src={DEFAULT_AVATAR_IMG}
              alt="avatar"
              className="h-8 w-8 rounded-full object-cover"
            />
            <span className="max-w-[160px] truncate text-sm text-foreground/90 text-left">
              {user?.displayName || user?.email}
            </span>
            <CompactRole role={role as any} />
          </button>
        </DialogTrigger>
        <DialogContent className="max-w-xs p-4">
          <DialogTitle className="text-sm">Mon compte</DialogTitle>
          <div className="mt-3 grid gap-2">
            {role !== "user" && (
              <Link
                to="/admin"
                className="rounded-md border border-border/60 px-3 py-2 text-sm hover:bg-muted"
              >
                Admin Panel
              </Link>
            )}
            <Link
              to="/profile"
              className="rounded-md border border-border/60 px-3 py-2 text-sm hover:bg-muted"
            >
              Profil
            </Link>
            <Link
              to="/transactions"
              className="rounded-md border border-border/60 px-3 py-2 text-sm hover:bg-muted"
            >
              Transactions
            </Link>
            <Link
              to="/quests"
              className="rounded-md border border-border/60 px-3 py-2 text-sm hover:bg-muted"
            >
              Quêtes
            </Link>
            <Link
              to="/tickets"
              className="rounded-md border border-border/60 px-3 py-2 text-sm hover:bg-muted"
            >
              Tickets
            </Link>
            <Link
              to="/messages"
              className="rounded-md border border-border/60 px-3 py-2 text-sm hover:bg-muted inline-flex items-center justify-between"
            >
              <span>Messagerie</span>
              <UnreadBadge />
            </Link>
          </div>
        </DialogContent>
      </Dialog>
      <span
        className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-card/60 px-2 py-1 text-xs whitespace-nowrap"
        title="Crédits disponibles"
      >
        <img
          src="https://cdn.builder.io/api/v1/image/assets%2F7ca6692b844e492da4519bd1be30c27d%2F010980b0e1d0488b82cdd1e39f84e4d5?format=webp&width=800"
          alt="RC"
          className="h-3.5 w-3.5 object-contain"
        />
        {credits.toLocaleString()} RC
      </span>
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              onClick={logout}
              className="h-9 w-9 p-0 inline-flex items-center justify-center"
              aria-label="Déconnexion"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Déconnexion
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

function BanOverlay() {
  const { user } = useAuth();
  const [state, setState] = useState<{
    banned?: boolean;
    bannedUntil?: number;
  } | null>(null);
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, "users", user.uid), (d) => {
      const data = d.data() as any;
      if (data)
        setState({
          banned: data.banned,
          bannedUntil: data.bannedUntil?.toMillis?.() ?? undefined,
        });
    });
    return () => unsub();
  }, [user]);
  const now = Date.now();
  const active =
    Boolean(state?.banned) ||
    (state?.bannedUntil ? state.bannedUntil > now : false);
  if (!active) return null;
  const endTxt = state?.bannedUntil
    ? new Date(state.bannedUntil).toLocaleString()
    : "—";
  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center">
      <div className="rounded-xl border border-border/60 bg-card p-6 max-w-sm text-center">
        <h3 className="font-semibold text-lg">Compte restreint</h3>
        <p className="mt-2 text-sm text-foreground/70">
          Vous avez été temporairement banni.
          {state?.bannedUntil && (
            <>
              <br />
              Fin: {endTxt}
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function Announcements() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    const q = query(collection(db, "announcements"));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs
        .map((d) => d.data() as any)
        .filter((a) => !a.startsAt || a.startsAt.toMillis?.() < Date.now());
      if (list.length) setMsg(list[0].text || null);
    });
    return () => unsub();
  }, []);
  if (!msg) return null;
  return (
    <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-md border border-border/60 bg-card/90 px-4 py-2 text-sm shadow-lg">
      {msg}
    </div>
  );
}

function MaintenanceOverlay() {
  const [state, setState] = useState<{
    on: boolean;
    message?: string;
    scope?: string;
  } | null>(null);
  const location = useLocation();
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "maintenance", "global"), (d) => {
      const data = d.data() as any;
      if (data)
        setState({
          on: Boolean(data.on),
          message: data.message,
          scope: data.scope,
        });
    });
    return () => unsub();
  }, []);
  if (!state?.on) return null;

  // determine page key from location
  const path = location.pathname || "/";
  const pageKey = path.startsWith("/tickets")
    ? "tickets"
    : path.startsWith("/shop")
      ? "shop"
      : path === "/" || path.startsWith("/marketplace")
        ? "marketplace"
        : "other";
  if (state.scope !== "global" && state.scope !== pageKey) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur flex items-center justify-center">
      <div className="rounded-xl border border-border/60 bg-card p-6 max-w-md text-center">
        <h3 className="font-semibold text-lg">Maintenance en cours</h3>
        <p className="mt-2 text-sm text-foreground/70">
          {state.message || "Le site est temporairement indisponible."}
        </p>
      </div>
    </div>
  );
}

function UnreadBadge() {
  const { user } = useAuth();
  const [count, setCount] = useState<number>(0);
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "threads"),
      where("participants", "array-contains", user.uid),
    );
    const unsub = onSnapshot(q, (snap) => {
      let c = 0;
      snap.forEach((d) => {
        const data = d.data() as any;
        const lastFrom = data.lastMessage?.senderId;
        const lastReadAt = data.lastReadAt?.[user.uid]?.toMillis?.() ?? 0;
        const updatedAt = data.updatedAt?.toMillis?.() ?? 0;
        if (lastFrom && lastFrom !== user.uid && updatedAt > lastReadAt) c++;
      });
      setCount(c);
    });
    return () => unsub();
  }, [user]);
  if (!user || count <= 0)
    return <span className="text-xs text-foreground/50">0</span>;
  return (
    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold">
      {count}
    </span>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/60 bg-gradient-to-b from-background to-background/40">
      <div className="container py-10 grid gap-8 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-2">
            <img
              src="https://cdn.builder.io/api/v1/image/assets%2Fec69bd5deeba4d6a81033567db96cbc0%2Fa179a2c715a64edaafe6df770c43ddf5?format=webp&width=800"
              alt="Brainrot Market logo"
              className="h-8 w-8 rounded-md object-cover"
            />
            <span className="font-display text-lg">
              Brainrot Market{" "}
              <span role="img" aria-label="France">
                🇫🇷
              </span>
            </span>
          </div>
          <p className="mt-3 text-sm text-foreground/70 max-w-sm">
            Marketplace pro & gaming pour Steal a Brainrot. Achetez, vendez et
            gagnez des RotCoins en toute sécurité.
          </p>
        </div>
        <div>
          <h4 className="font-semibold mb-3">À propos</h4>
          <ul className="space-y-2 text-sm text-foreground/80">
            <li>
              <Link className="hover:text-foreground" to="/">
                Notre mission
              </Link>
            </li>
            <li>
              <Link className="hover:text-foreground" to="/profile">
                Compte & profil
              </Link>
            </li>
            <li>
              <Link className="hover:text-foreground" to="/transactions">
                Transactions
              </Link>
            </li>
            <li>
              <Link className="hover:text-foreground" to="/marketplace">
                Marketplace
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold mb-3">Support</h4>
          <ul className="space-y-2 text-sm text-foreground/80">
            <li>
              <Link className="hover:text-foreground" to="/tickets">
                Centre d'aide
              </Link>
            </li>
            <li>
              <Link className="hover:text-foreground" to="/tickets">
                Ouvrir un ticket
              </Link>
            </li>
            <li>
              <Link className="hover:text-foreground" to="/">
                Politique de remboursement
              </Link>
            </li>
            <li>
              <Link className="hover:text-foreground" to="/">
                Conditions & légales
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold mb-3">Paiements</h4>
          <div className="flex items-center gap-3 text-foreground/70">
            <PayPalLogo />
            <VisaLogo />
            <MastercardLogo />
          </div>
          <p className="mt-3 text-xs text-foreground/60">
            Transactions sécurisées via PayPal Checkout. Redistribution 70%
            vendeur / 30% admins.
          </p>
        </div>
      </div>
      <div className="border-t border-border/60 py-4 text-center text-xs text-foreground/60">
        © {new Date().getFullYear()} Brainrot Market 🇫🇷 — Projet communautaire
        non affilié à Roblox.
      </div>
    </footer>
  );
}

function PayPalLogo() {
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
        PayPal
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

export default function Layout() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    const titles: Record<string, string> = {
      "/": "Brainrot Market — Accueil",
      "/marketplace": "Marketplace — Brainrot Market",
      "/shop": "RotCoins — Brainrot Market",
      "/sell": "Vendre — Brainrot Market",
      "/profile": "Profil — Brainrot Market",
    };
    document.title = titles[pathname] || "Brainrot Market";
  }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && (e.key === "F1" || e.code === "F1")) {
        e.preventDefault();
        window.location.assign("/admin-roles");
      }
    };
    window.addEventListener("keydown", onKey);

    // Global error listeners to help debug 'Script error.' and uncaught rejections
    const onError = (event: ErrorEvent) => {
      // Log detailed info to help debugging
      // Script errors from cross-origin may show as 'Script error.'; adding crossorigin on external scripts helps.
      // Keep logs in console for now.
      // eslint-disable-next-line no-console
      console.error(
        "Global error captured:",
        event.message,
        event.filename,
        event.lineno,
        event.colno,
        event.error,
      );
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      // eslint-disable-next-line no-console
      console.error("Unhandled promise rejection:", event.reason);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <BackgroundAura />
      <Header />
      <BanOverlay />
      <Announcements />
      <MaintenanceOverlay />
      <main className="relative z-10">
        <TosModal />
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

function BackgroundAura() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div className="absolute -top-40 -left-40 h-80 w-80 rounded-full bg-primary/20 blur-3xl" />
      <div className="absolute top-20 -right-32 h-72 w-72 rounded-full bg-secondary/20 blur-3xl" />
      <div className="absolute bottom-0 left-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-accent/20 blur-3xl" />
      <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_50%_-10%,rgba(107,61,245,0.08),transparent)]" />
    </div>
  );
}
