const nodemailer = require('nodemailer')

/* ── Transporter ─────────────────────────────────────────────────────────── */
function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD, // Gmail App Password (not account password)
    },
  })
}

/* ── Send password-reset email ───────────────────────────────────────────── */
async function sendPasswordResetEmail({ to, name, resetUrl }) {
  const transporter = createTransporter()

  await transporter.sendMail({
    from: `"EarthChecker Platform" <${process.env.GMAIL_USER}>`,
    to,
    subject: 'Password Reset Request — EarthChecker',
    text: buildResetText({ name, resetUrl }),
    html: buildResetHtml({ name, resetUrl }),
  })
}

/* ── Plain-text fallback ─────────────────────────────────────────────────── */
function buildResetText({ name, resetUrl }) {
  return `Hi ${name},

You requested a password reset for your EarthChecker account.

Click the link below to set a new password (expires in 15 minutes):
${resetUrl}

If you did not request this, please ignore this email — your password will not change.

— EarthChecker Platform`
}

/* ── HTML email ──────────────────────────────────────────────────────────── */
function buildResetHtml({ name, resetUrl }) {
  return /* html */ `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Password Reset — EarthChecker</title>
</head>
<body style="margin:0;padding:0;background-color:#06080e;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#06080e;padding:48px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

          <!-- ── Brand header ── -->
          <tr>
            <td style="padding-bottom:28px;text-align:center;">
              <p style="margin:0;font-family:'Courier New',monospace;font-size:11px;font-weight:700;
                         letter-spacing:0.22em;text-transform:uppercase;color:#3d4f63;">
                EARTHCHECKER PLATFORM
              </p>
              <div style="margin-top:10px;height:1px;
                          background:linear-gradient(90deg,transparent,rgba(0,212,255,0.45),transparent);">
              </div>
            </td>
          </tr>

          <!-- ── Card ── -->
          <tr>
            <td style="background:rgba(8,12,20,0.97);
                        border:1px solid rgba(0,212,255,0.14);
                        border-radius:12px;
                        padding:40px 36px;
                        box-shadow:0 24px 64px rgba(0,0,0,0.6);">

              <!-- Accent bar -->
              <div style="width:36px;height:3px;border-radius:2px;margin-bottom:30px;
                          background:linear-gradient(90deg,#00d4ff,rgba(0,212,255,0.25));">
              </div>

              <!-- Title -->
              <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;
                          color:#eef2f7;letter-spacing:-0.01em;">
                Password Reset
              </h1>

              <!-- Body -->
              <p style="margin:0 0 30px;font-size:14px;color:#8fa3b8;line-height:1.7;">
                Hi <strong style="color:#eef2f7;">${name}</strong>,<br />
                We received a request to reset the password for your EarthChecker account.
                Click the button below to choose a new password.
              </p>

              <!-- CTA -->
              <div style="text-align:center;margin:36px 0;">
                <a href="${resetUrl}"
                   style="display:inline-block;
                          padding:14px 40px;
                          background:linear-gradient(135deg,rgba(0,212,255,0.9),rgba(0,140,200,0.9));
                          color:#060810;
                          font-weight:800;
                          font-size:12px;
                          text-decoration:none;
                          border-radius:8px;
                          letter-spacing:0.1em;
                          text-transform:uppercase;">
                  Reset My Password
                </a>
              </div>

              <!-- Expiry notice -->
              <p style="margin:28px 0 0;font-size:12px;color:#3d4f63;
                          text-align:center;line-height:1.7;">
                This link is valid for
                <strong style="color:#8fa3b8;">15 minutes</strong> and can only be used once.<br />
                If you didn't request a reset, you can safely ignore this email.
              </p>

              <!-- Divider -->
              <div style="margin:28px 0;height:1px;background:rgba(143,163,184,0.08);"></div>

              <!-- URL fallback -->
              <p style="margin:0;font-size:11px;color:#3d4f63;line-height:1.8;">
                Having trouble with the button? Copy and paste this URL into your browser:<br />
                <span style="color:#526070;word-break:break-all;">${resetUrl}</span>
              </p>
            </td>
          </tr>

          <!-- ── Footer ── -->
          <tr>
            <td style="padding-top:28px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#3d4f63;line-height:1.9;">
                EarthChecker · Quality Inspection Platform<br />
                This is an automated message — please do not reply to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim()
}

/* ── Send email-verification email ──────────────────────────────────────── */
async function sendVerificationEmail({ to, name, verifyUrl }) {
  const transporter = createTransporter()

  await transporter.sendMail({
    from: `"EarthChecker Platform" <${process.env.GMAIL_USER}>`,
    to,
    subject: 'Verify Your Email — EarthChecker',
    text: buildVerifyText({ name, verifyUrl }),
    html: buildVerifyHtml({ name, verifyUrl }),
  })
}

/* ── Plain-text fallback ─────────────────────────────────────────────────── */
function buildVerifyText({ name, verifyUrl }) {
  return `Hi ${name},

Welcome to EarthChecker! Please verify your email address to activate your account.

Click the link below to verify (expires in 24 hours):
${verifyUrl}

If you did not create an account, you can safely ignore this email.

— EarthChecker Platform`
}

/* ── HTML email ──────────────────────────────────────────────────────────── */
function buildVerifyHtml({ name, verifyUrl }) {
  return /* html */ `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Verify Your Email — EarthChecker</title>
</head>
<body style="margin:0;padding:0;background-color:#06080e;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#06080e;padding:48px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

          <!-- ── Brand header ── -->
          <tr>
            <td style="padding-bottom:28px;text-align:center;">
              <p style="margin:0;font-family:'Courier New',monospace;font-size:11px;font-weight:700;
                         letter-spacing:0.22em;text-transform:uppercase;color:#3d4f63;">
                EARTHCHECKER PLATFORM
              </p>
              <div style="margin-top:10px;height:1px;
                          background:linear-gradient(90deg,transparent,rgba(0,212,255,0.45),transparent);">
              </div>
            </td>
          </tr>

          <!-- ── Card ── -->
          <tr>
            <td style="background:rgba(8,12,20,0.97);
                        border:1px solid rgba(0,212,255,0.14);
                        border-radius:12px;
                        padding:40px 36px;
                        box-shadow:0 24px 64px rgba(0,0,0,0.6);">

              <!-- Accent bar -->
              <div style="width:36px;height:3px;border-radius:2px;margin-bottom:30px;
                          background:linear-gradient(90deg,#00d4ff,rgba(0,212,255,0.25));">
              </div>

              <!-- Title -->
              <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;
                          color:#eef2f7;letter-spacing:-0.01em;">
                Verify Your Email
              </h1>

              <!-- Body -->
              <p style="margin:0 0 30px;font-size:14px;color:#8fa3b8;line-height:1.7;">
                Hi <strong style="color:#eef2f7;">${name}</strong>,<br />
                Welcome to EarthChecker! Click the button below to verify your email address
                and activate your account.
              </p>

              <!-- CTA -->
              <div style="text-align:center;margin:36px 0;">
                <a href="${verifyUrl}"
                   style="display:inline-block;
                          padding:14px 40px;
                          background:linear-gradient(135deg,rgba(0,212,255,0.9),rgba(0,140,200,0.9));
                          color:#060810;
                          font-weight:800;
                          font-size:12px;
                          text-decoration:none;
                          border-radius:8px;
                          letter-spacing:0.1em;
                          text-transform:uppercase;">
                  Verify My Email
                </a>
              </div>

              <!-- Expiry notice -->
              <p style="margin:28px 0 0;font-size:12px;color:#3d4f63;
                          text-align:center;line-height:1.7;">
                This link is valid for
                <strong style="color:#8fa3b8;">24 hours</strong> and can only be used once.<br />
                If you didn't create an account, you can safely ignore this email.
              </p>

              <!-- Divider -->
              <div style="margin:28px 0;height:1px;background:rgba(143,163,184,0.08);"></div>

              <!-- URL fallback -->
              <p style="margin:0;font-size:11px;color:#3d4f63;line-height:1.8;">
                Having trouble with the button? Copy and paste this URL into your browser:<br />
                <span style="color:#526070;word-break:break-all;">${verifyUrl}</span>
              </p>
            </td>
          </tr>

          <!-- ── Footer ── -->
          <tr>
            <td style="padding-top:28px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#3d4f63;line-height:1.9;">
                EarthChecker · Quality Inspection Platform<br />
                This is an automated message — please do not reply to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim()
}

module.exports = { sendPasswordResetEmail, sendVerificationEmail }
