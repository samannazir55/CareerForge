"""
Email service for CareerForge.
Uses SMTP (Gmail / any provider). Falls back to console logging when not configured.
"""
import os
import smtplib
import secrets
import random
import string
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta, timezone
from pathlib import Path
from dotenv import load_dotenv

for _p in [
    Path(__file__).resolve().parent.parent.parent / '.env',
    Path(__file__).resolve().parent.parent.parent.parent / '.env',
]:
    if _p.exists():
        load_dotenv(_p); break
load_dotenv()


def generate_otp() -> str:
    """Cryptographically secure 6-digit OTP."""
    return str(secrets.randbelow(900000) + 100000)


def otp_expiry(minutes: int = 10) -> datetime:
    return datetime.now(timezone.utc) + timedelta(minutes=minutes)


def _get_smtp_config() -> dict:
    return {
        "host":     os.getenv("SMTP_HOST", "smtp.gmail.com"),
        "port":     int(os.getenv("SMTP_PORT", "587")),
        "user":     os.getenv("SMTP_USER", ""),
        "password": os.getenv("SMTP_PASSWORD", ""),
        "from":     os.getenv("SMTP_FROM", os.getenv("SMTP_USER", "noreply@careerforge.app")),
    }


def _otp_html(name: str, otp: str) -> str:
    first = name.split()[0] if name else "there"
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f4f4f8;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f8;padding:40px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0"
             style="background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#6D5FFA 0%,#A855F7 100%);padding:36px 40px;text-align:center;">
            <div style="display:inline-flex;align-items:center;gap:10px;">
              <div style="width:36px;height:36px;background:rgba(255,255,255,0.2);border-radius:10px;
                          display:inline-flex;align-items:center;justify-content:center;font-size:18px;">⚡</div>
              <span style="color:#fff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">CareerForge</span>
            </div>
            <p style="color:rgba(255,255,255,0.85);margin:10px 0 0;font-size:14px;">AI Career Platform</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 32px;">
            <h2 style="margin:0 0 8px;font-size:22px;color:#0D0F14;font-weight:600;">
              Verify your email address
            </h2>
            <p style="margin:0 0 28px;color:#6B7280;font-size:15px;line-height:1.6;">
              Hi {first}, use the code below to confirm your email and activate your CareerForge account.
              This code expires in <strong>10 minutes</strong>.
            </p>

            <!-- OTP box -->
            <div style="background:#F5F3FF;border:2px solid #E9D5FF;border-radius:16px;
                        padding:28px;text-align:center;margin-bottom:28px;">
              <div style="letter-spacing:12px;font-size:42px;font-weight:800;color:#6D5FFA;
                          font-family:'Courier New',monospace;">{otp}</div>
              <p style="margin:12px 0 0;font-size:12px;color:#9CA3AF;">
                Enter this code on the verification page
              </p>
            </div>

            <p style="color:#9CA3AF;font-size:13px;line-height:1.5;margin:0;">
              If you didn't create a CareerForge account, you can safely ignore this email.
              Never share this code with anyone.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#F9FAFB;padding:20px 40px;border-top:1px solid #F3F4F6;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9CA3AF;">
              © 2025 CareerForge · AI Career Platform
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""


def send_otp_email(to_email: str, full_name: str, otp: str) -> bool:
    cfg = _get_smtp_config()

    if not cfg["user"] or not cfg["password"]:
        # Dev mode — print to console instead of failing
        print(f"\n{'='*50}")
        print(f"📧  OTP EMAIL (dev mode — SMTP not configured)")
        print(f"   To:   {to_email}")
        print(f"   Name: {full_name}")
        print(f"   OTP:  {otp}")
        print(f"{'='*50}\n")
        return True  # Treat as success so flow continues locally

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"{otp} — Verify your CareerForge account"
    msg["From"]    = f"CareerForge <{cfg['from']}>"
    msg["To"]      = to_email

    msg.attach(MIMEText(
        f"Your CareerForge verification code is: {otp}\n\nExpires in 10 minutes.",
        "plain"
    ))
    msg.attach(MIMEText(_otp_html(full_name, otp), "html"))

    try:
        with smtplib.SMTP(cfg["host"], cfg["port"], timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.login(cfg["user"], cfg["password"])
            server.sendmail(cfg["from"], [to_email], msg.as_string())
        print(f"✅ OTP email sent to {to_email}")
        return True
    except Exception as e:
        print(f"❌ Email send failed: {e}")
        return False
