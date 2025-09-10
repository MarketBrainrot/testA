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
  const [avatarUrl, setAvatarUrl] = useState<string>("https://media.discordapp.net/attachments/1414653070171701309/1415119993737056297/assets_ec69bd5deeba4d6a81033567db96cbc0_a179a2c715a64edaafe6df770c43ddf5.webp?ex=68c20cb2&is=68c0bb32&hm=3c194928582aa6a27f988c35326997461abf380a9116ab32ae613a52c8b61002");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await setDoc(
        doc(db, "users", user.uid),
        { displayName, avatarUrl },
        { merge: true },
      );
      try {
        const { updateProfile } = await import("firebase/auth");
        const mod = await import("@/lib/firebase");
        if (mod.auth && mod.auth.currentUser)
          await updateProfile(mod.auth.currentUser, {
            displayName,
            photoURL: avatarUrl,
          });
      } catch {}
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
