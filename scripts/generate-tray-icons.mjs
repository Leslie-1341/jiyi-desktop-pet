import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const outputDir = path.resolve('src/main/assets');
const icons = [
  { fileName: 'petTrayTemplate.png', size: 18 },
  { fileName: 'petTrayTemplate@2x.png', size: 36 }
];
const LOGO_SCALE = 1.2;

function crc32(bytes) {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc ^= byte;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  const crc = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 0);
  return Buffer.concat([length, typeBytes, data, crc]);
}

function containsEllipse(x, y, cx, cy, rx, ry) {
  const dx = (x - cx) / rx;
  const dy = (y - cy) / ry;
  return dx * dx + dy * dy <= 1;
}

function containsRoundedRect(x, y, left, top, right, bottom, radius) {
  const innerLeft = left + radius;
  const innerRight = right - radius;
  const innerTop = top + radius;
  const innerBottom = bottom - radius;

  if (x >= innerLeft && x <= innerRight && y >= top && y <= bottom) {
    return true;
  }

  if (x >= left && x <= right && y >= innerTop && y <= innerBottom) {
    return true;
  }

  const cx = x < innerLeft ? innerLeft : innerRight;
  const cy = y < innerTop ? innerTop : innerBottom;
  return (x - cx) * (x - cx) + (y - cy) * (y - cy) <= radius * radius;
}

function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return Math.hypot(px - ax, py - ay);
  }

  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
  const closestX = ax + t * dx;
  const closestY = ay + t * dy;
  return Math.hypot(px - closestX, py - closestY);
}

function sampleCubic(p0, p1, p2, p3, steps = 18) {
  const points = [];

  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    const mt = 1 - t;
    points.push({
      x:
        mt * mt * mt * p0.x +
        3 * mt * mt * t * p1.x +
        3 * mt * t * t * p2.x +
        t * t * t * p3.x,
      y:
        mt * mt * mt * p0.y +
        3 * mt * mt * t * p1.y +
        3 * mt * t * t * p2.y +
        t * t * t * p3.y
    });
  }

  return points;
}

function distanceToPolyline(x, y, points) {
  let minDistance = Infinity;

  for (let index = 1; index < points.length; index += 1) {
    minDistance = Math.min(
      minDistance,
      distanceToSegment(
        x,
        y,
        points[index - 1].x,
        points[index - 1].y,
        points[index].x,
        points[index].y
      )
    );
  }

  return minDistance;
}

function containsOuterLogo(x, y) {
  const body = containsEllipse(x, y, 8.6, 8.95, 6.4, 5.65);
  const cheek = containsEllipse(x, y, 12.4, 8.7, 2.85, 3.7);
  return body || cheek;
}

function containsTailDot(x, y) {
  const rotatedX = (x - 15.15) * 0.92 + (y - 12.25) * 0.38;
  const rotatedY = -(x - 15.15) * 0.38 + (y - 12.25) * 0.92;
  return containsRoundedRect(rotatedX, rotatedY, -0.86, -0.62, 0.86, 0.62, 0.25);
}

const catLine = [
  { x: 5.55, y: 10.45 },
  { x: 5.55, y: 7.28 },
  { x: 5.95, y: 6.92 },
  { x: 7.12, y: 8.83 },
  ...sampleCubic(
    { x: 7.12, y: 8.83 },
    { x: 7.8, y: 9.35 },
    { x: 9.05, y: 9.22 },
    { x: 10.16, y: 8.86 },
    12
  ).slice(1),
  ...sampleCubic(
    { x: 10.16, y: 8.86 },
    { x: 10.62, y: 8.65 },
    { x: 10.72, y: 8.1 },
    { x: 10.78, y: 7.55 },
    8
  ).slice(1),
  { x: 11.05, y: 5.33 },
  { x: 11.5, y: 5.0 },
  { x: 13.55, y: 7.3 },
  ...sampleCubic(
    { x: 13.55, y: 7.3 },
    { x: 15.08, y: 8.9 },
    { x: 15.22, y: 10.52 },
    { x: 14.25, y: 11.62 },
    14
  ).slice(1)
];

const faceLines = [
  sampleCubic(
    { x: 6.95, y: 12.08 },
    { x: 7.5, y: 12.62 },
    { x: 8.28, y: 12.56 },
    { x: 8.75, y: 12.02 },
    8
  ),
  sampleCubic(
    { x: 11.08, y: 11.4 },
    { x: 11.62, y: 11.96 },
    { x: 12.43, y: 11.78 },
    { x: 12.82, y: 11.08 },
    8
  )
];

function cutoutCoverage(x, y) {
  const lineDistance = distanceToPolyline(x, y, catLine);
  const faceDistance = Math.min(...faceLines.map((line) => distanceToPolyline(x, y, line)));
  const stroke = Math.min(lineDistance - 0.42, faceDistance - 0.36);
  return Math.max(0, Math.min(1, 0.5 - stroke));
}

function petLogoCoverage(x, y) {
  const blackShape = containsOuterLogo(x, y) || containsTailDot(x, y);

  if (!blackShape) {
    return 0;
  }

  return Math.max(0, 1 - cutoutCoverage(x, y));
}

function renderIcon(size) {
  const scale = size / 18;
  const supersample = 4;
  const pixels = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let coveredSamples = 0;

      for (let sy = 0; sy < supersample; sy += 1) {
        for (let sx = 0; sx < supersample; sx += 1) {
          const sampleX = (x + (sx + 0.5) / supersample) / scale;
          const sampleY = (y + (sy + 0.5) / supersample) / scale;
          const logoX = 9 + (sampleX - 9) / LOGO_SCALE;
          const logoY = 9 + (sampleY - 9) / LOGO_SCALE;

          coveredSamples += petLogoCoverage(logoX, logoY);
        }
      }

      const offset = (y * size + x) * 4;
      pixels[offset] = 0;
      pixels[offset + 1] = 0;
      pixels[offset + 2] = 0;
      pixels[offset + 3] = Math.round((coveredSamples / (supersample * supersample)) * 255);
    }
  }

  return pixels;
}

function encodePng(width, height, pixels) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const scanlines = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (1 + width * 4);
    scanlines[rowStart] = 0;
    pixels.copy(scanlines, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }

  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(scanlines)),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

fs.mkdirSync(outputDir, { recursive: true });

for (const icon of icons) {
  const pixels = renderIcon(icon.size);
  const png = encodePng(icon.size, icon.size, pixels);
  fs.writeFileSync(path.join(outputDir, icon.fileName), png);
  console.log(`${icon.fileName}: ${icon.size}x${icon.size}`);
}
