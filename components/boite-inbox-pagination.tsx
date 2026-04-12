import Link from "next/link";
import {
  BOITE_INBOX_PER_PAGE_OPTIONS,
  type BoiteInboxPerPage,
} from "@/lib/boite-messages";
import { cn } from "@/lib/utils";

function inboxHref(page: number, perPage: BoiteInboxPerPage): string {
  const p = new URLSearchParams();
  if (page > 1) p.set("page", String(page));
  if (perPage !== 50) p.set("perPage", String(perPage));
  const q = p.toString();
  return q ? `/boite?${q}` : "/boite";
}

type BoiteInboxPaginationProps = {
  page: number;
  perPage: BoiteInboxPerPage;
  total: number;
};

export function BoiteInboxPagination({
  page,
  perPage,
  total,
}: BoiteInboxPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, totalPages);
  const from = total === 0 ? 0 : (safePage - 1) * perPage + 1;
  const to = Math.min(safePage * perPage, total);

  return (
    <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        {total === 0
          ? "Aucun message sur cette page."
          : `${from}–${to} sur ${total} message${total > 1 ? "s" : ""}`}
      </p>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Par page</span>
          <div className="inline-flex rounded-md border border-border bg-muted/30 p-0.5">
            {BOITE_INBOX_PER_PAGE_OPTIONS.map((n) => (
              <Link
                key={n}
                href={inboxHref(1, n)}
                className={cn(
                  "rounded px-2.5 py-1 text-sm font-medium transition-colors",
                  perPage === n
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {n}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {safePage > 1 ? (
            <Link
              href={inboxHref(safePage - 1, perPage)}
              className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted"
            >
              Précédent
            </Link>
          ) : (
            <span className="inline-flex h-9 cursor-not-allowed items-center justify-center rounded-md border border-border/50 bg-muted/40 px-3 text-sm text-muted-foreground">
              Précédent
            </span>
          )}
          <span className="min-w-[5rem] text-center text-sm tabular-nums text-muted-foreground">
            Page {safePage} / {totalPages}
          </span>
          {safePage < totalPages ? (
            <Link
              href={inboxHref(safePage + 1, perPage)}
              className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted"
            >
              Suivant
            </Link>
          ) : (
            <span className="inline-flex h-9 cursor-not-allowed items-center justify-center rounded-md border border-border/50 bg-muted/40 px-3 text-sm text-muted-foreground">
              Suivant
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
