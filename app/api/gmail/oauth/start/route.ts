import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth-user";
import {
  GMAIL_OAUTH_SCOPES,
  getGmailOAuth2Client,
} from "@/lib/gmail/oauth";

const STATE_COOKIE = "gmail_oauth_state";
const STATE_MAX_AGE_SEC = 600;

/**
 * Démarre le flux OAuth Google : redirection vers le consentement.
 * Prérequis : identifiants OAuth renseignés dans Reglages (base de données).
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  let oauth2: Awaited<ReturnType<typeof getGmailOAuth2Client>>;
  try {
    oauth2 = await getGmailOAuth2Client();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  const state = randomBytes(32).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    path: "/",
    maxAge: STATE_MAX_AGE_SEC,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  const url = oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [...GMAIL_OAUTH_SCOPES],
    state,
    include_granted_scopes: true,
  });

  return NextResponse.redirect(url);
}
