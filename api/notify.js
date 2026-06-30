// Vercel serverless function — runs server-side only.
// The Resend API key is read from the environment and is NEVER sent to the
// browser. Visitors only ever talk to this endpoint, not to Resend directly.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY is not configured');
    return res.status(500).json({ error: 'Server not configured' });
  }

  // Body may arrive parsed (object) or as a raw string depending on runtime.
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const email = String(body.email || '').trim();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  // Required: what info/materials to furnish before the meeting (min 50 chars).
  const info = String(body.info || '').trim().slice(0, 5000);
  if (info.length < 50) {
    return res.status(400).json({ error: 'Details must be at least 50 characters' });
  }

  const TO = process.env.NOTIFY_TO || 'letscreate@ltfmedia.agency';
  // From address must belong to a domain verified in your Resend account.
  const FROM = process.env.NOTIFY_FROM || 'LTF Media <notifications@ltfmedia.agency>';

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: [TO],
        reply_to: email,
        subject: 'New consultation request from ' + email,
        html:
          '<div style="font-family:Arial,sans-serif;font-size:15px;color:#111">' +
          '<h2 style="margin:0 0 12px">New popup form submission</h2>' +
          '<p>Someone just dropped their email in the consultation popup on the LTF Media website.</p>' +
          '<p><strong>Their email:</strong> ' +
          '<a href="mailto:' + escapeHtml(email) + '">' + escapeHtml(email) + '</a></p>' +
          '<p style="margin-top:16px"><strong>Information / materials to furnish before the meeting:</strong></p>' +
          '<p style="white-space:pre-wrap;background:#f5f5f7;padding:12px 14px;border-radius:6px">' +
          escapeHtml(info) + '</p>' +
          '<p style="color:#666;font-size:13px">Received ' + new Date().toUTCString() + '</p>' +
          '<p style="color:#666;font-size:13px">Reply directly to this email to reach them.</p>' +
          '</div>',
      }),
    });

    if (!r.ok) {
      const detail = await r.text();
      console.error('Resend send failed', r.status, detail);
      return res.status(502).json({ error: 'Failed to send notification' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Notification error', err);
    return res.status(500).json({ error: 'Failed to send notification' });
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
