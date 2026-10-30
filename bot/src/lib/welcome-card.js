let canvasModule;

async function getCanvas() {
  if (canvasModule !== undefined) return canvasModule;
  try {
    canvasModule = await import('@napi-rs/canvas');
  } catch {
    canvasModule = null;
  }
  return canvasModule;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function star(ctx, cx, cy, radius) {
  const inner = radius * 0.34;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI / 4) * i - Math.PI / 2;
    const r = i % 2 === 0 ? radius : inner;
    const px = cx + Math.cos(angle) * r;
    const py = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/**
 * Optional premium welcome card. If @napi-rs/canvas is unavailable the
 * welcome embed still sends (without an image). Never blocks onboarding.
 */
export async function buildWelcomeCard({ username, memberCount, user }) {
  const canvas = await getCanvas();
  if (!canvas) return null;

  const { createCanvas, loadImage } = canvas;
  const W = 960;
  const H = 360;
  const cv = createCanvas(W, H);
  const ctx = cv.getContext('2d');

  // base
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0a151d');
  bg.addColorStop(0.55, '#071018');
  bg.addColorStop(1, '#04100c');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // aura
  const aura = ctx.createRadialGradient(W * 0.78, -60, 20, W * 0.78, -60, 620);
  aura.addColorStop(0, 'rgba(78,230,164,0.30)');
  aura.addColorStop(0.45, 'rgba(78,230,164,0.09)');
  aura.addColorStop(1, 'rgba(78,230,164,0)');
  ctx.fillStyle = aura;
  ctx.fillRect(0, 0, W, H);

  // grid
  ctx.strokeStyle = 'rgba(255,255,255,0.035)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 48) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += 48) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // frame
  ctx.strokeStyle = 'rgba(78,230,164,0.30)';
  ctx.lineWidth = 2;
  roundRect(ctx, 14, 14, W - 28, H - 28, 26);
  ctx.stroke();

  // corner accents
  ctx.strokeStyle = 'rgba(78,230,164,0.75)';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(14, 74); ctx.lineTo(14, 40); ctx.quadraticCurveTo(14, 14, 40, 14); ctx.lineTo(70, 14); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(W - 70, H - 14); ctx.lineTo(W - 40, H - 14); ctx.quadraticCurveTo(W - 14, H - 14, W - 14, H - 40); ctx.lineTo(W - 14, H - 70); ctx.stroke();

  // crest (drawn, matches assets/img/nova.svg)
  const crestX = 156;
  const crestY = 180;
  const crestGrad = ctx.createLinearGradient(crestX - 80, crestY - 80, crestX + 80, crestY + 80);
  crestGrad.addColorStop(0, '#7ef0c0');
  crestGrad.addColorStop(0.55, '#2fc98f');
  crestGrad.addColorStop(1, '#0d5a49');
  ctx.fillStyle = crestGrad;
  roundRect(ctx, crestX - 86, crestY - 86, 172, 172, 46);
  ctx.fill();

  ctx.save();
  ctx.shadowColor = 'rgba(78,230,164,0.8)';
  ctx.shadowBlur = 34;
  ctx.fillStyle = '#f4fff9';
  star(ctx, crestX, crestY, 62);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = '#0b3b2e';
  ctx.beginPath();
  ctx.arc(crestX, crestY, 13, 0, Math.PI * 2);
  ctx.fill();

  // avatar ring + image
  const ax = 372;
  const ay = 118;
  const ar = 52;
  ctx.beginPath();
  ctx.arc(ax, ay, ar + 5, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(78,230,164,0.55)';
  ctx.lineWidth = 3;
  ctx.stroke();

  try {
    const url = user?.displayAvatarURL
      ? user.displayAvatarURL({ extension: 'png', size: 160 })
      : 'https://cdn.discordapp.com/embed/avatars/0.png';
    const res = await fetch(url);
    if (res.ok) {
      const img = await loadImage(Buffer.from(await res.arrayBuffer()));
      ctx.save();
      ctx.beginPath();
      ctx.arc(ax, ay, ar, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, ax - ar, ay - ar, ar * 2, ar * 2);
      ctx.restore();
    }
  } catch {
    // avatar is decorative; ignore
  }

  // text
  ctx.fillStyle = '#7dffc8';
  ctx.font = '600 15px sans-serif';
  ctx.fillText('SUPERNOVA SMP  ·  SEASON III', 372, 198);

  ctx.fillStyle = '#ffffff';
  const name = String(username).slice(0, 22);
  ctx.font = name.length > 16 ? '700 40px sans-serif' : '700 48px sans-serif';
  ctx.fillText(name, 372, 248);

  ctx.fillStyle = '#9db3ab';
  ctx.font = '400 18px sans-serif';
  ctx.fillText('Welcome to the world. Run /server to get started.', 372, 282);

  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.fillRect(372, 300, 470, 1);

  ctx.fillStyle = '#6f8a82';
  ctx.font = '600 13px sans-serif';
  ctx.fillText(`MEMBER #${memberCount}`, 372, 325);
  ctx.fillStyle = '#4ee6a4';
  ctx.fillText('tarzan.supernovaa.in:25509', 520, 325);

  return cv.toBuffer('image/png');
}
