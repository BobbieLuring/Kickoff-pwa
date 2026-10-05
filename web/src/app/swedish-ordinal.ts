/** 1:a, 2:a, 3:e … 11:e, 12:e … 21:a, 22:a */
export function swedishOrdinal(n: number): string {
  const last = n % 10;
  const lastTwo = n % 100;
  const suffix = (last === 1 || last === 2) && lastTwo !== 11 && lastTwo !== 12 ? 'a' : 'e';
  return `${n}:${suffix}`;
}