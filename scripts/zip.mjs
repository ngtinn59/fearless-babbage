import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

// Pre-computed CRC-32 table
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[i] = c;
}

function calculateCrc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buffer[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createZipArchive(sourceDir, outputFilePath) {
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Thư mục nguồn "${sourceDir}" không tồn tại. Vui lòng chạy "npm run build" trước.`);
  }

  const files = [];
  function scan(dir, relativePath) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        scan(fullPath, relPath);
      } else if (entry.isFile()) {
        files.push({ fullPath, relPath: relPath.replace(/\\/g, '/') });
      }
    }
  }

  scan(sourceDir, '');

  const localHeaders = [];
  const centralDirectoryHeaders = [];
  let currentOffset = 0;

  for (const file of files) {
    const content = fs.readFileSync(file.fullPath);
    const compressed = zlib.deflateRawSync(content);
    const crc = calculateCrc32(content);
    const fileNameBuffer = Buffer.from(file.relPath, 'utf8');

    // Local file header (30 bytes)
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // Signature
    localHeader.writeUInt16LE(20, 4); // Min version required (2.0)
    localHeader.writeUInt16LE(0, 6); // General purpose flag
    localHeader.writeUInt16LE(8, 8); // Compression method: Deflate (8)
    localHeader.writeUInt16LE(0, 10); // File modification time
    localHeader.writeUInt16LE(0, 12); // File modification date
    localHeader.writeUInt32LE(crc, 14); // CRC-32
    localHeader.writeUInt32LE(compressed.length, 18); // Compressed size
    localHeader.writeUInt32LE(content.length, 22); // Uncompressed size
    localHeader.writeUInt16LE(fileNameBuffer.length, 26); // File name length
    localHeader.writeUInt16LE(0, 28); // Extra field length

    localHeaders.push(localHeader, fileNameBuffer, compressed);

    // Central directory file header (46 bytes)
    const cdHeader = Buffer.alloc(46);
    cdHeader.writeUInt32LE(0x02014b50, 0); // Signature
    cdHeader.writeUInt16LE(20, 4); // Version made by
    cdHeader.writeUInt16LE(20, 6); // Version needed to extract
    cdHeader.writeUInt16LE(0, 8); // General purpose flag
    cdHeader.writeUInt16LE(8, 10); // Compression method
    cdHeader.writeUInt16LE(0, 12); // File modification time
    cdHeader.writeUInt16LE(0, 14); // File modification date
    cdHeader.writeUInt32LE(crc, 16); // CRC-32
    cdHeader.writeUInt32LE(compressed.length, 20); // Compressed size
    cdHeader.writeUInt32LE(content.length, 24); // Uncompressed size
    cdHeader.writeUInt16LE(fileNameBuffer.length, 28); // File name length
    cdHeader.writeUInt16LE(0, 30); // Extra field length
    cdHeader.writeUInt16LE(0, 32); // File comment length
    cdHeader.writeUInt16LE(0, 34); // Disk number start
    cdHeader.writeUInt16LE(0, 36); // Internal file attributes
    cdHeader.writeUInt32LE(0, 38); // External file attributes
    cdHeader.writeUInt32LE(currentOffset, 42); // Relative offset of local header

    centralDirectoryHeaders.push(cdHeader, fileNameBuffer);

    currentOffset += localHeader.length + fileNameBuffer.length + compressed.length;
  }

  const centralDirectoryOffset = currentOffset;
  let centralDirectorySize = 0;
  for (const part of centralDirectoryHeaders) {
    centralDirectorySize += part.length;
  }

  // End of central directory record (22 bytes)
  const eocdRecord = Buffer.alloc(22);
  eocdRecord.writeUInt32LE(0x06054b50, 0); // Signature
  eocdRecord.writeUInt16LE(0, 4); // Number of this disk
  eocdRecord.writeUInt16LE(0, 6); // Disk where central directory starts
  eocdRecord.writeUInt16LE(files.length, 8); // Number of central directory records on this disk
  eocdRecord.writeUInt16LE(files.length, 10); // Total number of central directory records
  eocdRecord.writeUInt32LE(centralDirectorySize, 12); // Size of central directory
  eocdRecord.writeUInt32LE(centralDirectoryOffset, 16); // Offset of start of central directory
  eocdRecord.writeUInt16LE(0, 20); // Comment length

  const finalZipBuffer = Buffer.concat([
    ...localHeaders,
    ...centralDirectoryHeaders,
    eocdRecord,
  ]);

  fs.mkdirSync(path.dirname(outputFilePath), { recursive: true });
  fs.writeFileSync(outputFilePath, finalZipBuffer);

  return {
    fileCount: files.length,
    size: finalZipBuffer.length,
  };
}

try {
  const pkgPath = path.resolve(process.cwd(), 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const version = pkg.version || '1.0.0';

  const distDir = path.resolve(process.cwd(), 'dist');
  const outputFile = path.resolve(process.cwd(), `release/smart-proxy-${version}.zip`);

  console.log(`Đang đóng gói dist/ thành ${outputFile}...`);
  const result = createZipArchive(distDir, outputFile);
  console.log(`Đóng gói thành công! Đã nén ${result.fileCount} file (${(result.size / 1024).toFixed(1)} KB).`);
} catch (err) {
  console.error('Lỗi khi đóng gói file zip:', err);
  process.exit(1);
}
