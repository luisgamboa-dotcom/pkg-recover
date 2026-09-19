/**
 * Validación y sanitización centralizada (defensa anti-ataques en formularios).
 *
 * - Todo texto que entra se limpia: recorta, colapsa espacios y elimina
 *   caracteres de control, incluido el byte NUL que PostgreSQL rechaza y que
 *   hoy rompería los inserts con error 500.
 * - React ya escapa al renderizar (sin dangerouslySetInnerHTML), esto evita
 *   además bloat/DoS y datos corruptos en BD.
 * - Supabase parametriza las consultas (sin inyección SQL); las claves solo
 *   viven en Supabase Auth.
 */

/** Longitudes máximas por campo (espejo de los CHECKs de la migración 1). */
export const LIMITS = {
  name: 100,
  email: 254,
  phone: 30,
  password: 128,
  label: 60,
  city: 100,
  address: 300,
  street: 150,
  streetNumber: 20,
  apartment: 60,
  commune: 100,
  region: 60,
  postal: 10,
  notes: 500,
  title: 200,
  comment: 2000,
  subject: 200,
  message: 5000,
  search: 100,
  sku: 20,
} as const;

/** Regiones de Chile (selectores de dirección). */
export const REGIONS = [
  'Arica y Parinacota',
  'Tarapacá',
  'Antofagasta',
  'Atacama',
  'Coquimbo',
  'Valparaíso',
  'Metropolitana de Santiago',
  "O'Higgins",
  'Maule',
  'Ñuble',
  'Biobío',
  'La Araucanía',
  'Los Ríos',
  'Los Lagos',
  'Aysén',
  'Magallanes',
] as const;

// Controles C0 (excepto tab, salto de línea y retorno) + DEL. Se generan por
// código para no incrustar bytes literales en el fuente.
function controlChars(): string {
  let out = '';
  for (let code = 0; code < 32; code++) {
    if (code !== 9 && code !== 10 && code !== 13) {
      out += String.fromCharCode(code);
    }
  }
  return out + String.fromCharCode(127);
}
const CONTROL_RE = new RegExp(`[${controlChars()}]`, 'g');

export function sanitizeText(value: string, max: number): string {
  return value
    .replace(CONTROL_RE, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export function sanitizeMultiline(value: string, max: number): string {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(CONTROL_RE, '')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

export function normalizeEmail(value: string): string {
  return sanitizeText(value, LIMITS.email).toLowerCase();
}

const NAME_RE = /^[\p{L}\p{M} .'-]+$/u;
// Parte local RFC 5322 (simplificada): letras, dígitos y .!#$%&'*+/=?^_`{|}~-
const EMAIL_LOCAL_RE = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i;
// Etiqueta de dominio: 1-63 caracteres, alfanumérica + guion (no extremo).
const DOMAIN_LABEL_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/i;
const PHONE_ALLOWED_RE = /^[+\d][\d\s\-().]*$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Las funciones check* reciben texto YA sanitizado y devuelven el error o null. */
export function checkName(value: string, label = 'Nombre'): string | null {
  if (value.length < 2) return `${label}: mínimo 2 caracteres.`;
  if (!NAME_RE.test(value)) return `${label}: solo letras, espacios y . ' -`;
  return null;
}

export function checkEmail(value: string): string | null {
  // Acepta cualquier dominio válido: .cl, .com.cl, .gob.cl, subdominios,
  // TLD largos (.technology), guiones y etiquetas + en la parte local.
  const fail = 'Correo electrónico inválido.';
  if (value.length < 5 || value.length > LIMITS.email) return fail;
  if (/\s/.test(value)) return fail;
  const at = value.lastIndexOf('@');
  if (at <= 0) return fail;
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  if (local.length === 0 || local.length > 64) return fail;
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return fail;
  if (!EMAIL_LOCAL_RE.test(local)) return fail;
  const labels = domain.toLowerCase().split('.');
  // Mínimo 2 etiquetas (dominio + TLD): cubre .cl, .com.cl, .edu.cl…
  if (labels.length < 2) return fail;
  for (const label of labels) {
    if (!DOMAIN_LABEL_RE.test(label)) return fail;
  }
  const tld = labels[labels.length - 1];
  if (!/^[a-z]{2,63}$/.test(tld)) return fail;
  return null;
}

export function checkPhone(value: string, label = 'Teléfono'): string | null {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15)
    return `${label}: debe tener entre 7 y 15 dígitos.`;
  if (!PHONE_ALLOWED_RE.test(value)) return `${label}: caracteres inválidos.`;
  return null;
}

export function checkPassword(value: string): string | null {
  if (value.length < 6) return 'Mínimo 6 caracteres.';
  return null;
}

export function checkRequired(
  value: string,
  label: string,
  min: number,
  max: number,
): string | null {
  if (value.length < min) return `${label}: mínimo ${min} caracteres.`;
  if (value.length > max) return `${label}: máximo ${max} caracteres.`;
  return null;
}

export function checkMax(
  value: string,
  label: string,
  max: number,
): string | null {
  if (value.length > max) return `${label}: máximo ${max} caracteres.`;
  return null;
}

/** Entero finito dentro de [min, max]; NaN/infinitos caen al mínimo. */
export function parseQty(raw: unknown, max: number, min = 1): number {
  const n = typeof raw === 'string' ? Number(raw) : Number(raw);
  if (!Number.isFinite(n)) return min;
  return Math.min(Math.max(Math.floor(n), min), Math.max(max, min));
}

/** Precio finito >= 0 o null si vacío/inválido. */
export function parsePrice(raw: string): number | null {
  const t = raw.trim();
  if (t === '') return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || n > 1e12) return null;
  return n;
}

/** Descuento 0–90 o null. */
export function parseDiscount(raw: string): number | null {
  const t = raw.trim();
  if (t === '') return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return Math.min(Math.max(Math.floor(n), 0), 90);
}

export function isUuid(value: string | undefined): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/**
 * Mensaje legible para cualquier error. Los errores de Supabase/PostgREST son
 * objetos planos ({message, details, hint, code}), NO instancias de Error:
 * mostrarlos con String() produce el inútil "[object Object]".
 */
export function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err) return err;
  if (typeof err === 'object' && err !== null) {
    const o = err as Record<string, unknown>;
    if (typeof o.message === 'string' && o.message) {
      const extra =
        typeof o.hint === 'string' && o.hint ? ` (${o.hint})` : '';
      return `${o.message}${extra}`;
    }
    try {
      const s = JSON.stringify(o);
      if (s && s !== '{}') return s;
    } catch {
      /* cae al genérico */
    }
  }
  return 'Error desconocido. Inténtalo de nuevo.';
}

const STREET_NUMBER_RE = /^[0-9a-zA-Z][0-9a-zA-Z ./-]{0,19}$/;
const POSTAL_RE = /^\d{7}$/;

export function checkStreetNumber(value: string): string | null {
  if (!value) return 'Número: requerido.';
  if (!STREET_NUMBER_RE.test(value)) return 'Número: caracteres inválidos.';
  return null;
}

export function checkRegion(value: string): string | null {
  if (!(REGIONS as readonly string[]).includes(value)) return 'Región inválida.';
  return null;
}

/** Postal chileno: vacío (opcional) o exactamente 7 dígitos. */
export function checkPostal(value: string): string | null {
  if (value === '') return null;
  if (!POSTAL_RE.test(value)) return 'Código postal: 7 dígitos.';
  return null;
}
