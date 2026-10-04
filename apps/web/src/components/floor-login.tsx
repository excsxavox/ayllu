"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api, setSession } from "@/lib/api";
import { useMounted } from "@/lib/use-mounted";
import { LoadingState } from "@/components/loading-state";
import "./floor-login.css";

export function FloorLogin() {
  const router = useRouter();
  const mounted = useMounted();
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setHint("");
    const form = new FormData(e.currentTarget);
    try {
      const res = await api<{
        accessToken: string;
        refreshToken: string;
        defaultCompanyId: string | null;
      }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      setSession({
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
        companyId: res.defaultCompanyId,
      });
      router.replace("/floor");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (!mounted) {
    return (
      <main className="ayllu-login">
        <section className="panel">
          <LoadingState compact label="Cargando…" />
        </section>
      </main>
    );
  }

  return (
    <main className="ayllu-login">
      <section className="paisaje" aria-label="AYLLU">
        <img src="/lago-ilustrativo.png" alt="Vista ilustrativa del lago y sus instalaciones" />
        <p className="marca">AYLLU</p>
      </section>

      <section className="panel" aria-labelledby="titulo">
        <form id="login-form" onSubmit={onSubmit} autoComplete="on">
          <span className="etiqueta">Acceso del personal</span>
          <h1 id="titulo">Bienvenido al equipo</h1>
          <p className="descripcion">Ingresa para gestionar el lago.</p>

          <label htmlFor="email">Correo electrónico</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            placeholder="equipo@ayllu.ec"
            maxLength={120}
            required
            defaultValue="admin@aylluu.local"
          />

          <label htmlFor="password">Contraseña</label>
          <div className="clave">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              minLength={6}
              required
              defaultValue="Admin1234"
            />
            <button
              className="ver"
              id="ver-clave"
              type="button"
              aria-controls="password"
              aria-pressed={showPassword}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? "Ocultar" : "Ver"}
            </button>
          </div>

          <button className="entrar" type="submit" disabled={loading}>
            {loading ? "Entrando…" : "Ingresar"}
          </button>

          <button
            className="recuperar"
            id="recuperar"
            type="button"
            onClick={() => setHint("Solicita la recuperación de tu acceso a la administración de AYLLU.")}
          >
            Recuperar acceso
          </button>

          <p id="mensaje" role="status" aria-live="polite">
            {error || hint}
          </p>

          <p className="nota">AYLLU · Acceso del equipo</p>
        </form>
      </section>
    </main>
  );
}
