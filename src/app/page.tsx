"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";

import ActionButton from "../components/ActionButton";


export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadAndRoute() {
      setStatus("");

      // More reliable for "do we have a session right now?"
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (!isMounted) return;

      if (sessionError) {
        setStatus(sessionError.message);
        setLoading(false);
        return;
      }

      const user = sessionData.session?.user;
      setUserEmail(user?.email ?? null);

      if (!user) {
        setLoading(false);
        return;
      }

      const { data: habits, error: habitsError } = await supabase
        .from("habits")
        .select("id")
        .eq("user_id", user.id)
        .limit(1);

      if (!isMounted) return;

      if (habitsError) {
        setStatus(habitsError.message);
        setLoading(false);
        return;
      }

      // Use replace so back button doesn't bounce
      router.replace(habits && habits.length > 0 ? "/grid" : "/onboarding");
    }

    loadAndRoute();

    // Only re-run routing when auth actually changes
    const { data: sub } = supabase.auth.onAuthStateChange((_event) => {
      loadAndRoute();
    });

    return () => {
      isMounted = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);



  async function signInWithEmail() {
    setStatus("");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
      },
    });

    if (error) setStatus(error.message);
    else setStatus("Check your email for the magic link ✅");
  }

  async function signOut() {
    setStatus("");
    const { error } = await supabase.auth.signOut();
    if (error) setStatus(error.message);
    else setStatus("Signed out.");
  }

  return (
    <main style={{ padding: 24, maxWidth: 520 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>Let's rise & shine! ✨</h1>
      <p style={{ marginTop: 8, opacity: 0.8 }}>
        Simple login first. Next we’ll add your icon + emoji to keep track of your habits and celebrate every time you show up for yourself! 💖
      </p>

      <hr style={{ margin: "20px 0" }} />

      {loading && <p>Loading…</p>}
      {!loading && (
          userEmail ? (
          <>
            <p>
              Signed in as <strong>{userEmail}</strong>
            </p>

            <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
              <button onClick={signOut}>Sign out</button>
            </div>
          </>
        ) : (
          <>
            <label style={{ display: "block", marginBottom: 8 }}>Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{
                width: "100%",
                padding: 10,
                marginBottom: 12,
                border: "1px solid #000",   // black border
                borderRadius: 8,            // optional, feels nicer
                outline: "none",            // removes default blue glow
              }}
            />
            
            <ActionButton
              onClick={signInWithEmail}
              text="Send magic link"
              clickedText="Magic link sent!"
              disabled={!email}
            />
          </>
        )
      )}

      {status && <p style={{ marginTop: 16 }}>{status}</p>}
    </main>
  );
}
