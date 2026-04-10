import asyncio
import os
import uuid
from typing import Any

import httpx
from aiosmtpd.controller import Controller

from db_flow import (
    log_http_forward_out,
    log_http_forward_result,
    log_smtp_received,
)

SMTP_HOST = os.getenv("SMTP_HOST", "0.0.0.0")
SMTP_PORT = int(os.getenv("SMTP_PORT", "2525"))
INBOUND_URL = os.getenv(
    "INBOUND_URL", "http://host.docker.internal:3000/api/inbound/mail"
)
INBOUND_SECRET = os.getenv("INBOUND_SECRET", "change-me")
REQUEST_TIMEOUT_SEC = float(os.getenv("REQUEST_TIMEOUT_SEC", "10"))
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()


class SMTPHandler:
    async def handle_DATA(self, server: Any, session: Any, envelope: Any) -> str:
        correlation_id = str(uuid.uuid4())
        raw = envelope.content or b""
        raw_text = raw.decode("utf-8", errors="replace")
        mail_from = envelope.mail_from
        rcpt_tos = list(envelope.rcpt_tos or [])
        remote_ip = str(getattr(session, "peer", ("unknown",))[0])

        def db_log_receive() -> int | None:
            return log_smtp_received(
                DATABASE_URL,
                correlation_id,
                mail_from,
                rcpt_tos,
                remote_ip,
                len(raw),
            )

        user_id: int | None = None
        if DATABASE_URL:
            try:
                user_id = await asyncio.to_thread(db_log_receive)
            except Exception as exc:
                print(f"[smtp-gateway] DB log (receive) error: {exc}")

        payload = {
            "traceId": correlation_id,
            "mailFrom": mail_from,
            "rcptTo": rcpt_tos,
            "remoteIp": remote_ip,
            "raw": raw_text,
        }

        headers = {"X-Inbound-Secret": INBOUND_SECRET}

        if DATABASE_URL:
            try:
                await asyncio.to_thread(
                    log_http_forward_out, DATABASE_URL, correlation_id, user_id, INBOUND_URL
                )
            except Exception as exc:
                print(f"[smtp-gateway] DB log (http out) error: {exc}")

        try:
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SEC) as client:
                response = await client.post(
                    INBOUND_URL, json=payload, headers=headers
                )
                status = response.status_code
                ok = response.is_success
                if DATABASE_URL:
                    try:
                        await asyncio.to_thread(
                            log_http_forward_result,
                            DATABASE_URL,
                            correlation_id,
                            user_id,
                            status,
                            ok,
                        )
                    except Exception as exc:
                        print(f"[smtp-gateway] DB log (http result) error: {exc}")
                response.raise_for_status()
        except Exception as exc:
            print(f"[smtp-gateway] Forward error: {exc}")
            return "451 Temporary local problem, please try later"

        print(
            f"[smtp-gateway] Accepted mail traceId={correlation_id} "
            f"from={envelope.mail_from} to={envelope.rcpt_tos}"
        )
        return "250 Message accepted for delivery"


def main() -> None:
    controller = Controller(SMTPHandler(), hostname=SMTP_HOST, port=SMTP_PORT)
    controller.start()
    print(
        f"[smtp-gateway] Listening on {SMTP_HOST}:{SMTP_PORT}, forwarding to {INBOUND_URL}"
    )
    if DATABASE_URL:
        print("[smtp-gateway] Mail flow logging: Postgres OK (DATABASE_URL defini)")
    else:
        print("[smtp-gateway] Mail flow logging: Postgres desactive (pas de DATABASE_URL)")

    try:
        asyncio.get_event_loop().run_forever()
    except KeyboardInterrupt:
        pass
    finally:
        controller.stop()


if __name__ == "__main__":
    main()
