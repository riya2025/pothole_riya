"""
Auto-email civic complaints to GHMC with the original photo attached.

Uses plain SMTP (stdlib) so it works with any provider — Gmail (app password),
SendGrid, Mailgun, etc. Configure the SMTP_* and GHMC_EMAIL env vars to enable it;
if they're not set, sending is silently skipped (the rest of the report flow is
unaffected).
"""
import asyncio
import logging
import os
import smtplib
from email.message import EmailMessage

from app.config import settings

logger = logging.getLogger(__name__)

# Hold references to in-flight background tasks so they aren't garbage collected.
_pending_tasks: set[asyncio.Task] = set()

_TYPE_LABEL = {
    "pothole": "Pothole on the road",
    "garbage": "Garbage / uncleared waste",
    "streetlight": "Streetlight not working",
    "other": "Civic issue",
}

_SUBTYPE_BY_EXT = {
    ".jpg": "jpeg",
    ".jpeg": "jpeg",
    ".png": "png",
    ".gif": "gif",
    ".webp": "webp",
}


def email_configured() -> bool:
    return bool(
        settings.SMTP_HOST
        and settings.SMTP_USER
        and settings.SMTP_PASSWORD
        and settings.GHMC_EMAIL
    )


def _build_body(
    issue_type: str,
    address: str | None,
    lat: float,
    lng: float,
    description: str | None,
    image_url: str | None,
) -> str:
    lines = [
        "GHMC Civic Complaint",
        "",
        f"Issue: {_TYPE_LABEL.get(issue_type, 'Civic issue')}",
    ]
    if address:
        lines.append(f"Address: {address}")
    lines.append(f"Location: {lat:.5f}, {lng:.5f}")
    lines.append(f"Map: https://www.google.com/maps?q={lat},{lng}")
    if description:
        lines.append("")
        lines.append(f"Description: {description}")
    if image_url:
        lines.append("")
        lines.append(f"Photo (online copy): {image_url}")
    lines.append("")
    lines.append("The original photo is attached to this email.")
    lines.append("Reported via CivicWatch.")
    return "\n".join(lines)


def _send_sync(
    subject: str,
    body: str,
    image_bytes: bytes | None,
    image_filename: str | None,
) -> None:
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM or settings.SMTP_USER
    msg["To"] = settings.GHMC_EMAIL
    msg.set_content(body)

    if image_bytes:
        ext = os.path.splitext(image_filename or "")[-1].lower()
        subtype = _SUBTYPE_BY_EXT.get(ext, "jpeg")
        filename = image_filename or f"complaint.{subtype}"
        msg.add_attachment(
            image_bytes,
            maintype="image",
            subtype=subtype,
            filename=filename,
        )

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20) as server:
        server.starttls()
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.send_message(msg)


async def send_complaint_email(
    *,
    issue_type: str,
    address: str | None,
    lat: float,
    lng: float,
    description: str | None,
    image_bytes: bytes | None,
    image_filename: str | None,
    image_url: str | None,
) -> None:
    """Send the complaint (best-effort). Never raises — failures are logged only."""
    if not email_configured():
        return
    try:
        subject = f"GHMC Civic Complaint — {_TYPE_LABEL.get(issue_type, 'Civic issue')}"
        body = _build_body(issue_type, address, lat, lng, description, image_url)
        await asyncio.to_thread(_send_sync, subject, body, image_bytes, image_filename)
        logger.info("GHMC complaint email sent for %s at %.5f,%.5f", issue_type, lat, lng)
    except Exception as exc:  # noqa: BLE001 — email must never break the report flow
        logger.warning("Failed to send GHMC complaint email: %s", exc)


def queue_complaint_email(**kwargs) -> None:
    """Fire-and-forget the email so the report response isn't delayed by SMTP."""
    if not email_configured():
        return
    task = asyncio.create_task(send_complaint_email(**kwargs))
    _pending_tasks.add(task)
    task.add_done_callback(_pending_tasks.discard)
