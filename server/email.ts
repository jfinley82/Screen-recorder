import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM ?? "notifications@screenrecorder.app";
const APP_URL = process.env.BASE_URL ?? "http://localhost:5173";

export async function sendViewNotification({
  coachEmail,
  coachName,
  recordingTitle,
  shareToken,
  watchSeconds,
  percentWatched,
}: {
  coachEmail: string;
  coachName: string;
  recordingTitle: string;
  shareToken: string;
  watchSeconds: number;
  percentWatched: number;
}) {
  const viewerUrl = `${APP_URL}/v/${shareToken}`;
  const mins = Math.floor(watchSeconds / 60);
  const secs = watchSeconds % 60;
  const watchTime = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  await resend.emails.send({
    from: FROM,
    to: coachEmail,
    subject: `👀 Someone watched "${recordingTitle}"`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#ffffff">
        <div style="margin-bottom:24px">
          <span style="font-size:22px">🎥</span>
          <span style="font-weight:700;font-size:18px;margin-left:8px">Screen Recorder</span>
        </div>

        <h1 style="font-size:20px;font-weight:700;margin:0 0 8px">Someone just watched your video</h1>
        <p style="color:#666;margin:0 0 24px">Hi ${coachName}, here's a quick update on your recording.</p>

        <div style="background:#f5f5f5;border-radius:12px;padding:20px;margin-bottom:24px">
          <p style="margin:0 0 4px;font-weight:600;font-size:16px">${recordingTitle}</p>
          <p style="margin:0;color:#666;font-size:14px">Watched ${watchTime} &nbsp;·&nbsp; ${percentWatched}% completed</p>
        </div>

        <a href="${viewerUrl}" style="display:inline-block;background:#e53e3e;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px">
          View Recording →
        </a>

        <p style="color:#999;font-size:12px;margin-top:32px">
          You're receiving this because someone viewed a video you shared.
          <a href="${APP_URL}/settings" style="color:#999">Manage notifications</a>
        </p>
      </div>
    `,
  });
}

export async function sendCommentNotification({
  coachEmail,
  coachName,
  recordingTitle,
  shareToken,
  commenterName,
  message,
}: {
  coachEmail: string;
  coachName: string;
  recordingTitle: string;
  shareToken: string;
  commenterName: string;
  message: string;
}) {
  const viewerUrl = `${APP_URL}/v/${shareToken}`;

  await resend.emails.send({
    from: FROM,
    to: coachEmail,
    subject: `💬 New comment on "${recordingTitle}"`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#ffffff">
        <div style="margin-bottom:24px">
          <span style="font-size:22px">🎥</span>
          <span style="font-weight:700;font-size:18px;margin-left:8px">Screen Recorder</span>
        </div>

        <h1 style="font-size:20px;font-weight:700;margin:0 0 8px">${commenterName} left a comment</h1>
        <p style="color:#666;margin:0 0 24px">Hi ${coachName}, someone commented on your recording.</p>

        <div style="background:#f5f5f5;border-radius:12px;padding:20px;margin-bottom:8px">
          <p style="margin:0 0 4px;font-weight:600;font-size:14px">${recordingTitle}</p>
        </div>
        <div style="background:#fff;border:1px solid #e5e5e5;border-radius:12px;padding:16px;margin-bottom:24px">
          <p style="margin:0 0 4px;font-weight:600;font-size:13px">${commenterName}</p>
          <p style="margin:0;font-size:14px;color:#333">${message}</p>
        </div>

        <a href="${viewerUrl}" style="display:inline-block;background:#e53e3e;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px">
          View &amp; Reply →
        </a>

        <p style="color:#999;font-size:12px;margin-top:32px">
          <a href="${APP_URL}/settings" style="color:#999">Manage notifications</a>
        </p>
      </div>
    `,
  });
}
