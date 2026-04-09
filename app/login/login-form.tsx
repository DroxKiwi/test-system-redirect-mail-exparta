
"use client";

import Link from "next/link";
import { useState } from "react";

export function LoginForm() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
    }

    return (
        <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-zinc-50 px-4 py-16 dark:bg-black">
            <div className="w-full max-w-sm rounded-2xl border border-black/[.08] bg-white p-8 shadow-sm dark:border-white/[.145] dark:bg-black">
                <h1 className="text-center text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
                    Connexion
                </h1>
                <p className="mt-2 text-center text-sm text-zinc-600 dark:text-zinc-400">
                    Entrez vos identifiants pour accéder à votre compte.
                </p>
                <form className="mt-8 flex flex-col gap-5" onSubmit={handleSubmit}>
                    <div className="flex flex-col gap-2">
                        <label
                            htmlFor="username"
                            className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
                        >
                            Identifiant
                        </label>
                        <input
                            id="username"
                            name="username"
                            type="text"
                            autoComplete="username"
                            required
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="rounded-md border border-black/[.08] bg-white px-3 py-2 text-sm text-black placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-black dark:border-white/[.145] dark:bg-black dark:text-zinc-50 dark:placeholder:text-zinc-600"
                            placeholder="Entrez votre identifiant"
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label
                            htmlFor="password"
                            className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
                        >
                            Mot de passe
                        </label>
                        <input
                            type="password"
                            id="password"
                            name="password"
                            autoComplete="current-password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="rounded-md border border-black/[.08] bg-white px-3 py-2 text-sm text-black placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-black dark:border-white/[.145] dark:bg-black dark:text-zinc-50 dark:placeholder:text-zinc-600"
                            placeholder="********"
                        />
                    </div>
                    <button
                        type="submit"
                        className="mt-1 flex h-11 w-full items-center justify-center rounded-full bg-foreground px-5 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
                    >
                        Se connecter
                    </button>
                </form>
                <p className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
                    <Link
                        href="/"
                        className="font-medium text-zinc-950 underline-offset-4 hover:underline dark:text-zinc-50"
                    >
                        Retour à l'accueil
                    </Link>
                </p>
            </div>
        </div>
    )
}