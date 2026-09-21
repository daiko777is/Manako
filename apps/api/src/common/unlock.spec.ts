import { computeUnlockedSet, findNextLessonId, isCompletedByThreshold } from './unlock';

describe('unlock (bloqueo secuencial — spec §4/§6.2)', () => {
  const lessons = [
    { id: 'l0', isPreview: true, moduleOrderIndex: 0, orderIndex: 0 },
    { id: 'l1', isPreview: false, moduleOrderIndex: 0, orderIndex: 1 },
    { id: 'l2', isPreview: false, moduleOrderIndex: 1, orderIndex: 0 },
    { id: 'l3', isPreview: false, moduleOrderIndex: 1, orderIndex: 1 },
  ];

  it('sin nada completado: solo preview + primera lección', () => {
    const unlocked = computeUnlockedSet(lessons, new Set());
    expect(unlocked).toEqual(new Set(['l0', 'l1']));
  });

  it('completando l1 se desbloquea l2 pero no l3', () => {
    const unlocked = computeUnlockedSet(lessons, new Set(['l1']));
    expect(unlocked).toEqual(new Set(['l0', 'l1', 'l2']));
  });

  it('curso completo: todas desbloqueadas', () => {
    const unlocked = computeUnlockedSet(lessons, new Set(['l1', 'l2', 'l3']));
    expect(unlocked).toEqual(new Set(['l0', 'l1', 'l2', 'l3']));
  });

  it('el orden de entrada no importa (se ordena por módulo/lección)', () => {
    const shuffled = [lessons[3]!, lessons[1]!, lessons[0]!, lessons[2]!];
    const unlocked = computeUnlockedSet(shuffled, new Set(['l1']));
    expect(unlocked).toEqual(new Set(['l0', 'l1', 'l2']));
  });

  it('findNextLessonId: primera no completada', () => {
    expect(findNextLessonId(lessons, new Set(['l1']))).toBe('l2');
  });

  it('findNextLessonId: curso terminado devuelve la última', () => {
    expect(findNextLessonId(lessons, new Set(['l1', 'l2', 'l3']))).toBe('l3');
  });

  it('findNextLessonId: sin lecciones devuelve null', () => {
    expect(findNextLessonId([lessons[0]!], new Set())).toBeNull();
  });
});

describe('isCompletedByThreshold (spec §4: umbral 90%)', () => {
  it('900/1000 con umbral 0.9 → completada', () => {
    expect(isCompletedByThreshold(900, 1000, 0.9)).toBe(true);
  });

  it('899/1000 con umbral 0.9 → no completada', () => {
    expect(isCompletedByThreshold(899, 1000, 0.9)).toBe(false);
  });

  it('duración 0 (sin video) → basta haberla abierto', () => {
    expect(isCompletedByThreshold(1, 0, 0.9)).toBe(true);
    expect(isCompletedByThreshold(0, 0, 0.9)).toBe(false);
  });
});
