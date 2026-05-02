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
ALERT_POLLUTION_LEVELS = {'HIGH'}
ALERT_RAINFALL_LEVELS = {'HIGH', 'EXTREME'}

def _check_realtime_trigger(pollution_status: str, rainfall_impact: str) -> bool:
    return pollution_status in ALERT_POLLUTION_LEVELS and rainfall_impact in ALERT_RAINFALL_LEVELS

def _check_eu_breach_trigger(eu_alert: Dict[str, Any]) -> bool:
    return bool(eu_alert.get('triggered', False))

def evaluate_triggers(result: Dict[str, Any]) -> List[str]:
    triggers = []
    if _check_realtime_trigger(result.get('pollution_status', ''), result.get('rainfall_impact', '')):
        triggers.append('REALTIME')
    if _check_eu_breach_trigger(result.get('eu_alert', {})):
        triggers.append('EU_BREACH')
    return triggers

def build_alert_payload(result: Dict[str, Any], triggers: List[str]) -> Dict[str, Any]:
    loc = result.get('location', {})
    forecast = result.get('forecast', [])
    eu_alert = result.get('eu_alert', {})
    worst_forecast = None
    if forecast:
        worst_forecast = max(forecast, key=lambda d: d.get('risk') or 0)
    reasons = []
    if 'REALTIME' in triggers:
        reasons.append(f"HIGH pollution (NDCI={result.get('ndci')}) with {result.get('rainfall_impact')} rainfall ({result.get('rainfall_mm')} mm over last 5 days)")
    if 'EU_BREACH' in triggers:
        days = eu_alert.get('days_until_exceedance')
        date = eu_alert.get('first_exceedance_date', 'N/A')
        if days == 0:
            reasons.append('EU Bathing Water Directive limit exceeded RIGHT NOW (NDCI > 0.20)')
        else:
            reasons.append(f'EU Bathing Water Directive limit predicted to be exceeded on {date} (day +{days})')
    alert_type = '+'.join(triggers)
    return {'alert': True, 'alert_type': alert_type, 'alert_reason': ' | '.join(reasons), 'location': loc, 'timestamp': result.get('timestamp', datetime.utcnow().isoformat()), 'pollution_status': result.get('pollution_status'), 'ndci': result.get('ndci'), 'ndwi': result.get('ndwi'), 'turbidity': result.get('turbidity'), 'suspendent_sediment': result.get('suspendent_sediment'), 'water_detected': result.get('water_detected'), 'rainfall_mm': result.get('rainfall_mm'), 'rainfall_impact': result.get('rainfall_impact'), 'eu_alert': eu_alert, 'worst_forecast_day': worst_forecast}

def send_webhook_alert(payload: Dict[str, Any]) -> bool:
    url = os.getenv('ALERT_WEBHOOK_URL', '').strip()
    if not url:
        logger.debug('Webhook alert skipped: ALERT_WEBHOOK_URL not set.')
        return False
    try:
        body = json.dumps(payload, default=str).encode('utf-8')
        req = urllib.request.Request(url, data=body, headers={'Content-Type': 'application/json', 'User-Agent': 'WaterQualityMonitor/1.2'}, method='POST')
        with urllib.request.urlopen(req, timeout=10) as resp:
            status = resp.status
        logger.info(f'Webhook alert sent → {url} [HTTP {status}]')
        return True
    except urllib.error.HTTPError as e:
        logger.warning(f'Webhook HTTP error: {e.code} {e.reason}')
    except urllib.error.URLError as e:
        logger.warning(f'Webhook connection error: {e.reason}')
    except Exception as e:
        logger.warning(f'Webhook unexpected error: {e}')
    return False

def _build_email_html(payload: Dict[str, Any]) -> str:
    loc = payload.get('location', {})
    lat = loc.get('lat', 'N/A')
    lon = loc.get('lon', 'N/A')
    worst = payload.get('worst_forecast_day')
    eu = payload.get('eu_alert', {})
    atype = payload.get('alert_type', '')
    badge_color = '#c0392b' if 'EU_BREACH' in atype else '#e67e22'
    eu_row = ''
    if 'EU_BREACH' in atype:
        eu_row = f"""\n        <tr style="background:#fdecea;">\n          <td><b>EU Directive breach</b></td>\n          <td style="color:#c0392b;font-weight:bold;">{eu.get('message', 'N/A')}</td>\n        </tr>"""
    forecast_row = ''
    if worst:
        color = {'BLUE': '#2980b9', 'GREEN': '#27ae60', 'YELLOW': '#f39c12', 'RED': '#c0392b'}.get(worst.get('status_color', ''), '#555')
        forecast_row = f"""\n        <tr>\n          <td><b>Worst forecast day</b></td>\n          <td>\n            <b>{worst.get('date', 'N/A')}</b> (day +{worst.get('day', '?')}) —\n            rain: {worst.get('rain', 'N/A')} mm,\n            NDCI: {worst.get('pollution_pred', 'N/A')},\n            <span style="color:{color};font-weight:bold;">{worst.get('category', 'N/A')}</span>\n            (risk {worst.get('risk', 'N/A')})\n          </td>\n        </tr>"""
    return f"""\n    <html><body style="font-family:Arial,sans-serif;color:#222;max-width:620px;margin:auto;">\n      <h2 style="color:#c0392b;">⚠️ Water Quality Alert</h2>\n\n      <p>\n        <span style="background:{badge_color};color:#fff;padding:3px 10px;\n                     border-radius:4px;font-size:13px;font-weight:bold;">\n          {atype.replace('+', ' + ')}\n        </span>\n      </p>\n\n      <p style="background:#fdecea;padding:12px;border-left:4px solid #c0392b;margin-top:12px;">\n        {payload.get('alert_reason', 'Critical water quality event detected.')}\n      </p>\n\n      <table cellpadding="7" style="border-collapse:collapse;width:100%;">\n        <tr style="background:#f5f5f5;">\n          <td width="220"><b>Location</b></td>\n          <td>lat={lat}, lon={lon}</td>\n        </tr>\n        <tr>\n          <td><b>Timestamp</b></td>\n          <td>{payload.get('timestamp', 'N/A')}</td>\n        </tr>\n        <tr style="background:#f5f5f5;">\n          <td><b>Pollution status</b></td>\n          <td style="color:#c0392b;font-weight:bold;">{payload.get('pollution_status', 'N/A')}</td>\n        </tr>\n        <tr>\n          <td><b>NDCI (chlorophyll)</b></td>\n          <td>{payload.get('ndci', 'N/A')}</td>\n        </tr>\n        <tr style="background:#f5f5f5;">\n          <td><b>Rainfall (5-day)</b></td>\n          <td>{payload.get('rainfall_mm', 'N/A')} mm — <b>{payload.get('rainfall_impact', 'N/A')}</b></td>\n        </tr>\n        <tr>\n          <td><b>Turbidity</b></td>\n          <td>{payload.get('turbidity', 'N/A')}</td>\n        </tr>\n        <tr style="background:#f5f5f5;">\n          <td><b>Suspended sediment</b></td>\n          <td>{payload.get('suspendent_sediment', 'N/A')}</td>\n        </tr>\n        <tr>\n          <td><b>Water detected</b></td>\n          <td>{payload.get('water_detected', 'N/A')}</td>\n        </tr>\n        {eu_row}\n        {forecast_row}\n      </table>\n\n      <p style="color:#888;font-size:12px;margin-top:24px;">\n        This alert was generated automatically by the Water Quality Monitor\n        (EU Bathing Water Directive 2006/7/EC reference thresholds).\n      </p>\n    </body></html>\n    """

def send_email_alert(payload: Dict[str, Any]) -> bool:
    recipients_raw = os.getenv('ALERT_EMAIL_TO', '').strip()
    sender = os.getenv('ALERT_EMAIL_FROM', '').strip()
    smtp_host = os.getenv('ALERT_SMTP_HOST', 'smtp.gmail.com').strip()
    smtp_port = int(os.getenv('ALERT_SMTP_PORT', '587'))
    smtp_user = os.getenv('ALERT_SMTP_USER', '').strip()
    smtp_password = os.getenv('ALERT_SMTP_PASSWORD', '').strip()
    if not all([recipients_raw, sender, smtp_user, smtp_password]):
        logger.debug('Email alert skipped: SMTP credentials not fully configured.')
        return False
    recipients = [r.strip() for r in recipients_raw.split(',') if r.strip()]
    loc = payload.get('location', {})
    alert_type = payload.get('alert_type', 'ALERT')
    subject = f"[{alert_type}] Water Quality — {payload.get('pollution_status')} pollution + {payload.get('rainfall_impact')} rainfall @ lat={loc.get('lat')}, lon={loc.get('lon')}"
    msg = MIMEMultipart('alternative')
    msg['Subject'] = subject
    msg['From'] = sender
    msg['To'] = ', '.join(recipients)
    plain = f"Water Quality Alert [{alert_type}]\n\n{payload.get('alert_reason')}\n\nLocation:  lat={loc.get('lat')}, lon={loc.get('lon')}\nTimestamp: {payload.get('timestamp')}\nPollution: {payload.get('pollution_status')}  (NDCI={payload.get('ndci')})\nRainfall:  {payload.get('rainfall_mm')} mm ({payload.get('rainfall_impact')})\nEU alert:  {payload.get('eu_alert', {}).get('message', 'N/A')}\n"
    msg.attach(MIMEText(plain, 'plain'))
    msg.attach(MIMEText(_build_email_html(payload), 'html'))
    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.sendmail(sender, recipients, msg.as_string())
        logger.info(f'Email alert sent → {recipients}')
        return True
    except smtplib.SMTPAuthenticationError:
        logger.warning('Email alert failed: SMTP authentication error.')
    except smtplib.SMTPException as e:
        logger.warning(f'Email alert SMTP error: {e}')
    except Exception as e:
        logger.warning(f'Email alert unexpected error: {e}')
    return False

def dispatch_alerts(result: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    try:
        triggers = evaluate_triggers(result)
        if not triggers:
            return None
        logger.warning(f"ALERT TRIGGERED [{'+'.join(triggers)}] — pollution={result.get('pollution_status')}, rainfall={result.get('rainfall_impact')}, eu_alert={result.get('eu_alert', {}).get('triggered')}, location={result.get('location')}")
        payload = build_alert_payload(result, triggers)
        webhook_ok = send_webhook_alert(payload)
        email_ok = send_email_alert(payload)
        logger.info(f"Alert dispatch complete — webhook={('OK' if webhook_ok else 'SKIPPED/FAILED')}, email={('OK' if email_ok else 'SKIPPED/FAILED')}")
        payload.pop('eu_alert', None)
        return payload
    except Exception as e:
        logger.exception(f'dispatch_alerts unexpected error (non-fatal): {e}')
        return None