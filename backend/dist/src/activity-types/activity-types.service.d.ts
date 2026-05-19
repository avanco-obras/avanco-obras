import { PrismaService } from '../common/prisma.service';
import { CreateActivityTypeDto } from './dto/create-activity-type.dto';
import { UpdateActivityTypeDto } from './dto/update-activity-type.dto';
export declare class ActivityTypesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findAll(projectId: string): Promise<{
        id: string;
        name: string;
        projectId: string;
        measurementMethod: import(".prisma/client").$Enums.MeasurementMethod;
        unit: string;
        defaultQuantity: import("@prisma/client/runtime/library").Decimal;
        weight: import("@prisma/client/runtime/library").Decimal;
        order: number;
    }[]>;
    create(projectId: string, dto: CreateActivityTypeDto): Promise<{
        id: string;
        name: string;
        projectId: string;
        measurementMethod: import(".prisma/client").$Enums.MeasurementMethod;
        unit: string;
        defaultQuantity: import("@prisma/client/runtime/library").Decimal;
        weight: import("@prisma/client/runtime/library").Decimal;
        order: number;
    }>;
    update(id: string, dto: UpdateActivityTypeDto): Promise<{
        id: string;
        name: string;
        projectId: string;
        measurementMethod: import(".prisma/client").$Enums.MeasurementMethod;
        unit: string;
        defaultQuantity: import("@prisma/client/runtime/library").Decimal;
        weight: import("@prisma/client/runtime/library").Decimal;
        order: number;
    }>;
    remove(id: string): Promise<{
        message: string;
    }>;
}
