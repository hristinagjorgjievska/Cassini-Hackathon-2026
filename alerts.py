"""
alerts.py
---------
Alert delivery for critical water quality events.

Trigger conditions (ANY of the following fires an alert):

    1. REALTIME:  pollution_status == "HIGH"  AND  rainfall_impact in {"HIGH", "EXTREME"}
                  → Active bloom + active runoff compounding it right now.

    2. EU_BREACH: eu_alert.triggered == True  (current OR forecast)
                  → Measured or projected NDCI exceeds EU Bathing Water Directive
                    2006/7/EC safe limit (NDCI > 0.20, category POOR).

Both conditions are evaluated independently. If both fire on the same analysis
the alert_type will be "REALTIME+EU_BREACH" so the recipient can distinguish.

Delivery channels:
    1. Webhook — HTTP POST to a configurable URL (n8n, Zapier, your frontend, etc.)
    2. Email   — via SMTP (Gmail, Outlook, SendGrid SMTP relay, etc.)

Configuration (environment variables — never hardcode credentials):
    ALERT_WEBHOOK_URL      Webhook endpoint URL. Leave empty to disable.
    ALERT_EMAIL_TO         Comma-separated recipient addresses.
    ALERT_EMAIL_FROM       Sender address.
    ALERT_SMTP_HOST        SMTP server hostname  (default: smtp.gmail.com)
    ALERT_SMTP_PORT        SMTP port             (default: 587)
    ALERT_SMTP_USER        SMTP login username
    ALERT_SMTP_PASSWORD    SMTP login password / app password

Load from a .env file with python-dotenv or set in your deployment environment.
"""

import json
import logging
import os
import smtplib
import urllib.request
import urllib.error
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Dict, Any, Optional, List

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Trigger conditions
# ---------------------------------------------------------------------------

ALERT_POLLUTION_LEVELS = {"HIGH"}
ALERT_RAINFALL_LEVELS  = {"HIGH", "EXTREME"}


def _check_realtime_trigger(pollution_status: str, rainfall_impact: str) -> bool:
    """HIGH pollution + HIGH/EXTREME rainfall happening right now."""
    return (
        pollution_status in ALERT_POLLUTION_LEVELS
        and rainfall_impact in ALERT_RAINFALL_LEVELS
    )


def _check_eu_breach_trigger(eu_alert: Dict[str, Any]) -> bool:
    """EU Bathing Water Directive threshold breached (now or in forecast)."""
    return bool(eu_alert.get("triggered", False))


def evaluate_triggers(result: Dict[str, Any]) -> List[str]:
    """
    Evaluate all trigger conditions and return a list of active trigger names.

    Returns:
        List of strings from {"REALTIME", "EU_BREACH"}.
        Empty list = no alert needed.
    """
    triggers = []

    if _check_realtime_trigger(
        result.get("pollution_status", ""),
        result.get("rainfall_impact",  ""),
    ):
        triggers.append("REALTIME")

    if _check_eu_breach_trigger(result.get("eu_alert", {})):
        triggers.append("EU_BREACH")

    return triggers


# ---------------------------------------------------------------------------
# Payload builder
# ---------------------------------------------------------------------------

def build_alert_payload(result: Dict[str, Any], triggers: List[str]) -> Dict[str, Any]:
    """
    Build the alert payload sent to webhook and used in the email body.

    Args:
        result:   Full WaterAnalysisResponse dict
        triggers: List of active trigger names from evaluate_triggers()
    """
    loc      = result.get("location", {})
    forecast = result.get("forecast", [])
    eu_alert = result.get("eu_alert", {})

    # Worst forecast day = highest risk score
    worst_forecast = None
    if forecast:
        worst_forecast = max(forecast, key=lambda d: d.get("risk") or 0)

    # Build human-readable reason string
    reasons = []
    if "REALTIME" in triggers:
        reasons.append(
            f"HIGH pollution (NDCI={result.get('ndci')}) with "
            f"{result.get('rainfall_impact')} rainfall "
            f"({result.get('rainfall_mm')} mm over last 5 days)"
        )
    if "EU_BREACH" in triggers:
        days = eu_alert.get("days_until_exceedance")
        date = eu_alert.get("first_exceedance_date", "N/A")
        if days == 0:
            reasons.append("EU Bathing Water Directive limit exceeded RIGHT NOW (NDCI > 0.20)")
        else:
            reasons.append(
                f"EU Bathing Water Directive limit predicted to be exceeded "
                f"on {date} (day +{days})"
            )

    alert_type = "+".join(triggers)  # e.g. "REALTIME", "EU_BREACH", "REALTIME+EU_BREACH"

    return {
        "alert":               True,
        "alert_type":          alert_type,
        "alert_reason":        " | ".join(reasons),
        "location":            loc,
        "timestamp":           result.get("timestamp", datetime.utcnow().isoformat()),
        # Current measurements
        "pollution_status":    result.get("pollution_status"),
        "ndci":                result.get("ndci"),
        "ndwi":                result.get("ndwi"),
        "turbidity":           result.get("turbidity"),
        "suspendent_sediment": result.get("suspendent_sediment"),
        "water_detected":      result.get("water_detected"),
        # Rainfall
        "rainfall_mm":         result.get("rainfall_mm"),
        "rainfall_impact":     result.get("rainfall_impact"),
        # EU standard details
        "eu_alert":            eu_alert,
        # Worst upcoming forecast day (for email preview)
        "worst_forecast_day":  worst_forecast,
    }


# ---------------------------------------------------------------------------
# Webhook delivery
# ---------------------------------------------------------------------------

def send_webhook_alert(payload: Dict[str, Any]) -> bool:
    """
    POST the alert payload as JSON to ALERT_WEBHOOK_URL.
    Returns True on success, False on failure (never raises).
    """
    url = os.getenv("ALERT_WEBHOOK_URL", "").strip()
    if not url:
        logger.debug("Webhook alert skipped: ALERT_WEBHOOK_URL not set.")
        return False

    try:
        body = json.dumps(payload, default=str).encode("utf-8")
        req  = urllib.request.Request(
            url,
            data=body,
            headers={
                "Content-Type": "application/json",
                "User-Agent":   "WaterQualityMonitor/1.2",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            status = resp.status
        logger.info(f"Webhook alert sent → {url} [HTTP {status}]")
        return True

    except urllib.error.HTTPError as e:
        logger.warning(f"Webhook HTTP error: {e.code} {e.reason}")
    except urllib.error.URLError as e:
        logger.warning(f"Webhook connection error: {e.reason}")
    except Exception as e:
        logger.warning(f"Webhook unexpected error: {e}")
    return False


# ---------------------------------------------------------------------------
# Email delivery
# ---------------------------------------------------------------------------

def _build_email_html(payload: Dict[str, Any]) -> str:
    """Render a clean HTML email body from the alert payload."""
    loc      = payload.get("location", {})
    lat      = loc.get("lat", "N/A")
    lon      = loc.get("lon", "N/A")
    worst    = payload.get("worst_forecast_day")
    eu       = payload.get("eu_alert", {})
    atype    = payload.get("alert_type", "")

    # Color the alert type badge
    badge_color = "#c0392b" if "EU_BREACH" in atype else "#e67e22"

    # EU breach row (only if applicable)
    eu_row = ""
    if "EU_BREACH" in atype:
        eu_row = f"""
        <tr style="background:#fdecea;">
          <td><b>EU Directive breach</b></td>
          <td style="color:#c0392b;font-weight:bold;">{eu.get('message','N/A')}</td>
        </tr>"""

    # Worst forecast row
    forecast_row = ""
    if worst:
        color = {"BLUE": "#2980b9", "GREEN": "#27ae60", "YELLOW": "#f39c12", "RED": "#c0392b"}.get(
            worst.get("status_color", ""), "#555"
        )
        forecast_row = f"""
        <tr>
          <td><b>Worst forecast day</b></td>
          <td>
            <b>{worst.get('date','N/A')}</b> (day +{worst.get('day','?')}) —
            rain: {worst.get('rain','N/A')} mm,
            NDCI: {worst.get('pollution_pred','N/A')},
            <span style="color:{color};font-weight:bold;">{worst.get('category','N/A')}</span>
            (risk {worst.get('risk','N/A')})
          </td>
        </tr>"""

    return f"""
    <html><body style="font-family:Arial,sans-serif;color:#222;max-width:620px;margin:auto;">
      <h2 style="color:#c0392b;">⚠️ Water Quality Alert</h2>

      <p>
        <span style="background:{badge_color};color:#fff;padding:3px 10px;
                     border-radius:4px;font-size:13px;font-weight:bold;">
          {atype.replace('+', ' + ')}
        </span>
      </p>

      <p style="background:#fdecea;padding:12px;border-left:4px solid #c0392b;margin-top:12px;">
        {payload.get('alert_reason', 'Critical water quality event detected.')}
      </p>

      <table cellpadding="7" style="border-collapse:collapse;width:100%;">
        <tr style="background:#f5f5f5;">
          <td width="220"><b>Location</b></td>
          <td>lat={lat}, lon={lon}</td>
        </tr>
        <tr>
          <td><b>Timestamp</b></td>
          <td>{payload.get('timestamp','N/A')}</td>
        </tr>
        <tr style="background:#f5f5f5;">
          <td><b>Pollution status</b></td>
          <td style="color:#c0392b;font-weight:bold;">{payload.get('pollution_status','N/A')}</td>
        </tr>
        <tr>
          <td><b>NDCI (chlorophyll)</b></td>
          <td>{payload.get('ndci','N/A')}</td>
        </tr>
        <tr style="background:#f5f5f5;">
          <td><b>Rainfall (5-day)</b></td>
          <td>{payload.get('rainfall_mm','N/A')} mm — <b>{payload.get('rainfall_impact','N/A')}</b></td>
        </tr>
        <tr>
          <td><b>Turbidity</b></td>
          <td>{payload.get('turbidity','N/A')}</td>
        </tr>
        <tr style="background:#f5f5f5;">
          <td><b>Suspended sediment</b></td>
          <td>{payload.get('suspendent_sediment','N/A')}</td>
        </tr>
        <tr>
          <td><b>Water detected</b></td>
          <td>{payload.get('water_detected','N/A')}</td>
        </tr>
        {eu_row}
        {forecast_row}
      </table>

      <p style="color:#888;font-size:12px;margin-top:24px;">
        This alert was generated automatically by the Water Quality Monitor
        (EU Bathing Water Directive 2006/7/EC reference thresholds).
      </p>
    </body></html>
    """


def send_email_alert(payload: Dict[str, Any]) -> bool:
    """
    Send an HTML alert email via SMTP.
    Reads all config from environment variables. Never raises.
    """
    recipients_raw = os.getenv("ALERT_EMAIL_TO",       "").strip()
    sender         = os.getenv("ALERT_EMAIL_FROM",      "").strip()
    smtp_host      = os.getenv("ALERT_SMTP_HOST",       "smtp.gmail.com").strip()
    smtp_port      = int(os.getenv("ALERT_SMTP_PORT",   "587"))
    smtp_user      = os.getenv("ALERT_SMTP_USER",       "").strip()
    smtp_password  = os.getenv("ALERT_SMTP_PASSWORD",   "").strip()

    if not all([recipients_raw, sender, smtp_user, smtp_password]):
        logger.debug("Email alert skipped: SMTP credentials not fully configured.")
        return False

    recipients  = [r.strip() for r in recipients_raw.split(",") if r.strip()]
    loc         = payload.get("location", {})
    alert_type  = payload.get("alert_type", "ALERT")

    subject = (
        f"[{alert_type}] Water Quality — "
        f"{payload.get('pollution_status')} pollution + "
        f"{payload.get('rainfall_impact')} rainfall "
        f"@ lat={loc.get('lat')}, lon={loc.get('lon')}"
    )

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = sender
    msg["To"]      = ", ".join(recipients)

    plain = (
        f"Water Quality Alert [{alert_type}]\n\n"
        f"{payload.get('alert_reason')}\n\n"
        f"Location:  lat={loc.get('lat')}, lon={loc.get('lon')}\n"
        f"Timestamp: {payload.get('timestamp')}\n"
        f"Pollution: {payload.get('pollution_status')}  (NDCI={payload.get('ndci')})\n"
        f"Rainfall:  {payload.get('rainfall_mm')} mm ({payload.get('rainfall_impact')})\n"
        f"EU alert:  {payload.get('eu_alert', {}).get('message', 'N/A')}\n"
    )
    msg.attach(MIMEText(plain, "plain"))
    msg.attach(MIMEText(_build_email_html(payload), "html"))

    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.sendmail(sender, recipients, msg.as_string())
        logger.info(f"Email alert sent → {recipients}")
        return True

    except smtplib.SMTPAuthenticationError:
        logger.warning("Email alert failed: SMTP authentication error.")
    except smtplib.SMTPException as e:
        logger.warning(f"Email alert SMTP error: {e}")
    except Exception as e:
        logger.warning(f"Email alert unexpected error: {e}")
    return False


# ---------------------------------------------------------------------------
# Public entry point — called from api.py
# ---------------------------------------------------------------------------

def dispatch_alerts(result: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Evaluate all trigger conditions and dispatch alerts if any are met.

    Design contract:
    - NEVER raises — alert failure must never affect the API response.
    - Runs synchronously inside the thread-pool worker (same thread as _run_analysis),
      so it doesn't need its own executor.
    - Returns the alert payload so api.py can attach it to the response for
      observability (frontend can show "alert was fired" without polling).

    Args:
        result: Full analysis result dict (before Pydantic serialisation)

    Returns:
        Alert payload dict if any trigger fired, None otherwise.
    """
    try:
        triggers = evaluate_triggers(result)
        if not triggers:
            return None

        logger.warning(
            f"ALERT TRIGGERED [{'+'.join(triggers)}] — "
            f"pollution={result.get('pollution_status')}, "
            f"rainfall={result.get('rainfall_impact')}, "
            f"eu_alert={result.get('eu_alert', {}).get('triggered')}, "
            f"location={result.get('location')}"
        )

        payload    = build_alert_payload(result, triggers)
        webhook_ok = send_webhook_alert(payload)
        email_ok   = send_email_alert(payload)

        logger.info(
            f"Alert dispatch complete — "
            f"webhook={'OK' if webhook_ok else 'SKIPPED/FAILED'}, "
            f"email={'OK' if email_ok else 'SKIPPED/FAILED'}"
        )

        # Strip the full eu_alert object from the returned payload
        # (already present at top level of the API response — no duplication)
        payload.pop("eu_alert", None)
        return payload

    except Exception as e:
        # Absolute safety net — alerts must never crash the API
        logger.exception(f"dispatch_alerts unexpected error (non-fatal): {e}")
        return None