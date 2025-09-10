import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthProvider";
import { db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import { DEFAULT_AVATAR_IMG } from "@/lib/images";
import { useToast } from "@/hooks/use-toast";

export default function Profile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string>(
    user?.photoURL ?? DEFAULT_AVATAR_IMG,
  );
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const cleanAvatar = avatarUrl?.replace(/&amp;/g, "&") || avatarUrl;
      await setDoc(
        doc(db, "users", user.uid),
        { displayName, avatarUrl: cleanAvatar },
        { merge: true },
      );
      try {
        const { updateProfile } = await import("firebase/auth");
        const mod = await import("@/lib/firebase");
        if (mod.auth && mod.auth.currentUser)
          await updateProfile(mod.auth.currentUser, {
            displayName,
            photoURL: cleanAvatar,
          });
      } catch (e) {
        console.warn("updateProfile failed", e);
      }
      toast({ title: "Profil enregistré" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container max-w-xl py-10">
      <h1 className="font-display text-2xl font-bold">Profil</h1>
      <div className="mt-6 grid gap-3">
        <label className="text-sm">Pseudo</label>
        <Input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Votre pseudo"
        />
        <label className="text-sm mt-3">Avatar (URL)</label>
        <Input
          value={avatarUrl}
          onChange={(e) => setAvatarUrl(e.target.value)}
          placeholder="https://…"
        />
        <div className="mt-4">
          <Button onClick={save} disabled={saving}>
            {saving ? "Sauvegarde…" : "Sauvegarder"}
          </Button>
        </div>
      </div>
    </div>
  );
}
