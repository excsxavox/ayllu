"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSession, signIn } from "@/lib/api";
import { IS_FLOOR_APP } from "@/lib/app-mode";
import { useMounted } from "@/lib/use-mounted";
import { BrandMark, Icon } from "@/components/icons";
import { LoadingState } from "@/components/loading-state";
import { FloorLogin } from "@/components/floor-login";

export default function LoginForm() {
  return IS_FLOOR_APP ? <FloorLogin /> : <WorkspaceLogin />;
}

function WorkspaceLogin() {
  const router = useRouter();
  const mounted = useMounted();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (getSession()?.accessToken) router.replace("/dashboard");
  }, [router]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      await signIn(String(form.get("email") ?? ""), String(form.get("password") ?? ""));
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(next === "/floor" ? "/floor" : "/dashboard");
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
          <p className="eyebrow">Conversaciones que conectan</p>
          <h1>
            Tu equipo y tu asistente.
            <br />
            <em>En el mismo lugar.</em>
          </h1>
          <p className="lead">
            Conversa con tus clientes, organiza tu catálogo y convierte consultas en experiencias.
          </p>
          <div className="login-preview" aria-hidden>
            <div className="preview-head">
              <span className="avatar">ML</span>
              <div>
                <strong>María López</strong>
                <p>WhatsApp · Conversación de ejemplo</p>
              </div>
            </div>
            <div className="preview-bubble">¡Hola! ¿Puedo reservar para este sábado?</div>
            <div className="preview-bubble answer">¡Hola, María! Claro, te ayudo a planear tu visita.</div>
            <div className="preview-footer">
              <Icon name="checks" />
              Tu asistente responde. Tu equipo acompaña.
            </div>
          </div>
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
          <h2>Bienvenido</h2>
          <p className="muted">Entra a tu espacio de trabajo para continuar.</p>
          <label className="field">
            <span>Correo electrónico</span>
            <input name="email" type="email" autoComplete="username" required placeholder="tu@correo.com" />
          </label>
          <label className="field">
            <span>Contraseña</span>
            <span className="password">
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                minLength={8}
                placeholder="Tu contraseña"
              />
              <button
                type="button"
                className="icon-btn"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                <Icon name="eye" />
              </button>
            </span>
          </label>
          {error && <p className="error">{error}</p>}
          <button className="btn full" disabled={loading}>
            {loading ? "Entrando…" : "Entrar al espacio"}
          </button>
          <p className="demo-caption">
            ¿Aún no tienes cuenta? <Link href="/register">Crear un espacio</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
