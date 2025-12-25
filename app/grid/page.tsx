"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

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
        router.push("/");
        return;
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

  // Grid layout logic:
  // - 1 user => 1 column
  // - 2 users => 2 columns
  // - 3+ => near-square grid (2x2, 3x3, 4x4, ...)
  const columns = useMemo(() => {
    const n = habits.length;
    if (n <= 2) return Math.max(1, n);
    return Math.ceil(Math.sqrt(n));
  }, [habits.length]);

  // Fill empty tiles to complete a square
  const tiles = useMemo(() => {
    const n = habits.length;
    const totalSlots = columns * columns;
    const empties = Math.max(0, totalSlots - n);
    return { empties, totalSlots };
  }, [habits.length, columns]);

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
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>Beasts Grid</h1>
      <p style={{ marginTop: 8, opacity: 0.8 }}>
        Public goals: {habits.length} • Layout: {columns}×{columns}
      </p>

      {status && <p style={{ marginTop: 12 }}>{status}</p>}

      <div
        style={{
          marginTop: 18,
          display: "grid",
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gap: 14,
          minHeight: "60vh",
        }}
      >
        {habits.map((h) => {
          const name = profileNames[h.user_id] || "Someone";
          const total = totalsByHabitId[h.id] ?? 0;
          const cadenceLabel =
            h.cadence === "daily" ? "days" : h.cadence === "weekly" ? "weeks" : "months";

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

              <div style={{ marginTop: 6, opacity: 0.8 }}>
                Goal: <strong>{h.title}</strong> ({h.cadence})
              </div>

              <div style={{ marginTop: 10, fontSize: 22 }}>
                {h.progress_emoji}{" "}
                <span style={{ fontSize: 14, opacity: 0.8 }}>
                  Total {cadenceLabel}:{" "}
                </span>
                <strong style={{ fontSize: 18 }}>{total}</strong>
              </div>
            </div>
          );
        })}

        {Array.from({ length: tiles.empties }).map((_, idx) => (
          <div
            key={`empty-${idx}`}
            style={{
              border: "1px dashed #ddd",
              borderRadius: 12,
              minHeight: 160,
              opacity: 0.6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
            }}
          >
            Empty slot
          </div>
        ))}
      </div>
    </main>
  );
}
