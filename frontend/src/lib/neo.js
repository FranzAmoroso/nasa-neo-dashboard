// Dati degli asteroidi: chiamata al backend, normalizzazione, classificazione.
import { PLANET_BY_ID } from "./planets";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://nasa-neo-dashboard-production.up.railway.app";

export const DAY = 86400000;
export const LD_KM = 384400;
/** "Appena passato": resta visibile in 3D per 12 ore dopo il passaggio. */
export const RECENT_MS = 12 * 3600 * 1000;
export const WINDOW_BACK = 7;
export const WINDOW_AHEAD = 7;

/** Scarica gli asteroidi da `WINDOW_BACK` giorni fa a `WINDOW_AHEAD` giorni avanti. */
export async function fetchWindow(signal) {
  const res = await fetch(`${API_BASE}/asteroids/window?back=${WINDOW_BACK}&ahead=${WINDOW_AHEAD}`, { signal });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `The server answered with error ${res.status}.`);
  }
  const data = await res.json();
  return (data.asteroids || []).map(toAsteroid).filter(Boolean);
}

/** Pianeti per cui NeoWs registra passaggi ravvicinati, oltre alla Terra. */
export const TRACKED_BODIES = ["mercury", "venus", "mars", "jupiter"];

/**
 * Asteroidi vicino a un altro pianeta: si chiede solo quando l'utente apre quel pianeta.
 * Il backend tiene il risultato in Redis, quindi le volte successive risponde subito.
 */
export async function fetchBody(body, signal) {
  const res = await fetch(`${API_BASE}/asteroids/body/${body}?back=${WINDOW_BACK}&ahead=${WINDOW_AHEAD}`, { signal });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `The server answered with error ${res.status}.`);
  }
  const data = await res.json();
  return {
    tracked: data.tracked !== false,
    limited: Boolean(data.limited),
    checked: data.checked || 0,
    quotaLow: Boolean(data.quota_low),
    list: (data.asteroids || []).map(toAsteroid).filter(Boolean),
  };
}

/** Dal formato del backend al modello usato dall'interfaccia. */
export function toAsteroid(a) {
  const t = Date.parse(a.approach_utc);
  const km = Number(a.distance_km);
  if (!Number.isFinite(t) || !Number.isFinite(km)) return null;
  return {
    id: String(a.approach_id || a.id), // un asteroide può passare vicino a più pianeti
    neoId: String(a.id),
    name: a.name,
    body: a.body || "earth",
    t,
    km,
    ld: Number.isFinite(a.distance_ld) ? a.distance_ld : km / LD_KM,
    D: Number.isFinite(a.diameter_max_m) ? a.diameter_max_m : 0,
    Dmin: Number.isFinite(a.diameter_min_m) ? a.diameter_min_m : 0,
    v: Number.isFinite(a.speed_kms) ? a.speed_kms : 0,
    hazardous: Boolean(a.hazardous),
    jplUrl: a.jpl_url || null,
  };
}

// ---------- tempo ----------
export const isPast = (a, now) => a.t < now;
export const isRecent = (a, now) => a.t < now && now - a.t <= RECENT_MS;
/** Nella vista 3D: in arrivo e appena passati. */
export const isTracked = (a, now) => !isPast(a, now) || isRecent(a, now);

// ---------- classificazione ----------
export const DIST_COLUMNS = [
  ["Closer than the Moon", (a) => a.ld < 1],
  ["1–10 LD", (a) => a.ld >= 1 && a.ld < 10],
  ["Beyond 10 LD", (a) => a.ld >= 10],
];
export const SIZE_ROWS = [
  ["Small", "under 25 m", (a) => a.D < 25],
  ["Medium", "25–140 m", (a) => a.D >= 25 && a.D < 140],
  ["Large", "140 m and up", (a) => a.D >= 140],
];
export const distClass = (a) => (a.ld < 1 ? "closer than the Moon" : a.ld < 10 ? "1–10 LD" : "beyond 10 LD");
export const sizeClass = (a) => (a.D < 25 ? "small" : a.D < 140 ? "medium" : "large");

/** Confronta la distanza minima con le orbite delle lune del pianeta. */
export function moonCompare(a) {
  const p = PLANET_BY_ID[a.body];
  if (!p || !p.moons.length) return null;
  const moons = [...p.moons].sort((x, y) => x.a - y.a);
  const inner = moons.find((m) => m.a > a.km);
  if (inner)
    return `Passes inside the orbit of ${inner.name}, at ${fmt1((a.km / inner.a) * 100)}% of its distance from ${p.name}.`;
  const outer = moons[moons.length - 1];
  return `Passes beyond the orbit of ${outer.name}, ${fmt1(a.km / outer.a)} times farther out.`;
}

// ---------- formati ----------
const nf0 = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });
export const fmt0 = (n) => (Number.isFinite(n) ? nf0.format(n) : "–");
export const fmt1 = (n) => (Number.isFinite(n) ? nf1.format(n) : "–");
export const fmt2 = (n) => (Number.isFinite(n) ? nf2.format(n) : "–");
export const dClock = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
export const dShort = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
export const dDay = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" });
export const dDM = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long" });
export const dDMT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});
