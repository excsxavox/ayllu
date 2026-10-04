"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { IS_FLOOR_APP } from "@/lib/app-mode";
import RegisterForm from "./register-form";

export default function RegisterPage() {
  const router = useRouter();
  useEffect(() => {
    if (IS_FLOOR_APP) router.replace("/login");
  }, [router]);
  if (IS_FLOOR_APP) return null;
  return <RegisterForm />;
}
