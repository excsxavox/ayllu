"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ALERTS_CHANGED } from "@/lib/events";

export function UnreadBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;
    const tick = () =>
      api<{ count: number }>("/alerts/unread-count")
        .then((r) => {
          if (alive) setCount(r.count);
        })
        .catch(() => undefined);
    tick();
    const id = window.setInterval(tick, 30000);
    window.addEventListener(ALERTS_CHANGED, tick);
    return () => {
      alive = false;
      window.clearInterval(id);
      window.removeEventListener(ALERTS_CHANGED, tick);
    };
  }, []);

  if (count <= 0) return null;
  return <span className="pill">{count}</span>;
}
