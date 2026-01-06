"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import ActionButton from "../../components/ActionButton";

type HabitRow = {
  id: string;
  title: string;
  cadence: "daily" | "weekly" | "monthly";
  progress_emoji: string;
};

export default function ProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  const [userId, setUserId] = useState<string | null>(null);

  // Editable fields shown in inputs
  const [displayName, setDisplayName] = useState("");
  const [habits, setHabits] = useState<HabitRow[]>([]);
  const [titleByHabitId, setTitleByHabitId] = useState<Record<string, string>>({});
  const [emojiByHabitId, setEmojiByHabitId] = useState<Record<string, string>>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);


  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      setStatus("");
      setLoading(true);

      // Must be signed in
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (!isMounted) return;

      if (userError) {
        setStatus(userError.message);
        setLoading(false);
        return;
      }

      const user = userData.user;
      if (!user) {
        router.replace("/");
        return;
      }

      setUserId(user.id);

      // Load display name (NO writing)
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();

      if (!isMounted) return;

      if (profileError) {
        setStatus(profileError.message);
        setLoading(false);
        return;
      }

      setDisplayName(profile?.display_name ?? "");

      // Load habits (NO writing)
      const { data: habitData, error: habitsError } = await supabase
        .from("habits")
        .select("id,title,cadence,progress_emoji")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (!isMounted) return;

      if (habitsError) {
        setStatus(habitsError.message);
        setLoading(false);
        return;
      }

      const safeHabits = (habitData ?? []) as HabitRow[];
      setHabits(safeHabits);

      // Initialize the editable maps from DB values (no defaults invented)
      const titles: Record<string, string> = {};
      const emojis: Record<string, string> = {};

      safeHabits.forEach((h) => {
        titles[h.id] = h.title ?? "";
        emojis[h.id] = h.progress_emoji ?? "";
      });

      setTitleByHabitId(titles);
      setEmojiByHabitId(emojis);

      setLoading(false);
    }

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [router]);

  async function saveAll() {
    setStatus("");

    if (!userId) {
      setStatus("Not signed in.");
      return;
    }

    // Validate: we don't want to write empty strings
    if (!displayName.trim()) {
      setStatus("Display name cannot be empty.");
      return;
    }

    for (const h of habits) {
      const t = (titleByHabitId[h.id] ?? "").trim();
      const e = (emojiByHabitId[h.id] ?? "").trim();

      if (!t) {
        setStatus("Goal name cannot be empty.");
        return;
      }
      if (!e) {
        setStatus("Emoji cannot be empty.");
        return;
      }
    }

    // 1) Update profile with previous or new value (writes same value if unchanged)
    const { error: profileError } = await supabase
        .from("profiles")
        .update({ display_name: displayName.trim() })
        .eq("id", userId);

    if (profileError) {
      setStatus(profileError.message);
      return;
    }

    // 2) Update each habit with current values (writes same values if unchanged)
    for (const h of habits) {
      const { error: habitError } = await supabase
        .from("habits")
        .update({
          title: (titleByHabitId[h.id] ?? "").trim(),
          progress_emoji: (emojiByHabitId[h.id] ?? "").trim(),
        })
        .eq("id", h.id)
        .eq("user_id", userId);

      if (habitError) {
        setStatus(habitError.message);
        return;
      }
    }

    setStatus("Saved ✅");
  }

    async function deleteProfileAndData() {
        setStatus("");

        if (!userId) {
            setStatus("Not signed in.");
            return;
        }

        // This will cascade-delete habits + logs via your FK constraints
        const { error } = await supabase.from("profiles").delete().eq("id", userId);

        if (error) {
            setStatus(error.message);
            return;
        }

        // Sign out locally so user doesn't stay "logged in" to a now-deleted profile
        await supabase.auth.signOut();

        router.replace("/");
    }

    async function logout() {
      setStatus("");

      const { error } = await supabase.auth.signOut();
      if (error) {
        setStatus(error.message);
        return;
      }

      router.replace("/");
    }

  if (loading) {
    return (
      <main style={{ padding: 24, maxWidth: 700 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>Profile</h1>
        <p style={{ marginTop: 8 }}>Loading…</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, maxWidth: 700 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Profile</h1>
        <Link href="/grid" style={{ textDecoration: "none" }}>
          ← Back to grid
        </Link>
      </div>

      <p style={{ marginTop: 8, opacity: 0.8 }}>
        You can edit your name, your goal title and goal emoji.
      </p>

      <hr style={{ margin: "20px 0" }} />

      <div style={{ display: "grid", gap: 14 }}>
        <div>
          <label style={{ display: "block", marginBottom: 6 }}>Display name</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            style={{ width: 200, padding: 10, border: "1px solid #ddd", borderRadius: 10, background: "transparent" }}
          />
        </div>

        <div>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Your goal(s)</div>

          {habits.length === 0 ? (
            <p style={{ opacity: 0.8 }}>
              No goals found. Create one via onboarding first.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {habits.map((h) => (
                <div
                  key={h.id}
                  style={{
                    border: "1px solid #ddd",
                    borderRadius: 12,
                    padding: 12,
                  }}
                >
                  <div>
                    <label style={{ display: "block", marginBottom: 6 }}>Goal name</label>
                    <input
                      value={titleByHabitId[h.id] ?? ""}
                      onChange={(e) =>
                        setTitleByHabitId((prev) => ({
                          ...prev,
                          [h.id]: e.target.value,
                        }))
                      }
                      style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 10, background: "transparent"}}
                    />
                  </div>

                  <div style={{ opacity: 0.75, marginTop: 10}}>Cadence: {h.cadence}</div>

                  <div style={{ marginTop: 10 }}>
                    <label style={{ display: "block", marginBottom: 6 }}>Progress emoji</label>
                    <input
                      value={emojiByHabitId[h.id] ?? ""}
                      onChange={(e) =>
                        setEmojiByHabitId((prev) => ({
                          ...prev,
                          [h.id]: e.target.value,
                        }))
                      }
                      style={{ padding: 10, maxWidth: 40, border: "1px solid #ddd", borderRadius: 10, background: "transparent"}}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <ActionButton
          onClick={saveAll}
          text="Save changes"
          clickedText="Changes saved!"
          style={{ padding: "10px 14px", borderRadius: 10, fontWeight: 700 }}
        />

        <ActionButton
          onClick={logout}
          text="Log out"
          clickedText="Logging out!"
          textColor="#000"
          borderColor="#000"
          clickedBackgroundColor="#e2e2e2ff"
          style={{ padding: "10px 14px", borderRadius: 10, fontWeight: 700 }}
        />

        <ActionButton
          onClick={() => setShowDeleteConfirm(true)}
          text="Delete profile"
          clickedText="Deleting profile!"
          textColor="#620000ff"
          borderColor="#620000ff"
          clickedBackgroundColor="#ffdedeff"
          style={{ padding: "10px 14px", borderRadius: 10, fontWeight: 700 }}
        />

        {status && <p style={{ marginTop: 6 }}>{status}</p>}
      </div>

      {showDeleteConfirm && (
        <div
            style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16,
            }}
            onClick={() => setShowDeleteConfirm(false)} // click outside closes
        >
        <div
        style={{
            width: "100%",
            maxWidth: 520,
            background: "white",
            borderRadius: 14,
            padding: 16,
            border: "1px solid #ddd",
        }}
        onClick={(e) => e.stopPropagation()} // prevent closing when clicking inside
        >
        <div style={{ fontSize: 18, fontWeight: 800 }}>
            Are you sure you want to delete your profile?
        </div>
        <p style={{ marginTop: 8}}>
            All your goal progress will be lost.
        </p>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
            <button
            onClick={() => setShowDeleteConfirm(false)}
            style={{
                padding: "10px 14px",
                border: "1px solid #ddd",
                borderRadius: 10,
                background: "transparent",
                fontWeight: 700,
            }}
            >
            No, don't delete
            </button>

            <button
            onClick={deleteProfileAndData}
            style={{
                padding: "10px 14px",
                border: "1px solid #ff5a5aff",
                borderRadius: 10,
                fontWeight: 800,
            }}
            >
            Yes, delete
            </button>
        </div>
        </div>
    </div>
    )}

    </main>
  );
}
