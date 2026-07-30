import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync('src/lib/styles/tokens.css', 'utf8');

describe('tokens.css', () => {
  it('объявляет все токены, на которые опираются компоненты', () => {
    const required = [
      '--bg', '--surface', '--card-bg', '--fg', '--muted', '--line',
      '--accent', '--accent-male', '--accent-female', '--danger',
      '--radius', '--radius-sm', '--shadow-1', '--shadow-2',
      '--space-1', '--space-2', '--space-3', '--space-4', '--space-5',
      '--font-1', '--font-2', '--font-3', '--font-4', '--font-5', '--tap'
    ];
    for (const token of required) {
      expect(css, `отсутствует ${token}`).toContain(`${token}:`);
    }
  });

  it('переопределяет тему в prefers-color-scheme: dark', () => {
    expect(css).toContain('prefers-color-scheme: dark');
  });
});
