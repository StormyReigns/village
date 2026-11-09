// Makes the phone-app icons (src/app/manifest.ts) from Matt's logo, public/village/logo.png.
// The logo is 320px wide, so it's never scaled up: the 512 icons give it a white margin instead,
// which also keeps it inside the "maskable" safe circle Android crops to. Rerun if the logo changes:
//   node scripts/build-icons.mjs
import sharp from 'sharp';

const LOGO = 'public/village/logo.png';
const white = { r: 255, g: 255, b: 255, alpha: 1 };

async function icon(size, logoWidth, out) {
  const logo = await sharp(LOGO).resize({ width: logoWidth }).toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: white } })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(out);
  console.log('made', out);
}

await icon(192, 168, 'public/icons/icon-192.png');
await icon(512, 320, 'public/icons/icon-512.png');
await icon(512, 300, 'public/icons/icon-maskable-512.png');
