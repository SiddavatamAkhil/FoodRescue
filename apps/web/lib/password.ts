export function passwordChecks(pw: string) {
  return [
    { label: "At least 8 characters", ok: pw.length >= 8 },
    { label: "Contains a letter", ok: /[A-Za-z]/.test(pw) },
    { label: "Contains a number", ok: /\d/.test(pw) },
  ];
}

/** 0–4. Requirements give up to 2; length, mixed case and symbols add the rest. */
export function passwordScore(pw: string): number {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8 && /[A-Za-z]/.test(pw) && /\d/.test(pw)) s = 2;
  else if (pw.length >= 6) s = 1;
  if (s >= 2 && pw.length >= 12) s++;
  if (s >= 2 && /[a-z]/.test(pw) && /[A-Z]/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  if (/^(password|12345678|qwerty)/i.test(pw)) s = Math.min(s, 1);
  return Math.min(s, 4);
}

export const SCORE_LABEL = ["Too short", "Weak", "Fair", "Good", "Strong"];
