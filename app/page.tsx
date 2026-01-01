"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useRouter } from "next/navigation";


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
    const { data, error } = await supabase.auth.getUser();

    if (!isMounted) return;

    if (error) {
      setStatus(error.message);
      setLoading(false);
      return;
    }

    const user = data.user;
    setUserEmail(user?.email ?? null);

    // If not signed in, just show the login UI
    if (!user) {
      setLoading(false);
      return;
    }

    // Check if this user already has at least one habit
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

    // Route based on whether they have a habit yet
    if (!habits || habits.length === 0) {
      router.push("/onboarding");
    } else {
      router.push("/grid");
    }
  }

  loadAndRoute();

  // Also listen for auth changes (e.g., magic link just completed)
  const { data: subscription } = supabase.auth.onAuthStateChange(() => {
    loadAndRoute();
  });

  return () => {
    isMounted = false;
    subscription.subscription.unsubscribe();
  };
  }, [router]);


  async function signInWithEmail() {
    setStatus("");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
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
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>Welcome to the Beasts app! ✨😎✨</h1>
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
              style={{ width: "100%", padding: 10, marginBottom: 12 }}
            />
            <button onClick={signInWithEmail} disabled={!email}>
              Send magic link
            </button>
          </>
        )
      )}

      {status && <p style={{ marginTop: 16 }}>{status}</p>}
    </main>
  );
}
