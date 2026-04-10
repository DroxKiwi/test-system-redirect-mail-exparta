"""Ecriture du journal MailFlowEvent dans Postgres (meme schema que Prisma)."""

from __future__ import annotations

import re
from typing import Any

import psycopg
from psycopg.types.json import Json

_ANGLE = re.compile(r"^<([^>]+)>$")


def _parse_rcpt(addr: str) -> tuple[str, str] | None:
    s = addr.strip()
    m = _ANGLE.match(s)
    core = m.group(1).strip() if m else s
    at = core.rfind("@")
    if at <= 0 or at == len(core) - 1:
        return None
    local, domain = core[:at].strip(), core[at + 1 :].strip().lower()
    if not local or not domain:
        return None
    return (local, domain)


def resolve_user_id(conn: psycopg.Connection, rcpt_tos: list[str]) -> int | None:
    for raw in rcpt_tos:
        parsed = _parse_rcpt(raw)
        if not parsed:
            continue
        local, domain = parsed
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT "userId" FROM "InboundAddress"
                WHERE "isActive" = true
                  AND LOWER("domain") = LOWER(%s)
                  AND LOWER("localPart") = LOWER(%s)
                LIMIT 1
                """,
                (domain, local),
            )
            row = cur.fetchone()
            if row and row[0] is not None:
                return int(row[0])
    return None


def insert_flow_event(
    dsn: str,
    correlation_id: str,
    user_id: int | None,
    actor: str,
    step: str,
    direction: str,
    summary: str,
    detail: dict[str, Any] | None = None,
) -> None:
    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO "MailFlowEvent"
                ("correlationId", "userId", "actor", "step", "direction", "summary", "detail")
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    correlation_id,
                    user_id,
                    actor,
                    step,
                    direction,
                    summary[:4000],
                    Json(detail) if detail is not None else None,
                ),
            )
        conn.commit()


def log_smtp_received(
    dsn: str,
    correlation_id: str,
    mail_from: str | None,
    rcpt_tos: list[str],
    remote_ip: str,
    raw_size: int,
) -> int | None:
    """Retourne le userId deduit du premier destinataire connu, pour reutilisation."""
    if not dsn.strip():
        return None
    with psycopg.connect(dsn) as conn:
        user_id = resolve_user_id(conn, rcpt_tos)
        summary = (
            f"SMTP DATA recu de {mail_from or '?'} vers {len(rcpt_tos)} destinataire(s), "
            f"{raw_size} octets"
        )
        detail: dict[str, Any] = {
            "mailFrom": mail_from,
            "rcptTo": rcpt_tos,
            "remoteIp": remote_ip,
            "rawSize": raw_size,
        }
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO "MailFlowEvent"
                ("correlationId", "userId", "actor", "step", "direction", "summary", "detail")
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    correlation_id,
                    user_id,
                    "smtp-gateway",
                    "smtp_data_received",
                    "in",
                    summary,
                    Json(detail),
                ),
            )
        conn.commit()
        return user_id


def log_http_forward_out(
    dsn: str,
    correlation_id: str,
    user_id: int | None,
    url: str,
) -> None:
    if not dsn.strip():
        return
    insert_flow_event(
        dsn,
        correlation_id,
        user_id,
        "smtp-gateway",
        "http_post_inbound_api",
        "out",
        f"POST vers l API Next ({url})",
        {"url": url},
    )


def log_http_forward_result(
    dsn: str,
    correlation_id: str,
    user_id: int | None,
    status_code: int,
    ok: bool,
) -> None:
    if not dsn.strip():
        return
    insert_flow_event(
        dsn,
        correlation_id,
        user_id,
        "smtp-gateway",
        "http_post_response",
        "in",
        f"Reponse HTTP {status_code}" + (" OK" if ok else " erreur"),
        {"statusCode": status_code, "ok": ok},
    )
