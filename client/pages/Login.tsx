import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

const schema = z.object({
  username: z.string().min(3, "Minimum 3 caractères"),
  password: z.string().min(6, "Minimum 6 caractères"),
});

export default function Login() {
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { username: "", password: "" },
  });
  const { toast } = useToast();
  const navigate = useNavigate();

  async function onSubmit(values: z.infer<typeof schema>) {
    const { signInWithEmailAndPassword } = await import("firebase/auth");
    const { usernameToEmail } = await import("@/lib/usernameAuth");
    const mod = await import("@/lib/firebase");
    const auth = mod.auth;
    if (!auth) {
      toast({
        title: "Auth indisponible",
        description: "Réessayez dans le navigateur (client).",
      });
      return;
    }
    const email = usernameToEmail(values.username);
    try {
      await signInWithEmailAndPassword(auth, email, values.password);
      toast({ title: `Connexion réussie`, description: values.username });
      navigate("/", { replace: true });
    } catch (err: any) {
      console.error("login failed", err);
      const code = String(err?.code || err?.message || err || "");
      if (code.includes("network") || code.includes("auth/network-request-failed")) {
        toast({
          title: "Erreur réseau",
          description: "Connexion impossible — vérifiez votre réseau",
          variant: "destructive",
        });
      } else if (code.includes("auth/wrong-password") || code.includes("wrong-password")) {
        toast({ title: "Mot de passe incorrect", variant: "destructive" });
      } else if (code.includes("auth/user-not-found") || code.includes("user-not-found")) {
        toast({ title: "Utilisateur introuvable", variant: "destructive" });
      } else {
        toast({ title: "Erreur de connexion", description: String(err?.message || err), variant: "destructive" });
      }
    }
  }

  return (
    <div className="container max-w-md py-12">
      <h1 className="font-display text-2xl font-bold">Se connecter</h1>
      <p className="text-sm text-foreground/70">
        Entrez vos identifiants pour accéder à Brainrot Market 🇫🇷.
      </p>
      <div className="mt-6 rounded-xl border border-border/60 bg-card p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pseudo</FormLabel>
                  <FormControl>
                    <Input placeholder="Votre pseudo" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mot de passe</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-primary to-secondary"
            >
              Connexion
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
