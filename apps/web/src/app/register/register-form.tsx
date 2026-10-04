"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, setSession } from "@/lib/api";
import { useMounted } from "@/lib/use-mounted";
import { BrandMark, Icon } from "@/components/icons";
import { LoadingState } from "@/components/loading-state";

export default function RegisterForm() {
  const router = useRouter();
  const mounted = useMounted();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      const res = await api<{
        accessToken: string;
        refreshToken: string;
        defaultCompanyId: string | null;
      }>("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          password: form.get("password"),
          companyName: form.get("companyName"),
        }),
      });
      setSession({
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
        companyId: res.defaultCompanyId,
      });
      router.replace("/dashboard");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (!mounted) {
    return (
      <div className="auth">
        <div className="auth-aside" />
        <div className="auth-panel">
          <LoadingState compact label="Cargando…" />
        </div>
      </div>
    );
  }

  return (
    <div className="auth">
      <aside className="auth-aside">
        <div className="brand">
          <BrandMark />
          Aylluu <span>WA</span>
        </div>
        <div>
          <p className="eyebrow">Empieza en minutos</p>
          <h1>
            Un espacio para
            <br />
            <em>tu negocio.</em>
          </h1>
          <p className="lead">El asistente te lleva por canal, catálogo, reglas y formas de responder.</p>
        </div>
        <p className="login-bottom">
          <Icon name="lock" />
          Un espacio para cada negocio.
        </p>
      </aside>
      <div className="auth-panel">
        <p className="login-top">Aylluu WA</p>
        <form className="login-form" onSubmit={onSubmit} autoComplete="on">
          <div className="welcome-icon" aria-hidden>
            <BrandMark />
          </div>
          <h2>Crear cuenta</h2>
          <p className="muted">Abre el espacio de trabajo de tu empresa.</p>
          <label className="field">
            <span>Nombre</span>
            <input name="name" autoComplete="name" required />
          </label>
          <label className="field">
            <span>Correo electrónico</span>
            <input name="email" type="email" autoComplete="username" required />
          </label>
          <label className="field">
            <span>Contraseña</span>
            <input name="password" type="password" autoComplete="new-password" minLength={8} required />
          </label>
          <label className="field">
            <span>Empresa</span>
            <input name="companyName" required placeholder="Mi negocio" />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="btn full" disabled={loading}>
            {loading ? "Creando…" : "Crear y configurar"}
          </button>
          <p className="demo-caption">
            ¿Ya tienes cuenta? <Link href="/login">Entrar</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
