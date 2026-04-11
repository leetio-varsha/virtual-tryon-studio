"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Set cookie and redirect
    document.cookie = `stim-auth=${password}; path=/; max-age=${60 * 60 * 24 * 30}`; // 30 days
    router.push("/");
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-4">
        <h1 className="text-xl font-semibold text-center">Stim Try-On</h1>
        <input
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(false); }}
          placeholder="Пароль"
          className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-accent"
          autoFocus
        />
        {error && <p className="text-red-400 text-sm text-center">Неверный пароль</p>}
        <button
          type="submit"
          className="w-full py-3 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-semibold transition-colors"
        >
          Войти
        </button>
      </form>
    </div>
  );
}
