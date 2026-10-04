"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Conversation = {
  humanTakeover: boolean;
  messages: Array<{ direction: string }>;
};

export function InboxBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;
    const tick = () =>
      api<Conversation[]>("/conversations")
        .then((rows) => {
          if (!alive) return;
          setCount(rows.filter((c) => c.messages[0]?.direction === "INBOUND").length);
        })
        .catch(() => undefined);
    tick();
    const id = window.setInterval(tick, 30000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  if (count <= 0) return null;
  return <span className="pill inbox-pill">{count}</span>;
}
