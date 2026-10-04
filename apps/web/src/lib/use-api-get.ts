"use client";

import { useCallback, useEffect, useState } from "react";
import { api, getSession } from "@/lib/api";
import { peekCache } from "@/lib/query-cache";

export function useApiGet<T>(path: string) {
  const companyId = getSession()?.companyId ?? "";
  const [data, setData] = useState<T | null>(null);

  const reload = useCallback(() => {
    return api<T>(path).then((value) => {
      setData(value);
      return value;
    });
  }, [path]);

  useEffect(() => {
    const cached = peekCache<T>(path);
    if (cached !== undefined) setData(cached);
    void reload().catch(() => {
      if (peekCache<T>(path) === undefined) setData(null);
    });
  }, [path, companyId, reload]);

  return { data, setData, reload };
}
