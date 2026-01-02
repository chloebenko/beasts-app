"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import ActionButton from "../components/ActionButton";

type Cadence = "daily" | "weekly" | "monthly";

export default function OnboardingPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  const [displayName, setDisplayName] = useState("");
  const [title, setTitle] = useState("Yoga");
  const [cadence, setCadence] = useState<Cadence>("daily");
  const [emoji, setEmoji] = useState("🧘");

  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function init() {
      setStatus("");

      const { data, error } = await supabase.auth.getUser();
      if (!isMounted) return;

      if (error) {
        setStatus(error.message);
        setLoading(false);
        return;
      }

      const user = data.user;
      if (!user) {
        router.push("/"); // goes back to login page
        return;
      }

      setUserId(user.id);

      setDisplayName("");

      if (!isMounted) return;

      setLoading(false);
    }

    init();

    return () => {
      isMounted = false;
    };
  }, [router]);

  async function createGoal() {
    setStatus("");

    if (!userId) {
        setStatus("Not signed in.");
        return;
    }

    if (!displayName.trim()) {
        setStatus("Please enter your name 🙂");
        return;
    }

    if (!title.trim()) {
      setStatus("Please give your goal a name (e.g., Yoga).");
      return;
    }

    if (!emoji.trim()) {
      setStatus("Please choose an emoji.");
      return;
    }

    // Save display name
    const { error: profileError } = await supabase.from("profiles").upsert({
        id: userId,
        display_name: displayName.trim(),
    });

    if (profileError) {
      setStatus(profileError.message);
      return;
    }

    // Create the habit
    const { error: habitError } = await supabase.from("habits").insert({
      user_id: userId,
      title: title.trim(),
      cadence,
      progress_emoji: emoji.trim(),
      is_public: true,
    });

    if (habitError) {
      setStatus(habitError.message);
      return;
    }

    router.push("/grid");
  }

  if (loading) {
    return (
      <main style={{ padding: 24, maxWidth: 640 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>Create your goal</h1>
        <p style={{ marginTop: 8 }}>Loading…</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, maxWidth: 640 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>Create your goal</h1>
      <p style={{ marginTop: 8, opacity: 0.8 }}>
        This sets up your tile on the main grid.
      </p>

      <hr style={{ margin: "20px 0" }} />

      <div style={{ display: "grid", gap: 14 }}>
        <div>
          <label style={{ display: "block", marginBottom: 6 }}>Your name:</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Type your name here"
            onFocus={(e) => (e.target.placeholder = "")}
            onBlur={(e) => {
              if (!displayName) e.target.placeholder = "Type your name here";
            }}
            style={{ width: "100%", padding: 10, border: "1px solid #000", borderRadius: 8}}
          />
        </div>

        <div>
          <label style={{ display: "block", marginBottom: 6 }}>Goal name:</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Type your goal, ex: Yoga, Breathwork"
            onFocus={(e) => (e.target.placeholder = "")}
            onBlur={(e) => {
              if (!title) e.target.placeholder = "Type your goal, ex: Yoga, Breathwork";
            }}
            style={{ width: "100%", padding: 10, border: "1px solid #000", borderRadius: 8 }}
          />
        </div>

        <div>
          <label style={{ display: "block", marginBottom: 6 }}>Frequency:</label>
          <select
            value={cadence}
            onChange={(e) => setCadence(e.target.value as Cadence)}
            style={{ width: "100%", padding: 10, border: "1px solid #000", borderRadius: 8 }}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>

        <div>
          <label style={{ display: "block", marginBottom: 6 }}>Progress emoji:</label>
          <p style={{ marginBottom: 10, opacity: 0.7 }}>
            Choose one emoji you love. We’ll use it to stamp your progress.
          </p>
          <input
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            placeholder="🧘"
            onFocus={(e) => (e.target.placeholder = "")}
            onBlur={(e) => {
              if (!emoji) e.target.placeholder = "🧘";
            }}
            style={{ width: "100%", padding: 10, maxWidth: 80, border: "1px solid #000", borderRadius: 8 }}
          />
        </div>

        <ActionButton
          onClick={createGoal}
          text="Create my goal →"
          clickedText="Goal created!"
        />

        {status && <p style={{ marginTop: 8 }}>{status}</p>}
      </div>
    </main>
  );
}
