"""Outgoing email.

Uses SMTP when SMTP_HOST is configured. Otherwise the message (including any
verification or reset link) is written to the server log so the flow can be
completed in local development without an email provider.
"""
import asyncio
import logging
import smtplib
from email.message import EmailMessage

from app.core.config import settings

logger = logging.getLogger("foodrescue.mailer")


def _send_smtp(to: str, subject: str, body: str) -> None:
    msg = EmailMessage()
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)
    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as smtp:
        smtp.starttls()
        if settings.SMTP_USERNAME:
            smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD or "")
        smtp.send_message(msg)


async def send_email(to: str, subject: str, body: str) -> None:
    if settings.SMTP_HOST:
        try:
            await asyncio.to_thread(_send_smtp, to, subject, body)
        except Exception:  # never fail the request because mail is down
            logger.exception("Failed to send email to %s", to)
        return
    logger.warning("EMAIL (no SMTP configured) to=%s subject=%s\n%s", to, subject, body)
    print(f"[mailer] to={to} subject={subject}\n{body}", flush=True)
