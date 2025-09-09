import React, { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useAuth } from "@/context/AuthProvider";
import { db } from "@/lib/firebase";
import { collection, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";

export default function Notifications() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    const ref = doc(db, "users", user.uid);
    const unsub = onSnapshot(ref, (d) => {
      const data = d.data() as any;
      if (!data) return setNotes([]);
      const arr = Array.isArray(data.notifications) ? data.notifications : [];
      setNotes(arr.slice().reverse()); // newest first
    });
    return () => unsub();
  }, [user]);

  const unread = notes.filter((n) => !n.read).length;

  if (!user) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="relative inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted/60">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-white">
              {unread}
            </span>
          )}
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Notifications</DialogTitle>
        <div className="mt-3 space-y-2">
          {notes.length === 0 && (
            <div className="text-sm text-foreground/60">
              Aucune notification
            </div>
          )}
          {notes.map((n, i) => (
            <div
              key={i}
              className="rounded-md border border-border/60 p-3 bg-card flex items-start justify-between gap-2"
            >
              <div>
                <div className="text-sm font-medium">
                  {n.type === "role"
                    ? `Rôle : ${n.role}`
                    : n.title || "Notification"}
                </div>
                <div className="text-xs text-foreground/70 mt-1">{n.text}</div>
              </div>
              <div className="flex flex-col items-end gap-2">
                {!n.read && (
                  <button
                    className="text-xs text-primary underline"
                    onClick={async () => {
                      try {
                        // mark this notification as read by replacing array with mapped
                        const ref = doc(db, "users", user.uid);
                        const cur = notes.slice().reverse(); // original order
                        // find the matching notification by createdAt and text
                        const target = n;
                        // set read locally
                        await updateDoc(ref, {
                          notifications: cur
                            .map((x: any) =>
                              x === target ? { ...x, read: true } : x,
                            )
                            .slice()
                            .reverse(),
                        });
                      } catch (e) {}
                    }}
                  >
                    Marquer lu
                  </button>
                )}
                {n.type === "thread" && n.threadId && (
                  <button
                    className="text-xs bg-primary text-white px-2 py-1 rounded"
                    onClick={() => {
                      // mark read and navigate
                      navigate(`/messages?thread=${n.threadId}`);
                    }}
                  >
                    Voir
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
