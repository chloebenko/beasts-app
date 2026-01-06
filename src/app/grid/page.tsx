"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

// HELPERS

function formatDateYYYYMMDD(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Monday-start week (more natural for Europe/Paris)
function getPeriodDate(cadence: "daily" | "weekly" | "monthly") {
  const now = new Date();

  if (cadence === "daily") {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return formatDateYYYYMMDD(d);
  }

  if (cadence === "weekly") {
    const day = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const diffToMonday = (day + 6) % 7; // 0 if Monday, 6 if Sunday
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday);
    return formatDateYYYYMMDD(monday);
  }

  // monthly
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  return formatDateYYYYMMDD(first);
}

// --------------------------------------------------------------

type HabitRow = {
  id: string;
  title: string;
  cadence: "daily" | "weekly" | "monthly";
  progress_emoji: string;
  background_path: string | null;
  user_id: string;
};

type TotalRow = {
  habit_id: string;
  total_periods_done: number;
};

export default function GridPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [habits, setHabits] = useState<HabitRow[]>([]);
  const [totalsByHabitId, setTotalsByHabitId] = useState<Record<string, number>>({});
  const [profileNames, setProfileNames] = useState<Record<string, string>>({});
  const [userId, setUserId] = useState<string | null>(null);


  useEffect(() => {
    let isMounted = true;

    async function loadGrid() {
      setStatus("");
      setLoading(true);

      // Require login for now (keeps it simple)
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (!isMounted) return;

      if (userError) {
        setStatus(userError.message);
        setLoading(false);
        return;
      }

      if (!userData.user) {
        router.replace("/");
        return;
      } else {
        setUserId(userData.user.id);
      }

      // 1) Fetch public habits
      const { data: habitData, error: habitsError } = await supabase
        .from("habits")
        .select("id,title,cadence,progress_emoji,background_path,user_id")
        .eq("is_public", true)
        .order("created_at", { ascending: true });

      if (!isMounted) return;

      if (habitsError) {
        setStatus(habitsError.message);
        setLoading(false);
        return;
      }

      const safeHabits = (habitData ?? []) as HabitRow[];
      setHabits(safeHabits);

      // 2) Fetch profile display names for those habits
      const userIds = Array.from(new Set(safeHabits.map((h) => h.user_id)));

      if (userIds.length > 0) {
        const { data: profileData, error: profilesError } = await supabase
          .from("profiles")
          .select("id,display_name")
          .in("id", userIds);

        if (!isMounted) return;

        if (profilesError) {
          setStatus(profilesError.message);
          setLoading(false);
          return;
        }

        const profileNameById: Record<string, string> = {};
        (profileData ?? []).forEach((p) => {
          profileNameById[p.id] = p.display_name ?? "";
        });

        setProfileNames(profileNameById);
      } else {
        setProfileNames({});
      }

      // 3) Fetch totals for those habits
      const habitIds = safeHabits.map((h) => h.id);

      if (habitIds.length > 0) {
        const { data: totalsData, error: totalsError } = await supabase
          .from("habit_totals")
          .select("habit_id,total_periods_done")
          .in("habit_id", habitIds);

        if (!isMounted) return;

        if (totalsError) {
          setStatus(totalsError.message);
          setLoading(false);
          return;
        }

        const map: Record<string, number> = {};
        (totalsData as TotalRow[] | null)?.forEach((row) => {
          map[row.habit_id] = row.total_periods_done;
        });

        setTotalsByHabitId(map);
      } else {
        setTotalsByHabitId({});
      }

      setLoading(false);
    }

    loadGrid();

    return () => {
      isMounted = false;
    };
  }, [router]);

  async function handleDidIt(habitId: string, cadence: "daily" | "weekly" | "monthly") {
    setStatus("");

    const period_date = getPeriodDate(cadence);

    const { error } = await supabase.from("habit_logs").insert({
        habit_id: habitId,
        period_date,
    });

    if (error) {
        const msg = (error as any).message ?? "";

        if (msg.includes("duplicate key value violates unique constraint")) {
            const when =
            cadence === "daily" ? "today" : cadence === "weekly" ? "this week" : "this month";
            setStatus(`You already logged it ${when}!`);
            return;
        }

        setStatus(msg || "Something went wrong.");
        return;
    }

    // Refresh totals just for the habits on screen
    const habitIds = habits.map((h) => h.id);
    if (habitIds.length === 0) return;

    const { data: totalsData, error: totalsError } = await supabase
        .from("habit_totals")
        .select("habit_id,total_periods_done")
        .in("habit_id", habitIds);

    if (totalsError) {
        setStatus(totalsError.message);
        return;
    }

    const map: Record<string, number> = {};
    (totalsData ?? []).forEach((row: any) => {
        map[row.habit_id] = row.total_periods_done;
    });

    setTotalsByHabitId(map);
  }

   const sortedHabits = useMemo(() => {
    const collator = new Intl.Collator(undefined, { sensitivity: "base" });

    const getName = (h: HabitRow) => (profileNames[h.user_id] ?? "").trim();
    const getTitle = (h: HabitRow) => (h.title ?? "").trim();

    return [...habits].sort((a, b) => {
      const aMine = a.user_id === userId;
      const bMine = b.user_id === userId;

      // 1) User's tiles first
      if (aMine !== bMine) return aMine ? -1 : 1;

      // 2) Others (and user's) ordered by display name
      const nameCmp = collator.compare(getName(a), getName(b));
      if (nameCmp !== 0) return nameCmp;

      // 3) Tie-breaker: goal title
      const titleCmp = collator.compare(getTitle(a), getTitle(b));
      if (titleCmp !== 0) return titleCmp;

      // 4) Final tie-breaker: stable sort
      return (a.id ?? "").localeCompare(b.id ?? "");
    });
  }, [habits, profileNames, userId]);

  if (loading) {
    return (
      <main style={{ padding: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>Grid</h1>
        <p style={{ marginTop: 8 }}>Loading…</p>
        {status && <p style={{ marginTop: 12 }}>{status}</p>}
      </main>
    );
  }

  return (
    <main style={{ padding: 24 }}>
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>The Shining Stars</h1>
        </div>

        <Link
            href="/profile"
            style={{
            border: "1px solid #ddd",
            padding: "10px 12px",
            borderRadius: 10,
            textDecoration: "none",
            color: "inherit",
            fontWeight: 600,
            marginTop: 0, // aligns top with the h1
            }}
        >
            Profile
        </Link>
    </div>


      {status && <p style={{ marginTop: 12 }}>{status}</p>}

      <div
        style={{
          marginTop: 18,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 14,
          minHeight: "60vh",
        }}
      >
        {sortedHabits.map((h) => {
          const name = profileNames[h.user_id] || "Someone";
          const total = totalsByHabitId[h.id] ?? 0;
          const cadenceLabel =
            h.cadence === "daily" ? "days" : h.cadence === "weekly" ? "weeks" : "months";
            const cadenceDidIt = h.cadence === "daily" ? "today" : h.cadence === "weekly" ? "this week" : "this month";

          return (
            <div
              key={h.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: 12,
                padding: 14,
                position: "relative",
                overflow: "hidden",
                minHeight: 160,
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 700 }}>{name}</div>

              <div style={{ fontSize: 18, marginTop: 6, opacity: 0.8 }}>
                Goal: <strong>{h.title}</strong> ({h.cadence})
              </div>

              <div style={{ fontSize: 18 }}>
                <span style={{ opacity: 0.8 }}>
                  Total {cadenceLabel}:{" "}
                </span>
                <strong>{total}</strong>
              </div>

              {userId === h.user_id && (
                <button
                    onClick={() => handleDidIt(h.id, h.cadence)}
                    style={{
                    marginTop: 12,
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: "1px solid #ddd",
                    background: "transparent",
                    fontWeight: 700,
                    cursor: "pointer",
                    }}
                >
                    I did it {cadenceDidIt}! 🥳
                </button>
            )}

            <div
                style={{
                    marginTop: 10,
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 6,
                    lineHeight: 1,
                }}
                >
                {Array.from({ length: total }).map((_, i) => (
                    <span key={i} style={{ fontSize: 20 }}>
                    {h.progress_emoji}
                    </span>
                ))}
            </div>
            </div>
          );
        })}

      </div>
    </main>
  );
}
