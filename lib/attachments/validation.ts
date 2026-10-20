import { fileTypeFromBuffer } from "file-type";
import { ATTACHMENT_CONFIG, attachmentType } from "@/constants/attachments";

// Read ZIP filenames from its central directory; never decompress user files.
export function zipEntryNames(directory: Buffer): string[] {
  const names: string[] = [];
  let offset = 0;
  while (offset < directory.length) {
    if (
      offset + 46 > directory.length ||
      directory.readUInt32LE(offset) !== 0x02014b50
    )
      throw new Error("Invalid ZIP directory.");
    const flags = directory.readUInt16LE(offset + 8);
    const nameBytes = directory.readUInt16LE(offset + 28);
    const entryBytes =
      46 +
      nameBytes +
      directory.readUInt16LE(offset + 30) +
      directory.readUInt16LE(offset + 32);
    if (offset + entryBytes > directory.length || flags & 1)
      throw new Error("Encrypted or malformed archives are not supported.");
    const name = directory
      .subarray(offset + 46, offset + 46 + nameBytes)
      .toString("utf8");
    if (
      name.includes("..") ||
      name.startsWith("/") ||
      name.includes("\\") ||
      /vbaproject\.bin$/i.test(name)
    )
      throw new Error("Unsafe archive contents.");
    names.push(name);
    if (names.length > ATTACHMENT_CONFIG.maxZipEntries)
      throw new Error("Too many archive entries.");
    offset += entryBytes;
  }
  return names;
}

export async function validateFileContent(
  file: { objectKey: string; name: string; size: number },
  read: (key: string, start: number, end: number) => Promise<Buffer>,
) {
  const type = attachmentType(file.name);
  if (!type) throw new Error("Unsupported file type.");
  const header = await read(
    file.objectKey,
    0,
    Math.min(file.size, ATTACHMENT_CONFIG.signatureBytes) - 1,
  );
  if (["txt", "csv"].includes(type.extension)) {
    // stream:true tolerates a UTF-8 character split at the end of our sample.
    const text = new TextDecoder("utf-8", { fatal: true }).decode(header, {
      stream: file.size > header.length,
    });
    if (
      header.includes(0) ||
      /^\s*(?:<!doctype\s+html|<html|<svg|<script)/i.test(text)
    )
      throw new Error("The file is not plain text.");
    return;
  }
  if (["zip", "docx", "xlsx", "pptx"].includes(type.extension)) {
    if (
      header.readUInt32LE(0) !== 0x04034b50 &&
      header.readUInt32LE(0) !== 0x06054b50
    )
      throw new Error("Invalid ZIP container.");
    const tailStart = Math.max(0, file.size - 65_557);
    const tail = await read(file.objectKey, tailStart, file.size - 1);
    let end = tail.length - 22;
    while (end >= 0) {
      if (
        tail.readUInt32LE(end) === 0x06054b50 &&
        end + 22 + tail.readUInt16LE(end + 20) === tail.length
      )
        break;
      end--;
    }
    if (
      end < 0 ||
      tail.readUInt16LE(end + 4) !== 0 ||
      tail.readUInt16LE(end + 6) !== 0
    )
      throw new Error("Invalid or multi-volume ZIP.");
    const length = tail.readUInt32LE(end + 12);
    const start = tail.readUInt32LE(end + 16);
    if (
      length > ATTACHMENT_CONFIG.maxZipDirectoryBytes ||
      start + length !== tailStart + end
    )
      throw new Error("Archive directory is too large or unsupported.");
    const directory = length
      ? await read(file.objectKey, start, start + length - 1)
      : Buffer.alloc(0);
    const names = zipEntryNames(directory);
    if (names.length !== tail.readUInt16LE(end + 10))
      throw new Error("Invalid ZIP entry count.");
    if (type.extension !== "zip") {
      const folder = { docx: "word/", xlsx: "xl/", pptx: "ppt/" }[
        type.extension as "docx" | "xlsx" | "pptx"
      ];
      if (
        !names.includes("[Content_Types].xml") ||
        !names.some((name) => name.startsWith(folder))
      )
        throw new Error("The Office document does not match its extension.");
    }
    return;
  }
  if (["doc", "xls", "ppt"].includes(type.extension)) {
    if (!header.subarray(0, 8).equals(Buffer.from("d0cf11e0a1b11ae1", "hex")))
      throw new Error("Invalid Office document.");
    const shift = header.readUInt16LE(30);
    if (shift !== 9 && shift !== 12)
      throw new Error("Invalid Office sector size.");
    const sectorSize = 2 ** shift;
    const start = (header.readUInt32LE(48) + 1) * sectorSize;
    if (start + sectorSize > file.size)
      throw new Error("Invalid Office directory.");
    const directory = await read(file.objectKey, start, start + sectorSize - 1);
    const names: string[] = [];
    for (let offset = 0; offset + 128 <= directory.length; offset += 128) {
      const length = directory.readUInt16LE(offset + 64);
      if (length >= 2 && length <= 64)
        names.push(
          directory.subarray(offset, offset + length - 2).toString("utf16le"),
        );
    }
    const expected = {
      doc: ["WordDocument"],
      xls: ["Workbook", "Book"],
      ppt: ["PowerPoint Document"],
    }[type.extension as "doc" | "xls" | "ppt"];
    if (!names.some((name) => expected.includes(name)))
      throw new Error(
        "Office content does not match its extension or is unsupported.",
      );
    return;
  }
  const detected = await fileTypeFromBuffer(header);
  if (!detected || detected.mime !== type.mime)
    throw new Error("File content does not match its extension.");
}
