const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const width = 1024;
const height = 1024;

// White Background & Dark Slate Grey Logo matching the user image
const bg_r = 255, bg_g = 255, bg_b = 255, bg_a = 255;      // White Background
const slate_r = 51, slate_g = 65, slate_b = 85, slate_a = 255; // Dark Slate Grey (#334155)

const raw_data = Buffer.alloc(height * (width * 4 + 1));
let offset = 0;

for (let y = 0; y < height; y++) {
  raw_data[offset++] = 0; // Filter type 0

  for (let x = 0; x < width; x++) {
    let r = bg_r, g = bg_g, b = bg_b, a = bg_a;

    // 1. Top Column Abacus (Flat top bar: y 230-260, x 400-624)
    if (y >= 230 && y <= 260 && x >= 400 && x <= 624) {
      r = slate_r; g = slate_g; b = slate_b;
    }

    // 2. Main Horizontal Scroll Bar with Rings at ends
    // Scroll Bar: y 300-335, x 260-764
    if (y >= 305 && y <= 340 && x >= 270 && x <= 754) {
      r = slate_r; g = slate_g; b = slate_b;
    }
    // Left Scroll Ring (Center 300, 322, radius 35, hole radius 18)
    const distLeftRing = (x - 300) ** 2 + (y - 322) ** 2;
    if (distLeftRing <= 38 ** 2 && distLeftRing >= 18 ** 2) {
      r = slate_r; g = slate_g; b = slate_b;
    }
    // Right Scroll Ring (Center 724, 322, radius 35, hole radius 18)
    const distRightRing = (x - 724) ** 2 + (y - 322) ** 2;
    if (distRightRing <= 38 ** 2 && distRightRing >= 18 ** 2) {
      r = slate_r; g = slate_g; b = slate_b;
    }

    // 3. Central Pillar Flutes (3 vertical columns under capital)
    // Capital Top: y 345-385, x 390-634
    if (y >= 345 && y <= 385 && x >= 390 && x <= 634) {
      r = slate_r; g = slate_g; b = slate_b;
    }

    // Left Column Flute (x 410-450, y 385-680)
    if (x >= 410 && x <= 450 && y >= 385 && y <= 680) {
      r = slate_r; g = slate_g; b = slate_b;
    }
    // Center Column Flute (x 492-532, y 385-710)
    if (x >= 492 && x <= 532 && y >= 385 && y <= 710) {
      r = slate_r; g = slate_g; b = slate_b;
    }
    // Right Column Flute (x 574-614, y 385-680)
    if (x >= 574 && x <= 614 && y >= 385 && y <= 680) {
      r = slate_r; g = slate_g; b = slate_b;
    }

    // 4. Left Scale Assembly
    // Strings (diagonal lines from 300,340 down to 180,530 & 320,530)
    if (y >= 340 && y <= 530) {
      if (Math.abs((x - 300) - (y - 340) * -0.63) < 9 || Math.abs((x - 300) - (y - 340) * 0.1) < 9) {
        r = slate_r; g = slate_g; b = slate_b;
      }
    }
    // Left Scale Pan (Half Circle Dish: y 530-590, x 170-330)
    if (y >= 530 && y <= 590 && (x - 250) ** 2 + (y - 530) ** 2 <= 80 ** 2) {
      r = slate_r; g = slate_g; b = slate_b;
    }

    // 5. Right Scale Assembly
    // Strings (diagonal lines from 724,340 down to 654,530 & 794,530)
    if (y >= 340 && y <= 530) {
      if (Math.abs((x - 724) - (y - 340) * -0.37) < 9 || Math.abs((x - 724) - (y - 340) * 0.37) < 9) {
        r = slate_r; g = slate_g; b = slate_b;
      }
    }
    // Right Scale Pan (Half Circle Dish: y 530-590, x 644-804)
    if (y >= 530 && y <= 590 && (x - 724) ** 2 + (y - 530) ** 2 <= 80 ** 2) {
      r = slate_r; g = slate_g; b = slate_b;
    }

    raw_data[offset++] = r;
    raw_data[offset++] = g;
    raw_data[offset++] = b;
    raw_data[offset++] = a;
  }
}

// Compress with zlib
const compressed = zlib.deflateSync(raw_data);

// Construct PNG Chunks
const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function createChunk(type, data) {
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type);
  const typeAndData = Buffer.concat([typeBuf, data]);
  
  let crc = 0xffffffff;
  for (let i = 0; i < typeAndData.length; i++) {
    crc ^= typeAndData[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  crc = (crc ^ 0xffffffff) >>> 0;

  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc, 0);

  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

const ihdrData = Buffer.alloc(13);
ihdrData.writeUInt32BE(width, 0);
ihdrData.writeUInt32BE(height, 4);
ihdrData[8] = 8;
ihdrData[9] = 6;
ihdrData[10] = 0;
ihdrData[11] = 0;
ihdrData[12] = 0;

const ihdrChunk = createChunk('IHDR', ihdrData);
const idatChunk = createChunk('IDAT', compressed);
const iendChunk = createChunk('IEND', Buffer.alloc(0));

const finalPng = Buffer.concat([pngHeader, ihdrChunk, idatChunk, iendChunk]);

const assetsDir = path.join(__dirname, 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

fs.writeFileSync(path.join(assetsDir, 'icon.png'), finalPng);
console.log('✅ Updated icon.png with Slate Grey Pillar & Scales logo!');
