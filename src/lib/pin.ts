// Hash do PIN de admin (comando via WhatsApp) — nunca guardamos o PIN em
// texto puro, mesma lógica de senha. scrypt é nativo do Node (sem
// dependência nova) e, ao contrário de um hash rápido tipo SHA-256, é
// deliberadamente lento/pesado em memória — dificulta força bruta mesmo
// um PIN sendo curto (4-6 dígitos).
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pin, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPin(pin: string, armazenado: string | null): boolean {
  if (!armazenado) return false;
  const [salt, hash] = armazenado.split(":");
  if (!salt || !hash) return false;
  const tentativa = scryptSync(pin, salt, 64);
  const esperado = Buffer.from(hash, "hex");
  if (tentativa.length !== esperado.length) return false;
  return timingSafeEqual(tentativa, esperado);
}
