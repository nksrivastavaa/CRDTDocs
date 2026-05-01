export function env(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;

  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function optionalEnv(name: string, fallback?: string): string | undefined {
  return process.env[name] ?? fallback;
}

export function envBool(name: string, fallback = false): boolean {
  const value = process.env[name];

  if (value === undefined) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}
