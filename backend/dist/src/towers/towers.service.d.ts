import { PrismaService } from '../common/prisma.service';
import { CreateTowerDto } from './dto/create-tower.dto';
import { CreateFloorDto } from './dto/create-floor.dto';
import { CreateUnitDto } from './dto/create-unit.dto';
export declare class TowersService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    listTowers(projectId: string): Promise<({
        _count: {
            floors: number;
        };
    } & {
        id: string;
        name: string;
        projectId: string;
        order: number;
    })[]>;
    createTower(projectId: string, dto: CreateTowerDto): Promise<{
        _count: {
            floors: number;
        };
    } & {
        id: string;
        name: string;
        projectId: string;
        order: number;
    }>;
    listFloors(towerId: string): Promise<({
        _count: {
            units: number;
        };
    } & {
        id: string;
        name: string;
        order: number;
        level: number;
        towerId: string;
    })[]>;
    createFloor(towerId: string, dto: CreateFloorDto): Promise<{
        _count: {
            units: number;
        };
    } & {
        id: string;
        name: string;
        order: number;
        level: number;
        towerId: string;
    }>;
    listUnits(floorId: string): Promise<{
        id: string;
        name: string;
        order: number;
        area: import("@prisma/client/runtime/library").Decimal | null;
        floorId: string;
    }[]>;
    createUnit(floorId: string, dto: CreateUnitDto): Promise<{
        id: string;
        name: string;
        order: number;
        area: import("@prisma/client/runtime/library").Decimal | null;
        floorId: string;
    }>;
}
