import argparse
import smtplib
from email.message import EmailMessage


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Envoie un mail de test vers le SMTP local."
    )
    parser.add_argument("--host", default="localhost", help="Hote SMTP (defaut: localhost)")
    parser.add_argument("--port", type=int, default=2525, help="Port SMTP (defaut: 2525)")
    parser.add_argument("--sender", default="alice@example.com", help="Adresse expediteur")
    parser.add_argument("--to", default="test@in.local", help="Adresse destinataire")
    parser.add_argument("--subject", default="Test SMTP local", help="Sujet du mail")
    parser.add_argument(
        "--body",
        default="Hello depuis un test local.",
        help="Corps du mail en texte brut",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    msg = EmailMessage()
    msg["From"] = args.sender
    msg["To"] = args.to
    msg["Subject"] = args.subject
    msg.set_content(args.body)

    with smtplib.SMTP(args.host, args.port, timeout=10) as smtp:
        smtp.send_message(msg)

    print(
        f"Mail de test envoye: from={args.sender} to={args.to} "
        f"via {args.host}:{args.port}"
    )


if __name__ == "__main__":
    main()
