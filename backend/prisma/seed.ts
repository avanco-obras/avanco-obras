import {
  PrismaClient, UserRole, ProjectStatus, MeasurementMethod,
  WeeklyProgramStatus, WeeklyActivityStatus, WeeklyActivityOrigin,
  WeeklyRestrictionStatus, WeeklySnapshotKind,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Idempotent: if any project already exists (i.e. database was seeded or has
  // user data), skip seeding entirely so that container restarts don't wipe
  // imports/measurements. Re-seed manually by truncating tables and running
  // `npx prisma db seed`, or by setting FORCE_SEED=1 in the environment.
  const existingProjectCount = await prisma.project.count();
  if (existingProjectCount > 0 && process.env.FORCE_SEED !== '1') {
    console.log(
      `Seed skipped — ${existingProjectCount} project(s) already exist. ` +
      'Set FORCE_SEED=1 to wipe and reseed.',
    );
    // Módulo de Programação Semanal (v2): tabelas novas podem estar vazias
    // após o db push — semeia só esse módulo, sem tocar no resto.
    await backfillWeeklyModule();
    return;
  }

  console.log('Seeding database...');

  // ---------------------------------------------------------------------------
  // Clean existing data in dependency order
  // ---------------------------------------------------------------------------
  await prisma.weeklySnapshot.deleteMany();
  await prisma.weeklyRestrictionActivity.deleteMany();
  await prisma.weeklyRestriction.deleteMany();
  await prisma.weeklyActivity.deleteMany();
  await prisma.weeklyProgram.deleteMany();
  await prisma.restrictionType.deleteMany();
  await prisma.contractor.deleteMany();
  await prisma.measurement.deleteMany();
  await prisma.scheduleDependency.deleteMany();
  await prisma.scheduleItem.deleteMany();
  await prisma.activityType.deleteMany();
  await prisma.upload.deleteMany();
  await prisma.unit.deleteMany();
  await prisma.floor.deleteMany();
  await prisma.tower.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();

  console.log('Existing data cleared.');

  // ---------------------------------------------------------------------------
  // Users
  // ---------------------------------------------------------------------------
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const viewerPasswordHash = await bcrypt.hash('viewer123', 10);

  const adminUser = await prisma.user.create({
    data: {
      email: 'carlos@horizonte.com.br',
      username: 'carlos',
      passwordHash: adminPasswordHash,
      fullName: 'Carlos Eduardo Horizonte',
      role: UserRole.ADMIN,
      phone: '+55 11 99999-1234',
      crea: 'CREA-SP 123456/D',
      isActive: true,
    },
  });

  const viewerUser = await prisma.user.create({
    data: {
      email: 'viewer@horizonte.com.br',
      username: 'viewer',
      passwordHash: viewerPasswordHash,
      fullName: 'Ana Paula Viewer',
      role: UserRole.VIEWER,
      phone: '+55 11 98888-5678',
      isActive: true,
    },
  });

  console.log(`Created users: ${adminUser.username}, ${viewerUser.username}`);

  // ---------------------------------------------------------------------------
  // Project
  // ---------------------------------------------------------------------------
  const project = await prisma.project.create({
    data: {
      name: 'Residencial Vista Verde',
      company: 'Horizonte Construções Ltda.',
      address: 'Rua das Palmeiras, 500 - Jardim Vista Verde, São Paulo - SP, 04567-890',
      status: ProjectStatus.IN_PROGRESS,
      startDate: new Date('2025-01-06'),
      endDate: new Date('2026-12-31'),
      estimatedCost: 45000000.00,
      currency: 'BRL',
      totalArea: 12800.00,
      workdaysPerWeek: 5,
      hoursPerDay: 8,
      timezone: 'America/Sao_Paulo',
    },
  });

  console.log(`Created project: ${project.name}`);

  // ---------------------------------------------------------------------------
  // Project Members
  // ---------------------------------------------------------------------------
  await prisma.projectMember.create({
    data: {
      projectId: project.id,
      userId: adminUser.id,
      role: UserRole.ADMIN,
    },
  });

  await prisma.projectMember.create({
    data: {
      projectId: project.id,
      userId: viewerUser.id,
      role: UserRole.VIEWER,
    },
  });

  // ---------------------------------------------------------------------------
  // Activity Types
  // ---------------------------------------------------------------------------
  const activityTypesData = [
    { name: 'Alvenaria', measurementMethod: MeasurementMethod.METRIC, unit: 'm²', defaultQuantity: 80.00, weight: 1.5, order: 1 },
    { name: 'Reboco', measurementMethod: MeasurementMethod.METRIC, unit: 'm²', defaultQuantity: 80.00, weight: 1.2, order: 2 },
    { name: 'Contrapiso', measurementMethod: MeasurementMethod.METRIC, unit: 'm²', defaultQuantity: 60.00, weight: 1.0, order: 3 },
    { name: 'Instalação Hidráulica', measurementMethod: MeasurementMethod.PERCENT, unit: '%', defaultQuantity: 100.00, weight: 1.3, order: 4 },
    { name: 'Instalação Elétrica', measurementMethod: MeasurementMethod.PERCENT, unit: '%', defaultQuantity: 100.00, weight: 1.3, order: 5 },
    { name: 'Revestimento de Piso', measurementMethod: MeasurementMethod.METRIC, unit: 'm²', defaultQuantity: 55.00, weight: 1.1, order: 6 },
    { name: 'Pintura', measurementMethod: MeasurementMethod.PERCENT, unit: '%', defaultQuantity: 100.00, weight: 0.9, order: 7 },
    { name: 'Gesso/Drywall', measurementMethod: MeasurementMethod.METRIC, unit: 'm²', defaultQuantity: 70.00, weight: 1.0, order: 8 },
  ];

  const activityTypes: Record<string, string> = {};
  for (const at of activityTypesData) {
    const created = await prisma.activityType.create({
      data: { projectId: project.id, ...at },
    });
    activityTypes[at.name] = created.id;
  }

  console.log(`Created ${activityTypesData.length} activity types.`);

  // ---------------------------------------------------------------------------
  // Towers, Floors and Units
  // ---------------------------------------------------------------------------
  const towerNames = ['Torre A', 'Torre B'];
  const floorDefinitions = [
    { name: 'Subsolo 2', level: -2, order: -2 },
    { name: 'Subsolo 1', level: -1, order: -1 },
    { name: 'Térreo', level: 0, order: 0 },
    { name: '1º Andar', level: 1, order: 1 },
    { name: '2º Andar', level: 2, order: 2 },
    { name: '3º Andar', level: 3, order: 3 },
    { name: '4º Andar', level: 4, order: 4 },
    { name: '5º Andar', level: 5, order: 5 },
    { name: '6º Andar', level: 6, order: 6 },
    { name: 'Cobertura', level: 7, order: 7 },
  ];

  // unitsByFloor[towerId][floorId] = unitId[]
  const unitIdsByTowerFloor: Record<string, Record<string, string[]>> = {};

  for (let tIdx = 0; tIdx < towerNames.length; tIdx++) {
    const towerName = towerNames[tIdx];
    const tower = await prisma.tower.create({
      data: { projectId: project.id, name: towerName, order: tIdx },
    });

    unitIdsByTowerFloor[tower.id] = {};

    for (const floorDef of floorDefinitions) {
      const floor = await prisma.floor.create({
        data: { towerId: tower.id, name: floorDef.name, level: floorDef.level, order: floorDef.order },
      });

      unitIdsByTowerFloor[tower.id][floor.id] = [];

      // Térreo has 2 units (lojas/salão), Cobertura has 2 units (coberturas), other floors have 4 apts
      let unitDefs: { name: string; area: number }[];
      if (floorDef.level < 0) {
        // Subsolos — garagem / vagas e áreas técnicas
        const ss = Math.abs(floorDef.level);
        unitDefs = [
          { name: `Vagas SS${ss} - Bloco A`, area: 240.00 },
          { name: `Vagas SS${ss} - Bloco B`, area: 240.00 },
          { name: `Depósitos SS${ss}`, area: 60.00 },
          { name: `Área Técnica SS${ss}`, area: 40.00 },
        ];
      } else if (floorDef.level === 0) {
        // Térreo
        unitDefs = [
          { name: `Loja 01`, area: 120.00 },
          { name: `Loja 02`, area: 120.00 },
          { name: `Hall/Circulação`, area: 45.00 },
          { name: `Área Técnica`, area: 30.00 },
        ];
      } else if (floorDef.level === 7) {
        // Cobertura
        unitDefs = [
          { name: `Cobertura 01`, area: 180.00 },
          { name: `Cobertura 02`, area: 180.00 },
          { name: `Terraço 01`, area: 60.00 },
          { name: `Terraço 02`, area: 60.00 },
        ];
      } else {
        // Regular floors 1-6
        const floorNum = floorDef.level;
        unitDefs = [
          { name: `Apt ${floorNum}01`, area: 72.50 },
          { name: `Apt ${floorNum}02`, area: 68.30 },
          { name: `Apt ${floorNum}03`, area: 72.50 },
          { name: `Apt ${floorNum}04`, area: 68.30 },
        ];
      }

      for (let uIdx = 0; uIdx < unitDefs.length; uIdx++) {
        const unit = await prisma.unit.create({
          data: {
            floorId: floor.id,
            name: unitDefs[uIdx].name,
            area: unitDefs[uIdx].area,
            order: uIdx,
          },
        });
        unitIdsByTowerFloor[tower.id][floor.id].push(unit.id);
      }
    }
  }

  console.log('Created towers, floors, and units.');

  // ---------------------------------------------------------------------------
  // Schedule Items (EAP Hierárquica)
  // ---------------------------------------------------------------------------
  // Level 0: Project root
  const rootItem = await prisma.scheduleItem.create({
    data: {
      projectId: project.id,
      parentId: null,
      activityTypeId: null,
      code: '1',
      name: 'Residencial Vista Verde',
      level: 0,
      startDate: new Date('2025-01-06'),
      endDate: new Date('2026-12-31'),
      durationDays: 725,
      plannedProgress: 35.00,
      physicalProgress: 32.50,
      weight: 1.0000,
      isCriticalPath: true,
      order: 0,
    },
  });

  // Helper: week offset from project start
  const projectStart = new Date('2025-01-06');
  function addDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  // Level 1: Infrastructure
  const infraItem = await prisma.scheduleItem.create({
    data: {
      projectId: project.id,
      parentId: rootItem.id,
      code: '1.1',
      name: 'Infraestrutura e Fundações',
      level: 1,
      startDate: new Date('2025-01-06'),
      endDate: new Date('2025-04-30'),
      durationDays: 114,
      plannedProgress: 100.00,
      physicalProgress: 100.00,
      weight: 0.1200,
      isCriticalPath: true,
      order: 0,
    },
  });

  await prisma.scheduleItem.createMany({
    data: [
      {
        projectId: project.id,
        parentId: infraItem.id,
        code: '1.1.1',
        name: 'Terraplanagem e Locação',
        level: 2,
        startDate: new Date('2025-01-06'),
        endDate: new Date('2025-01-24'),
        durationDays: 14,
        plannedProgress: 100.00,
        physicalProgress: 100.00,
        weight: 0.0200,
        isCriticalPath: true,
        order: 0,
      },
      {
        projectId: project.id,
        parentId: infraItem.id,
        code: '1.1.2',
        name: 'Estacas e Blocos de Coroamento',
        level: 2,
        startDate: new Date('2025-01-27'),
        endDate: new Date('2025-03-14'),
        durationDays: 45,
        plannedProgress: 100.00,
        physicalProgress: 100.00,
        weight: 0.0600,
        isCriticalPath: true,
        order: 1,
      },
      {
        projectId: project.id,
        parentId: infraItem.id,
        code: '1.1.3',
        name: 'Vigas Baldrame e Laje de Subsolo',
        level: 2,
        startDate: new Date('2025-03-17'),
        endDate: new Date('2025-04-30'),
        durationDays: 35,
        plannedProgress: 100.00,
        physicalProgress: 100.00,
        weight: 0.0400,
        isCriticalPath: true,
        order: 2,
      },
    ],
  });

  // Level 1: Torre A
  const torreAItem = await prisma.scheduleItem.create({
    data: {
      projectId: project.id,
      parentId: rootItem.id,
      code: '1.2',
      name: 'Torre A - Estrutura e Acabamentos',
      level: 1,
      startDate: new Date('2025-05-05'),
      endDate: new Date('2026-08-31'),
      durationDays: 483,
      plannedProgress: 55.00,
      physicalProgress: 50.00,
      weight: 0.4400,
      isCriticalPath: true,
      order: 1,
    },
  });

  // Torre A - Estrutura (level 2)
  const torreAStructura = await prisma.scheduleItem.create({
    data: {
      projectId: project.id,
      parentId: torreAItem.id,
      code: '1.2.1',
      name: 'Torre A - Estrutura',
      level: 2,
      startDate: new Date('2025-05-05'),
      endDate: new Date('2025-12-31'),
      durationDays: 240,
      plannedProgress: 90.00,
      physicalProgress: 85.00,
      weight: 0.1800,
      isCriticalPath: true,
      order: 0,
    },
  });

  // Torre A - Estrutura floors (level 3)
  const torreAFloorStructureData = [
    { code: '1.2.1.1', name: 'Torre A - Térreo - Estrutura', startOff: 0, dur: 20, planned: 100, actual: 100, crit: true },
    { code: '1.2.1.2', name: 'Torre A - 1º Andar - Estrutura', startOff: 21, dur: 18, planned: 100, actual: 100, crit: true },
    { code: '1.2.1.3', name: 'Torre A - 2º Andar - Estrutura', startOff: 40, dur: 18, planned: 100, actual: 100, crit: true },
    { code: '1.2.1.4', name: 'Torre A - 3º Andar - Estrutura', startOff: 59, dur: 18, planned: 100, actual: 98, crit: true },
    { code: '1.2.1.5', name: 'Torre A - 4º Andar - Estrutura', startOff: 78, dur: 18, planned: 80, actual: 75, crit: false },
    { code: '1.2.1.6', name: 'Torre A - 5º Andar - Estrutura', startOff: 97, dur: 18, planned: 50, actual: 40, crit: false },
    { code: '1.2.1.7', name: 'Torre A - 6º Andar - Estrutura', startOff: 116, dur: 18, planned: 20, actual: 10, crit: false },
    { code: '1.2.1.8', name: 'Torre A - Cobertura - Estrutura', startOff: 135, dur: 25, planned: 0, actual: 0, crit: false },
  ];

  const baseStructDate = new Date('2025-05-05');
  for (let i = 0; i < torreAFloorStructureData.length; i++) {
    const fd = torreAFloorStructureData[i];
    await prisma.scheduleItem.create({
      data: {
        projectId: project.id,
        parentId: torreAStructura.id,
        code: fd.code,
        name: fd.name,
        level: 3,
        startDate: addDays(baseStructDate, fd.startOff),
        endDate: addDays(baseStructDate, fd.startOff + fd.dur),
        durationDays: fd.dur,
        plannedProgress: fd.planned,
        physicalProgress: fd.actual,
        weight: 0.0225,
        isCriticalPath: fd.crit,
        order: i,
      },
    });
  }

  // Torre A - Alvenaria (level 2)
  const torreAAlvenaria = await prisma.scheduleItem.create({
    data: {
      projectId: project.id,
      parentId: torreAItem.id,
      activityTypeId: activityTypes['Alvenaria'],
      code: '1.2.2',
      name: 'Torre A - Alvenaria',
      level: 2,
      startDate: new Date('2025-06-02'),
      endDate: new Date('2026-02-28'),
      durationDays: 270,
      plannedProgress: 70.00,
      physicalProgress: 65.00,
      weight: 0.0800,
      isCriticalPath: false,
      order: 1,
    },
  });

  const baseAlvDate = new Date('2025-06-02');
  const torreAAlvFloors = [
    { code: '1.2.2.1', name: 'Torre A - Térreo - Alvenaria', startOff: 0, dur: 25, planned: 100, actual: 100 },
    { code: '1.2.2.2', name: 'Torre A - 1º Andar - Alvenaria', startOff: 26, dur: 25, planned: 100, actual: 100 },
    { code: '1.2.2.3', name: 'Torre A - 2º Andar - Alvenaria', startOff: 52, dur: 25, planned: 100, actual: 95 },
    { code: '1.2.2.4', name: 'Torre A - 3º Andar - Alvenaria', startOff: 78, dur: 25, planned: 85, actual: 80 },
    { code: '1.2.2.5', name: 'Torre A - 4º Andar - Alvenaria', startOff: 104, dur: 25, planned: 60, actual: 50 },
    { code: '1.2.2.6', name: 'Torre A - 5º Andar - Alvenaria', startOff: 130, dur: 25, planned: 30, actual: 20 },
    { code: '1.2.2.7', name: 'Torre A - 6º Andar - Alvenaria', startOff: 156, dur: 25, planned: 10, actual: 5 },
    { code: '1.2.2.8', name: 'Torre A - Cobertura - Alvenaria', startOff: 182, dur: 30, planned: 0, actual: 0 },
  ];

  for (let i = 0; i < torreAAlvFloors.length; i++) {
    const fd = torreAAlvFloors[i];
    await prisma.scheduleItem.create({
      data: {
        projectId: project.id,
        parentId: torreAAlvenaria.id,
        activityTypeId: activityTypes['Alvenaria'],
        code: fd.code,
        name: fd.name,
        level: 3,
        startDate: addDays(baseAlvDate, fd.startOff),
        endDate: addDays(baseAlvDate, fd.startOff + fd.dur),
        durationDays: fd.dur,
        plannedProgress: fd.planned,
        physicalProgress: fd.actual,
        weight: 0.0100,
        isCriticalPath: false,
        order: i,
      },
    });
  }

  // Torre A - Instalações (level 2)
  const torreAInstHid = await prisma.scheduleItem.create({
    data: {
      projectId: project.id,
      parentId: torreAItem.id,
      activityTypeId: activityTypes['Instalação Hidráulica'],
      code: '1.2.3',
      name: 'Torre A - Instalações Hidráulicas',
      level: 2,
      startDate: new Date('2025-07-07'),
      endDate: new Date('2026-04-30'),
      durationDays: 297,
      plannedProgress: 55.00,
      physicalProgress: 48.00,
      weight: 0.0700,
      isCriticalPath: false,
      order: 2,
    },
  });

  const torreAInstEle = await prisma.scheduleItem.create({
    data: {
      projectId: project.id,
      parentId: torreAItem.id,
      activityTypeId: activityTypes['Instalação Elétrica'],
      code: '1.2.4',
      name: 'Torre A - Instalações Elétricas',
      level: 2,
      startDate: new Date('2025-07-07'),
      endDate: new Date('2026-04-30'),
      durationDays: 297,
      plannedProgress: 50.00,
      physicalProgress: 45.00,
      weight: 0.0700,
      isCriticalPath: false,
      order: 3,
    },
  });

  // Torre A - Revestimentos (level 2)
  const torreARevest = await prisma.scheduleItem.create({
    data: {
      projectId: project.id,
      parentId: torreAItem.id,
      code: '1.2.5',
      name: 'Torre A - Revestimentos e Acabamentos',
      level: 2,
      startDate: new Date('2025-09-01'),
      endDate: new Date('2026-08-31'),
      durationDays: 364,
      plannedProgress: 30.00,
      physicalProgress: 25.00,
      weight: 0.1400,
      isCriticalPath: false,
      order: 4,
    },
  });

  const baseRevestDate = new Date('2025-09-01');
  const torreARevestFloors = [
    { code: '1.2.5.1', name: 'Torre A - Térreo - Revestimentos', startOff: 0, dur: 35, planned: 100, actual: 95 },
    { code: '1.2.5.2', name: 'Torre A - 1º Andar - Revestimentos', startOff: 36, dur: 35, planned: 90, actual: 85 },
    { code: '1.2.5.3', name: 'Torre A - 2º Andar - Revestimentos', startOff: 72, dur: 35, planned: 60, actual: 50 },
    { code: '1.2.5.4', name: 'Torre A - 3º Andar - Revestimentos', startOff: 108, dur: 35, planned: 30, actual: 20 },
    { code: '1.2.5.5', name: 'Torre A - 4º Andar - Revestimentos', startOff: 144, dur: 35, planned: 10, actual: 5 },
    { code: '1.2.5.6', name: 'Torre A - 5º Andar - Revestimentos', startOff: 180, dur: 35, planned: 0, actual: 0 },
    { code: '1.2.5.7', name: 'Torre A - 6º Andar - Revestimentos', startOff: 216, dur: 35, planned: 0, actual: 0 },
    { code: '1.2.5.8', name: 'Torre A - Cobertura - Revestimentos', startOff: 252, dur: 40, planned: 0, actual: 0 },
  ];

  for (let i = 0; i < torreARevestFloors.length; i++) {
    const fd = torreARevestFloors[i];
    await prisma.scheduleItem.create({
      data: {
        projectId: project.id,
        parentId: torreARevest.id,
        code: fd.code,
        name: fd.name,
        level: 3,
        startDate: addDays(baseRevestDate, fd.startOff),
        endDate: addDays(baseRevestDate, fd.startOff + fd.dur),
        durationDays: fd.dur,
        plannedProgress: fd.planned,
        physicalProgress: fd.actual,
        weight: 0.0175,
        isCriticalPath: false,
        order: i,
      },
    });
  }

  // Level 1: Torre B
  const torreBItem = await prisma.scheduleItem.create({
    data: {
      projectId: project.id,
      parentId: rootItem.id,
      code: '1.3',
      name: 'Torre B - Estrutura e Acabamentos',
      level: 1,
      startDate: new Date('2025-06-02'),
      endDate: new Date('2026-11-30'),
      durationDays: 546,
      plannedProgress: 40.00,
      physicalProgress: 35.00,
      weight: 0.4400,
      isCriticalPath: false,
      order: 2,
    },
  });

  const torreBStructura = await prisma.scheduleItem.create({
    data: {
      projectId: project.id,
      parentId: torreBItem.id,
      code: '1.3.1',
      name: 'Torre B - Estrutura',
      level: 2,
      startDate: new Date('2025-06-02'),
      endDate: new Date('2026-01-31'),
      durationDays: 243,
      plannedProgress: 75.00,
      physicalProgress: 70.00,
      weight: 0.1800,
      isCriticalPath: false,
      order: 0,
    },
  });

  const baseTorreBStructDate = new Date('2025-06-02');
  const torreBFloorStructureData = [
    { code: '1.3.1.1', name: 'Torre B - Térreo - Estrutura', startOff: 0, dur: 20, planned: 100, actual: 100 },
    { code: '1.3.1.2', name: 'Torre B - 1º Andar - Estrutura', startOff: 21, dur: 18, planned: 100, actual: 100 },
    { code: '1.3.1.3', name: 'Torre B - 2º Andar - Estrutura', startOff: 40, dur: 18, planned: 100, actual: 95 },
    { code: '1.3.1.4', name: 'Torre B - 3º Andar - Estrutura', startOff: 59, dur: 18, planned: 80, actual: 70 },
    { code: '1.3.1.5', name: 'Torre B - 4º Andar - Estrutura', startOff: 78, dur: 18, planned: 50, actual: 40 },
    { code: '1.3.1.6', name: 'Torre B - 5º Andar - Estrutura', startOff: 97, dur: 18, planned: 20, actual: 10 },
    { code: '1.3.1.7', name: 'Torre B - 6º Andar - Estrutura', startOff: 116, dur: 18, planned: 5, actual: 0 },
    { code: '1.3.1.8', name: 'Torre B - Cobertura - Estrutura', startOff: 135, dur: 25, planned: 0, actual: 0 },
  ];

  for (let i = 0; i < torreBFloorStructureData.length; i++) {
    const fd = torreBFloorStructureData[i];
    await prisma.scheduleItem.create({
      data: {
        projectId: project.id,
        parentId: torreBStructura.id,
        code: fd.code,
        name: fd.name,
        level: 3,
        startDate: addDays(baseTorreBStructDate, fd.startOff),
        endDate: addDays(baseTorreBStructDate, fd.startOff + fd.dur),
        durationDays: fd.dur,
        plannedProgress: fd.planned,
        physicalProgress: fd.actual,
        weight: 0.0225,
        isCriticalPath: false,
        order: i,
      },
    });
  }

  // Torre B - Alvenaria
  const torreBAlvenaria = await prisma.scheduleItem.create({
    data: {
      projectId: project.id,
      parentId: torreBItem.id,
      activityTypeId: activityTypes['Alvenaria'],
      code: '1.3.2',
      name: 'Torre B - Alvenaria',
      level: 2,
      startDate: new Date('2025-07-07'),
      endDate: new Date('2026-04-30'),
      durationDays: 297,
      plannedProgress: 45.00,
      physicalProgress: 38.00,
      weight: 0.0800,
      isCriticalPath: false,
      order: 1,
    },
  });

  const baseTorreBAlvDate = new Date('2025-07-07');
  const torreBAlvFloors = [
    { code: '1.3.2.1', name: 'Torre B - Térreo - Alvenaria', startOff: 0, dur: 25, planned: 100, actual: 100 },
    { code: '1.3.2.2', name: 'Torre B - 1º Andar - Alvenaria', startOff: 26, dur: 25, planned: 90, actual: 85 },
    { code: '1.3.2.3', name: 'Torre B - 2º Andar - Alvenaria', startOff: 52, dur: 25, planned: 60, actual: 50 },
    { code: '1.3.2.4', name: 'Torre B - 3º Andar - Alvenaria', startOff: 78, dur: 25, planned: 30, actual: 20 },
    { code: '1.3.2.5', name: 'Torre B - 4º Andar - Alvenaria', startOff: 104, dur: 25, planned: 10, actual: 5 },
    { code: '1.3.2.6', name: 'Torre B - 5º Andar - Alvenaria', startOff: 130, dur: 25, planned: 0, actual: 0 },
    { code: '1.3.2.7', name: 'Torre B - 6º Andar - Alvenaria', startOff: 156, dur: 25, planned: 0, actual: 0 },
    { code: '1.3.2.8', name: 'Torre B - Cobertura - Alvenaria', startOff: 182, dur: 30, planned: 0, actual: 0 },
  ];

  for (let i = 0; i < torreBAlvFloors.length; i++) {
    const fd = torreBAlvFloors[i];
    await prisma.scheduleItem.create({
      data: {
        projectId: project.id,
        parentId: torreBAlvenaria.id,
        activityTypeId: activityTypes['Alvenaria'],
        code: fd.code,
        name: fd.name,
        level: 3,
        startDate: addDays(baseTorreBAlvDate, fd.startOff),
        endDate: addDays(baseTorreBAlvDate, fd.startOff + fd.dur),
        durationDays: fd.dur,
        plannedProgress: fd.planned,
        physicalProgress: fd.actual,
        weight: 0.0100,
        isCriticalPath: false,
        order: i,
      },
    });
  }

  // Level 1: External Works & Finishing
  const externalItem = await prisma.scheduleItem.create({
    data: {
      projectId: project.id,
      parentId: rootItem.id,
      code: '1.4',
      name: 'Obras Externas e Urbanização',
      level: 1,
      startDate: new Date('2026-06-01'),
      endDate: new Date('2026-11-30'),
      durationDays: 182,
      plannedProgress: 0.00,
      physicalProgress: 0.00,
      weight: 0.0400,
      isCriticalPath: false,
      order: 3,
    },
  });

  await prisma.scheduleItem.createMany({
    data: [
      {
        projectId: project.id,
        parentId: externalItem.id,
        code: '1.4.1',
        name: 'Pavimentação e Estacionamento',
        level: 2,
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-08-31'),
        durationDays: 91,
        plannedProgress: 0,
        physicalProgress: 0,
        weight: 0.0150,
        isCriticalPath: false,
        order: 0,
      },
      {
        projectId: project.id,
        parentId: externalItem.id,
        code: '1.4.2',
        name: 'Paisagismo e Jardins',
        level: 2,
        startDate: new Date('2026-09-01'),
        endDate: new Date('2026-10-31'),
        durationDays: 60,
        plannedProgress: 0,
        physicalProgress: 0,
        weight: 0.0100,
        isCriticalPath: false,
        order: 1,
      },
      {
        projectId: project.id,
        parentId: externalItem.id,
        code: '1.4.3',
        name: 'Área de Lazer e Piscina',
        level: 2,
        startDate: new Date('2026-08-01'),
        endDate: new Date('2026-11-30'),
        durationDays: 121,
        plannedProgress: 0,
        physicalProgress: 0,
        weight: 0.0150,
        isCriticalPath: false,
        order: 2,
      },
    ],
  });

  console.log('Created schedule items (EAP with 50+ items).');

  // ---------------------------------------------------------------------------
  // Measurements - Realistic progress by floor level
  // ---------------------------------------------------------------------------
  // Fetch all towers and their floors to get unit IDs
  const towers = await prisma.tower.findMany({
    where: { projectId: project.id },
    include: {
      floors: {
        include: { units: true },
        orderBy: { level: 'asc' },
      },
    },
    orderBy: { order: 'asc' },
  });

  // Progress by floor level (lower floors more complete)
  // level 0: Térreo ~95%, level 1: ~90%, level 2: ~80%, level 3: ~65%
  // level 4: ~45%, level 5: ~20%, level 6: ~10%, level 7 (cobertura): ~0%
  const progressByLevel: Record<number, number[]> = {
    0: [95, 95, 90, 88, 92, 90, 85, 88], // activity percentages for 8 activities
    1: [90, 85, 80, 82, 80, 75, 70, 78],
    2: [80, 75, 70, 72, 70, 60, 55, 65],
    3: [65, 60, 55, 58, 55, 45, 40, 50],
    4: [45, 40, 35, 38, 35, 25, 20, 30],
    5: [20, 15, 10, 12, 10, 5, 0, 8],
    6: [10, 5, 0, 5, 5, 0, 0, 0],
    7: [0, 0, 0, 0, 0, 0, 0, 0],
  };

  const activityTypeIds = Object.values(activityTypes);
  const activityTypeNames = Object.keys(activityTypes);

  let measurementCount = 0;
  const measurementDate = new Date('2025-04-21');

  for (const tower of towers) {
    for (const floor of tower.floors) {
      const progs = progressByLevel[floor.level] || [0, 0, 0, 0, 0, 0, 0, 0];

      // Slightly different progress for Torre B (a bit less advanced)
      const towerOffset = tower.name === 'Torre B' ? -8 : 0;

      for (let aIdx = 0; aIdx < activityTypeIds.length; aIdx++) {
        const actId = activityTypeIds[aIdx];
        const actName = activityTypeNames[aIdx];
        let pct = Math.max(0, progs[aIdx] + towerOffset);

        // Only create measurements where there is actual progress
        if (pct <= 0) continue;

        for (const unit of floor.units) {
          // Vary slightly by unit to make it realistic
          const unitVariation = (unit.order - 1.5) * 2; // -3 to +3
          const finalPct = Math.min(100, Math.max(0, pct + unitVariation));

          if (finalPct <= 0) continue;

          // Determine executedQty and totalQty for METRIC activities
          let executedQty: number | null = null;
          let totalQty: number | null = null;

          if (actName === 'Alvenaria' || actName === 'Reboco' || actName === 'Contrapiso' || actName === 'Gesso/Drywall') {
            const area = parseFloat(unit.area?.toString() || '70');
            totalQty = area;
            executedQty = parseFloat(((finalPct / 100) * area).toFixed(2));
          } else if (actName === 'Revestimento de Piso') {
            const area = parseFloat(unit.area?.toString() || '55');
            totalQty = area * 0.85; // piso covers ~85% of unit area
            executedQty = parseFloat(((finalPct / 100) * totalQty).toFixed(2));
          }

          await prisma.measurement.create({
            data: {
              unitId: unit.id,
              activityTypeId: actId,
              measuredById: adminUser.id,
              date: measurementDate,
              percentComplete: finalPct,
              executedQty: executedQty,
              totalQty: totalQty,
              notes: finalPct >= 100 ? 'Concluído' : `Andamento normal - ${finalPct.toFixed(0)}% executado`,
            },
          });
          measurementCount++;
        }
      }
    }
  }

  console.log(`Created ${measurementCount} measurements.`);

  await seedWeeklyModule(project.id, project.weekStartDay ?? 1, adminUser.id);

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  const counts = {
    users: await prisma.user.count(),
    projects: await prisma.project.count(),
    towers: await prisma.tower.count(),
    floors: await prisma.floor.count(),
    units: await prisma.unit.count(),
    activityTypes: await prisma.activityType.count(),
    scheduleItems: await prisma.scheduleItem.count(),
    measurements: await prisma.measurement.count(),
    weeklyPrograms: await prisma.weeklyProgram.count(),
    weeklyActivities: await prisma.weeklyActivity.count(),
    weeklyRestrictions: await prisma.weeklyRestriction.count(),
    contractors: await prisma.contractor.count(),
  };

  console.log('\n=== Seed Summary ===');
  console.log(`Users:          ${counts.users}`);
  console.log(`Projects:       ${counts.projects}`);
  console.log(`Towers:         ${counts.towers}`);
  console.log(`Floors:         ${counts.floors}`);
  console.log(`Units:          ${counts.units}`);
  console.log(`Activity Types: ${counts.activityTypes}`);
  console.log(`Schedule Items: ${counts.scheduleItems}`);
  console.log(`Measurements:   ${counts.measurements}`);
  console.log(`Weekly Programs:     ${counts.weeklyPrograms}`);
  console.log(`Weekly Activities:   ${counts.weeklyActivities}`);
  console.log(`Weekly Restrictions: ${counts.weeklyRestrictions}`);
  console.log(`Contractors:         ${counts.contractors}`);
  console.log('\nDatabase seeded successfully!');
  console.log('\nCredentials:');
  console.log('  Admin:  carlos@horizonte.com.br / admin123');
  console.log('  Viewer: viewer@horizonte.com.br / viewer123');
}

// ---------------------------------------------------------------------------
// Programação Semanal (v2) — empreiteiras, tipos de restrição, semanas exemplo
// ---------------------------------------------------------------------------

const DEFAULT_RESTRICTION_TYPES = [
  'Material', 'Projeto', 'Mão de Obra', 'Equipamento', 'Clima',
  'Dependência de outra atividade', 'Cliente', 'Financeiro',
];

function startOfWeekUtc(date: Date, weekStartDay: number): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const diff = (d.getUTCDay() - weekStartDay + 7) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function isoWeek(date: Date): { week: number; year: number } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { week, year: d.getUTCFullYear() };
}

/** Indicadores no formato gravado em WeeklyProgram.indicators no fechamento. */
function computeSeedIndicators(
  activities: Array<{ status: WeeklyActivityStatus; contractorName?: string | null; responsible?: string | null }>,
  restrictions: Array<{ typeName?: string | null; status: WeeklyRestrictionStatus }>,
) {
  const valid = activities.filter((a) => a.status !== WeeklyActivityStatus.CANCELADA);
  const completed = valid.filter((a) => a.status === WeeklyActivityStatus.CONCLUIDA);
  const carried = valid.filter((a) => a.status !== WeeklyActivityStatus.CONCLUIDA);
  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);

  const groupBy = <T,>(arr: T[], key: (t: T) => string) => {
    const m = new Map<string, T[]>();
    arr.forEach((x) => {
      const k = key(x);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(x);
    });
    return m;
  };

  const byContractor = Array.from(groupBy(valid, (a) => a.contractorName ?? 'Sem empresa')).map(([name, list]) => ({
    name,
    total: list.length,
    completed: list.filter((a) => a.status === WeeklyActivityStatus.CONCLUIDA).length,
    ppc: pct(list.filter((a) => a.status === WeeklyActivityStatus.CONCLUIDA).length, list.length),
    reprogrammedPct: pct(list.filter((a) => a.status !== WeeklyActivityStatus.CONCLUIDA).length, list.length),
  }));

  const byResponsible = Array.from(groupBy(valid, (a) => a.responsible ?? 'Sem responsável')).map(([name, list]) => ({
    responsible: name,
    planned: list.length,
    delivered: list.filter((a) => a.status === WeeklyActivityStatus.CONCLUIDA).length,
    ppc: pct(list.filter((a) => a.status === WeeklyActivityStatus.CONCLUIDA).length, list.length),
  }));

  const causes = groupBy(restrictions, (r) => r.typeName ?? 'Sem tipo');
  const topCauses = Array.from(causes)
    .map(([type, list]) => ({ type, count: list.length }))
    .sort((a, b) => b.count - a.count);

  return {
    ppc: pct(completed.length, valid.length),
    totalActivities: activities.length,
    validActivities: valid.length,
    completed: completed.length,
    cancelled: activities.length - valid.length,
    carriedOver: carried.length,
    reprogrammedPct: pct(carried.length, valid.length),
    restrictionsCount: restrictions.length,
    restrictionsPending: restrictions.filter((r) => r.status === WeeklyRestrictionStatus.PENDENTE).length,
    topCauses,
    byContractor,
    byResponsible,
  };
}

async function seedWeeklyModule(projectId: string, weekStartDay: number, adminUserId: string) {
  const [alfa, beta, hidro] = await Promise.all([
    prisma.contractor.create({ data: { projectId, name: 'Construtora Alfa' } }),
    prisma.contractor.create({ data: { projectId, name: 'Beta Acabamentos' } }),
    prisma.contractor.create({ data: { projectId, name: 'Hidro Instalações' } }),
  ]);

  await prisma.restrictionType.createMany({
    data: DEFAULT_RESTRICTION_TYPES.map((name, i) => ({ projectId, name, order: i })),
  });
  const types = await prisma.restrictionType.findMany({ where: { projectId } });
  const typeId = (name: string) => types.find((t) => t.name === name)!.id;

  const currentStart = startOfWeekUtc(new Date(), weekStartDay);
  const prevStart = addDays(currentStart, -7);

  // ── Semana anterior (FECHADA) ────────────────────────────────────────────
  const prevIso = isoWeek(prevStart);
  const prevProgram = await prisma.weeklyProgram.create({
    data: {
      projectId,
      weekNumber: prevIso.week,
      year: prevIso.year,
      startDate: prevStart,
      endDate: addDays(prevStart, 6),
      meetingDate: addDays(prevStart, 7),
      status: WeeklyProgramStatus.FECHADA,
      publishedAt: prevStart,
      closedAt: addDays(prevStart, 7),
    },
  });

  const A = WeeklyActivityStatus;
  const O = WeeklyActivityOrigin;
  const prevActs = [] as Array<Awaited<ReturnType<typeof prisma.weeklyActivity.create>>>;
  const prevActData = [
    { local: 'Obra', torre: 'Torre A', pavimento: '5º Andar', activityName: 'Alvenaria — eixo 1 a 4', contractorId: alfa.id, responsible: 'João Pereira', status: A.CONCLUIDA, percentExecuted: 100, origin: O.CRONOGRAMA },
    { local: 'Obra', torre: 'Torre A', pavimento: '4º Andar', activityName: 'Contrapiso — aptos 401 a 404', contractorId: alfa.id, responsible: 'Maria Souza', status: A.CONCLUIDA, percentExecuted: 100, origin: O.CRONOGRAMA },
    { local: 'Obra', torre: 'Torre A', pavimento: '5º Andar', activityName: 'Reboco interno — aptos 501 e 502', contractorId: beta.id, responsible: 'João Pereira', status: A.EM_ANDAMENTO, percentExecuted: 60, origin: O.CRONOGRAMA },
    { local: 'Obra', torre: 'Torre A', pavimento: '3º Andar', activityName: 'Revestimento de piso — apto 501', contractorId: beta.id, responsible: 'Maria Souza', status: A.NAO_INICIADA, percentExecuted: 0, origin: O.CRONOGRAMA },
    { local: 'Obra', torre: 'Torre A', pavimento: '3º Andar', activityName: 'Revestimento de piso — apto 502', contractorId: beta.id, responsible: 'Maria Souza', status: A.NAO_INICIADA, percentExecuted: 0, origin: O.CRONOGRAMA },
    { local: 'Obra', torre: 'Torre A', pavimento: '2º Andar', activityName: 'Pintura de teto — aptos 201 a 204', contractorId: beta.id, responsible: 'João Pereira', status: A.CANCELADA, percentExecuted: 0, origin: O.CRONOGRAMA },
    { local: 'Área comum', torre: '', pavimento: 'Térreo', activityName: 'Regularização do hall de entrada', contractorId: hidro.id, responsible: 'Carlos Eduardo', status: A.CONCLUIDA, percentExecuted: 100, origin: O.MANUAL },
  ];
  for (let i = 0; i < prevActData.length; i++) {
    prevActs.push(await prisma.weeklyActivity.create({ data: { ...prevActData[i], programId: prevProgram.id, order: i } }));
  }

  const prevRestriction = await prisma.weeklyRestriction.create({
    data: {
      programId: prevProgram.id,
      typeId: typeId('Projeto'),
      description: 'Revisão do projeto elétrico — rev. 3',
      responsible: 'Projetista — eng. eletricista',
      dueDate: addDays(prevStart, 2),
      resolvedAt: addDays(prevStart, 3),
      status: WeeklyRestrictionStatus.RESOLVIDA,
      impactsProgram: false,
      activityLinks: { create: [{ activityId: prevActs[2].id }] },
    },
  });

  const contractorName = (id: string | null) =>
    id === alfa.id ? alfa.name : id === beta.id ? beta.name : id === hidro.id ? hidro.name : null;
  const prevIndicators = computeSeedIndicators(
    prevActData.map((a) => ({ status: a.status, contractorName: contractorName(a.contractorId), responsible: a.responsible })),
    [{ typeName: 'Projeto', status: WeeklyRestrictionStatus.RESOLVIDA }],
  );
  await prisma.weeklyProgram.update({ where: { id: prevProgram.id }, data: { indicators: prevIndicators } });

  const prevPayload = JSON.parse(JSON.stringify({
    program: { ...prevProgram, indicators: prevIndicators },
    activities: prevActs,
    restrictions: [prevRestriction],
  }));
  await prisma.weeklySnapshot.createMany({
    data: [
      { programId: prevProgram.id, kind: WeeklySnapshotKind.PUBLICACAO, payload: prevPayload, createdById: adminUserId, createdAt: prevStart },
      { programId: prevProgram.id, kind: WeeklySnapshotKind.FECHAMENTO, payload: prevPayload, createdById: adminUserId, createdAt: addDays(prevStart, 7) },
    ],
  });

  // ── Semana corrente (PUBLICADA) ──────────────────────────────────────────
  const curIso = isoWeek(currentStart);
  const curProgram = await prisma.weeklyProgram.create({
    data: {
      projectId,
      weekNumber: curIso.week,
      year: curIso.year,
      startDate: currentStart,
      endDate: addDays(currentStart, 6),
      meetingDate: addDays(currentStart, 7),
      status: WeeklyProgramStatus.PUBLICADA,
      publishedAt: currentStart,
    },
  });

  // Reprogramadas automáticas (vindas da semana fechada, não concluídas)
  const carryovers = [prevActs[2], prevActs[3], prevActs[4]];
  const curCarryActs = [] as Array<Awaited<ReturnType<typeof prisma.weeklyActivity.create>>>;
  for (let i = 0; i < carryovers.length; i++) {
    const src = carryovers[i];
    curCarryActs.push(await prisma.weeklyActivity.create({
      data: {
        programId: curProgram.id,
        origin: O.REPROGRAMADA,
        status: A.REPROGRAMADA,
        percentExecuted: 0,
        local: src.local, torre: src.torre, pavimento: src.pavimento,
        activityName: src.activityName,
        contractorId: src.contractorId, responsible: src.responsible,
        carryoverFromId: src.id,
        order: i,
      },
    }));
  }

  const curNewData = [
    { local: 'Obra', torre: 'Torre A', pavimento: '6º Andar', activityName: 'Alvenaria — eixo 1 a 4', contractorId: alfa.id, responsible: 'João Pereira', status: A.PROGRAMADA, percentExecuted: 0, origin: O.CRONOGRAMA },
    { local: 'Obra', torre: 'Torre A', pavimento: '5º Andar', activityName: 'Contrapiso — aptos 501 a 504', contractorId: alfa.id, responsible: 'Maria Souza', status: A.EM_ANDAMENTO, percentExecuted: 40, origin: O.CRONOGRAMA },
    { local: 'Obra', torre: 'Torre A', pavimento: '3º Andar', activityName: 'Instalação hidráulica — shafts', contractorId: hidro.id, responsible: 'Carlos Eduardo', status: A.PROGRAMADA, percentExecuted: 0, origin: O.CRONOGRAMA },
    { local: 'Área comum', torre: '', pavimento: 'Térreo', activityName: 'Limpeza de fachada', contractorId: hidro.id, responsible: 'Carlos Eduardo', status: A.CONCLUIDA, percentExecuted: 100, origin: O.MANUAL },
  ];
  const curNewActs = [] as Array<Awaited<ReturnType<typeof prisma.weeklyActivity.create>>>;
  for (let i = 0; i < curNewData.length; i++) {
    curNewActs.push(await prisma.weeklyActivity.create({
      data: { ...curNewData[i], programId: curProgram.id, order: carryovers.length + i },
    }));
  }

  await prisma.weeklyRestriction.create({
    data: {
      programId: curProgram.id,
      typeId: typeId('Material'),
      description: 'Falta de porcelanato 60×60',
      responsible: 'Suprimentos — R. Teixeira',
      dueDate: addDays(currentStart, 5),
      status: WeeklyRestrictionStatus.PENDENTE,
      impactsProgram: true,
      activityLinks: { create: [{ activityId: curCarryActs[1].id }, { activityId: curCarryActs[2].id }] },
    },
  });
  await prisma.weeklyRestriction.create({
    data: {
      programId: curProgram.id,
      typeId: typeId('Mão de Obra'),
      description: 'Equipe de reboco incompleta (2 oficiais)',
      responsible: 'Beta Acabamentos — encarregado',
      dueDate: addDays(currentStart, 3),
      status: WeeklyRestrictionStatus.PENDENTE,
      impactsProgram: false,
      activityLinks: { create: [{ activityId: curCarryActs[0].id }] },
    },
  });

  const curPayload = JSON.parse(JSON.stringify({
    program: curProgram,
    activities: [...curCarryActs, ...curNewActs],
    restrictions: [],
  }));
  await prisma.weeklySnapshot.create({
    data: { programId: curProgram.id, kind: WeeklySnapshotKind.PUBLICACAO, payload: curPayload, createdById: adminUserId, createdAt: currentStart },
  });

  console.log('Created weekly module: 3 contractors, 8 restriction types, 2 programs (1 fechada + 1 publicada).');
}

async function backfillWeeklyModule() {
  const programCount = await prisma.weeklyProgram.count();
  if (programCount > 0) return;
  const project = await prisma.project.findFirst();
  const admin = await prisma.user.findFirst({ where: { role: UserRole.ADMIN } });
  if (!project || !admin) return;
  console.log('Weekly module empty — backfilling contractors, restriction types and sample programs...');
  await seedWeeklyModule(project.id, project.weekStartDay ?? 1, admin.id);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
