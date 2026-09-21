import { formatClock, formatDuration, formatMoney, levelLabel } from './format';

describe('format (utilidades de presentación)', () => {
  it('formatMoney: 0 es Gratis', () => {
    expect(formatMoney(0)).toBe('Gratis');
  });

  it('formatMoney: centavos a moneda', () => {
    expect(formatMoney(4999, 'USD')).toContain('49');
  });

  it('formatDuration: horas y minutos', () => {
    expect(formatDuration(3600 + 5 * 60)).toBe('1 h 05 min');
    expect(formatDuration(45 * 60)).toBe('45 min');
    expect(formatDuration(0)).toBe('0 min');
  });

  it('formatClock: mm:ss y h:mm:ss', () => {
    expect(formatClock(65)).toBe('01:05');
    expect(formatClock(3725)).toBe('1:02:05');
  });

  it('levelLabel traduce los niveles', () => {
    expect(levelLabel('beginner')).toBe('Principiante');
    expect(levelLabel('advanced')).toBe('Avanzado');
  });
});
