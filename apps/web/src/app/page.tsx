"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "@/lib/api";
import { IS_FLOOR_APP } from "@/lib/app-mode";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    if (IS_FLOOR_APP) {
      router.replace(getSession()?.accessToken ? "/floor" : "/login?next=/floor");
      return;
    }
    router.replace(getSession()?.accessToken ? "/dashboard" : "/login");
  }, [router]);
  return null;
}
