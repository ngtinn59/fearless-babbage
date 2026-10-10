import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';

const SIZES = [16, 32, 48, 128];
const ICONS_DIR = resolve(import.meta.dirname, '../public/icons');
const SVG_PATH = resolve(ICONS_DIR, 'icon.svg');

async function main() {
  const svgBuffer = await readFile(SVG_PATH);

  for (const size of SIZES) {
    const destPath = resolve(ICONS_DIR, `icon${size}.png`);
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(destPath);
    console.log(`Generated: icon${size}.png (${size}x${size})`);
  }

  console.log('All icons generated successfully!');
}

main().catch((err) => {
  console.error('Failed to generate icons:', err);
  process.exit(1);
});
