// Prisma returns monetary amounts as BigInt, which `JSON.stringify` cannot
// encode. Rather than patch BigInt.prototype globally (which would surprise
// other libraries), we recursively convert BigInt to a JS number at the API
// boundary. Amounts are in minor units and stay well within Number.MAX_SAFE_INTEGER
// for realistic values, so precision is preserved.
export function serialize<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, v) => (typeof v === 'bigint' ? Number(v) : v)),
  ) as T;
}
