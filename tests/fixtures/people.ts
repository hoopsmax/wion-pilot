/** The two made-up demo users from Sprout's seed data. */
export const CREDENTIALS = {
  Ava: { email: 'ava@sprout.test', password: 'sprout-ava' },
  Ben: { email: 'ben@sprout.test', password: 'sprout-ben' },
} as const;

export type PersonName = keyof typeof CREDENTIALS;

/** Turns a name written in a feature file into a known person, or fails with a clear message. */
export function personNamed(name: string): PersonName {
  if (name === 'Ava' || name === 'Ben') return name;
  throw new Error(`Unknown person "${name}" in a feature file. Known people: Ava, Ben.`);
}
