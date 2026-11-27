const DLSAU_EMAIL_RE = /^[^@\s]+@dlsau\.edu\.ph$/i;
const STUDENT_ID_RE = /^[0-9]{4}-00-[0-9]{6}$/;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);
const TEMP_PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

/** Generate a readable 12-character temporary password formatted as LL-XXXX-XXXX-XXXX. */
export function generateTempPassword(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  let out = 'LL-';
  for (let i = 0; i < bytes.length; i++) {
    if (i === 4 || i === 8) out += '-';
    out += TEMP_PASSWORD_ALPHABET[bytes[i] % TEMP_PASSWORD_ALPHABET.length];
  }
  return out;
}

export function isDlsauEmail(email: string): boolean {
  return DLSAU_EMAIL_RE.test(email.trim());
}

export function isStudentId(value: string): boolean {
  return STUDENT_ID_RE.test(value.trim());
}

/** Verify image type via magic bytes + 5 MB cap (never trust file extension alone). */
export async function validateImageFile(file: File): Promise<string | null> {
  if (!ALLOWED_MIME.has(file.type)) {
    return `${file.name}: only PNG, JPG, and WebP images are allowed.`;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `${file.name}: file exceeds the 5 MB upload limit.`;
  }

  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const isPng =
    head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
  const isJpg = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  const isWebp =
    head[0] === 0x52 &&
    head[1] === 0x49 &&
    head[2] === 0x46 &&
    head[3] === 0x46 &&
    head[8] === 0x57 &&
    head[9] === 0x45 &&
    head[10] === 0x42 &&
    head[11] === 0x50;

  if (!isPng && !isJpg && !isWebp) {
    return `${file.name}: invalid image signature.`;
  }
  return null;
}

/** Re-encode via canvas to strip EXIF/GPS metadata and cap image size for storage. */
export async function sanitizeImageToDataUrl(
  file: File,
  maxDimension = 1600,
  quality = 0.82
): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not decode image file.'));
      el.src = objectUrl;
    });
    const longest = Math.max(img.naturalWidth, img.naturalHeight, 1);
    const scale = longest > maxDimension ? maxDimension / longest : 1;
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable.');
    ctx.drawImage(img, 0, 0, width, height);
    const webp = canvas.toDataURL('image/webp', quality);
    return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
