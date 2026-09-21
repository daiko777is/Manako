import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ProgressService } from './progress.service';

/**
 * Tests unitarios del cálculo de progreso (spec §4):
 * completed = watched_seconds >= duration_seconds * 0.9 (configurable).
 */
describe('ProgressService', () => {
  let service: ProgressService;

  const lesson = {
    id: 'lesson-1',
    durationSeconds: 1000,
    module: { courseId: 'course-1' },
  };

  const prismaMock = {
    lesson: {
      findMany: jest.fn().mockResolvedValue([lesson]),
    },
    lessonProgress: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockImplementation(({ create }: { create: Record<string, unknown> }) =>
        Promise.resolve({
          ...create,
          lessonId: create['lessonId'],
          lastWatchedAt: new Date(),
        }),
      ),
    },
    courseModule: {
      findMany: jest.fn().mockResolvedValue([
        {
          orderIndex: 0,
          lessons: [{ id: 'lesson-1', isPreview: false, orderIndex: 0 }],
        },
      ]),
    },
    $queryRaw: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ProgressService,
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => (key === 'PROGRESS_COMPLETION_THRESHOLD' ? 0.9 : undefined),
          },
        },
      ],
    }).compile();
    service = moduleRef.get(ProgressService);
  });

  it('marca completada al alcanzar el 90% de la duración', async () => {
    const res = await service.updateProgress('user-1', [
      { lessonId: 'lesson-1', watchedSeconds: 900 },
    ]);
    expect(res.lessons[0]!.completed).toBe(true);
    expect(prismaMock.lessonProgress.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ completed: true, watchedSeconds: 900 }),
      }),
    );
  });

  it('NO marca completada por debajo del umbral', async () => {
    const res = await service.updateProgress('user-1', [
      { lessonId: 'lesson-1', watchedSeconds: 899 },
    ]);
    expect(res.lessons[0]!.completed).toBe(false);
  });

  it('watched_seconds nunca decrece (rewind no pierde progreso)', async () => {
    prismaMock.lessonProgress.findUnique.mockResolvedValueOnce({
      watchedSeconds: 950,
      completed: true,
    });
    const res = await service.updateProgress('user-1', [
      { lessonId: 'lesson-1', watchedSeconds: 120 },
    ]);
    expect(res.lessons[0]!.watchedSeconds).toBe(950);
    expect(res.lessons[0]!.completed).toBe(true); // completed nunca vuelve a false
  });

  it('ignora lecciones inexistentes sin romper el lote', async () => {
    const res = await service.updateProgress('user-1', [
      { lessonId: 'no-existe', watchedSeconds: 10 },
    ]);
    expect(res.lessons).toHaveLength(0);
  });
});
