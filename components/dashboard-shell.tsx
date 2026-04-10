import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { LogoutButton } from "@/components/logout-button";

type DashboardTab =
  | "archive"
  | "boite"
  | "flux"
  | "historique"
  | "reglages"
  | "transfere";

type DashboardShellProps = {
  currentTab: DashboardTab;
  title: string;
  userEmail: string;
  /** Si false, le contenu n’est pas enveloppé dans la carte (ex. lecteur message). */
  contentFrame?: boolean;
  /** Actions à droite du titre (ex. bouton secondaire). */
  titleActions?: ReactNode;
  children: ReactNode;
};

function tabClass(isActive: boolean): string {
  if (isActive) {
    return "bg-primary text-primary-foreground";
  }

  return "text-muted-foreground hover:bg-muted hover:text-foreground";
}

export function DashboardShell({
  currentTab,
  title,
  userEmail,
  contentFrame = true,
  titleActions,
  children,
}: DashboardShellProps) {
  return (
    <div className="flex min-h-screen w-full flex-col bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-40 flex w-24 flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar px-2 py-4 md:w-80 md:px-5">
        <div className="mb-5 flex justify-center md:justify-start">
          <Link
            href="/"
            className="inline-block max-w-full rounded-sm outline-none ring-sidebar-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
          >
            <Image
              src="/logo_sans_fond.png"
              alt="Exparta"
              width={1000}
              height={350}
              className="h-auto w-full max-w-full object-contain object-center md:object-left"
              priority
              sizes="(max-width: 767px) 128px, 360px"
            />
          </Link>
        </div>

        <nav className="flex flex-col gap-2">
          <Link
            href="/flux"
            className={`rounded-md px-3 py-2 text-sm font-medium transition ${tabClass(
              currentTab === "flux"
            )}`}
          >
            Flux
          </Link>
          <Link
            href="/boite"
            className={`rounded-md px-3 py-2 text-sm font-medium transition ${tabClass(
              currentTab === "boite"
            )}`}
          >
            <span className="md:hidden">Boite</span>
            <span className="hidden md:inline">Boite de reception</span>
          </Link>
          <Link
            href="/archive"
            className={`rounded-md px-3 py-2 text-sm font-medium transition ${tabClass(
              currentTab === "archive"
            )}`}
          >
            Archive
          </Link>
          <Link
            href="/transfere"
            className={`rounded-md px-3 py-2 text-sm font-medium transition ${tabClass(
              currentTab === "transfere"
            )}`}
          >
            <span className="md:hidden">Transf.</span>
            <span className="hidden md:inline">Transféré</span>
          </Link>
          <Link
            href="/historique"
            className={`rounded-md px-3 py-2 text-sm font-medium transition ${tabClass(
              currentTab === "historique"
            )}`}
          >
            Historique
          </Link>
          <Link
            href="/reglages"
            className={`rounded-md px-3 py-2 text-sm font-medium transition ${tabClass(
              currentTab === "reglages"
            )}`}
          >
            Reglages
          </Link>
        </nav>

        <div className="mt-auto rounded-lg border border-sidebar-border bg-card p-3">
          <p className="text-sm font-semibold">Mon profil</p>
          <p className="mt-1 break-all text-xs text-muted-foreground" title={userEmail}>
            {userEmail}
          </p>
          <LogoutButton />
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col pl-24 md:pl-80">
        <main className="min-w-0 flex-1 p-4 md:p-8">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <h1 className="line-clamp-2 min-w-0 flex-1 text-balance" title={title}>
              {title}
            </h1>
            {titleActions ? (
              <div className="flex shrink-0 flex-wrap items-center gap-2">{titleActions}</div>
            ) : null}
          </div>
          {contentFrame ? (
            <section className="rounded-lg border border-border bg-card p-4 text-card-foreground shadow-xs md:p-6">
              {children}
            </section>
          ) : (
            children
          )}
        </main>

        <footer className="border-t border-border bg-secondary px-4 py-3 text-center text-sm text-secondary-foreground">
          Mail Proxy — routage et règles de messagerie professionnelle
        </footer>
      </div>
    </div>
  );
}
