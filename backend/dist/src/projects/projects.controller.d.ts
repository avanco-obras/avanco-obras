import { UserRole } from '@prisma/client';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddMemberDto } from './dto/add-member.dto';
interface AuthUser {
    id: string;
    email: string;
    username: string;
    fullName: string;
    role: UserRole;
    isActive: boolean;
}
export declare class ProjectsController {
    private readonly projectsService;
    constructor(projectsService: ProjectsService);
    findAll(currentUser: AuthUser): Promise<({
        members: ({
            user: {
                id: string;
                email: string;
                fullName: string;
                role: import(".prisma/client").$Enums.UserRole;
                avatarUrl: string;
            };
        } & {
            id: string;
            role: import(".prisma/client").$Enums.UserRole;
            addedAt: Date;
            projectId: string;
            userId: string;
        })[];
        _count: {
            members: number;
            towers: number;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        company: string;
        address: string;
        status: import(".prisma/client").$Enums.ProjectStatus;
        startDate: Date;
        endDate: Date;
        estimatedCost: import("@prisma/client/runtime/library").Decimal | null;
        currency: string;
        totalArea: import("@prisma/client/runtime/library").Decimal | null;
        workdaysPerWeek: number;
        hoursPerDay: number;
        timezone: string;
        progressCriteria: string;
    })[]>;
    create(dto: CreateProjectDto, currentUser: AuthUser): Promise<{
        members: ({
            user: {
                id: string;
                email: string;
                fullName: string;
                role: import(".prisma/client").$Enums.UserRole;
                avatarUrl: string;
            };
        } & {
            id: string;
            role: import(".prisma/client").$Enums.UserRole;
            addedAt: Date;
            projectId: string;
            userId: string;
        })[];
        _count: {
            members: number;
            towers: number;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        company: string;
        address: string;
        status: import(".prisma/client").$Enums.ProjectStatus;
        startDate: Date;
        endDate: Date;
        estimatedCost: import("@prisma/client/runtime/library").Decimal | null;
        currency: string;
        totalArea: import("@prisma/client/runtime/library").Decimal | null;
        workdaysPerWeek: number;
        hoursPerDay: number;
        timezone: string;
        progressCriteria: string;
    }>;
    findOne(id: string, currentUser: AuthUser): Promise<{
        members: ({
            user: {
                id: string;
                email: string;
                fullName: string;
                role: import(".prisma/client").$Enums.UserRole;
                phone: string;
                crea: string;
                avatarUrl: string;
            };
        } & {
            id: string;
            role: import(".prisma/client").$Enums.UserRole;
            addedAt: Date;
            projectId: string;
            userId: string;
        })[];
        towers: ({
            _count: {
                floors: number;
            };
        } & {
            id: string;
            name: string;
            projectId: string;
            order: number;
        })[];
        scheduleItems: {
            id: string;
            name: string;
            startDate: Date;
            endDate: Date;
            code: string;
            plannedProgress: import("@prisma/client/runtime/library").Decimal;
            actualProgress: import("@prisma/client/runtime/library").Decimal;
            isCriticalPath: boolean;
        }[];
        _count: {
            members: number;
            towers: number;
            scheduleItems: number;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        company: string;
        address: string;
        status: import(".prisma/client").$Enums.ProjectStatus;
        startDate: Date;
        endDate: Date;
        estimatedCost: import("@prisma/client/runtime/library").Decimal | null;
        currency: string;
        totalArea: import("@prisma/client/runtime/library").Decimal | null;
        workdaysPerWeek: number;
        hoursPerDay: number;
        timezone: string;
        progressCriteria: string;
    }>;
    update(id: string, dto: UpdateProjectDto, currentUser: AuthUser): Promise<{
        members: ({
            user: {
                id: string;
                email: string;
                fullName: string;
                role: import(".prisma/client").$Enums.UserRole;
                avatarUrl: string;
            };
        } & {
            id: string;
            role: import(".prisma/client").$Enums.UserRole;
            addedAt: Date;
            projectId: string;
            userId: string;
        })[];
        _count: {
            members: number;
            towers: number;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        company: string;
        address: string;
        status: import(".prisma/client").$Enums.ProjectStatus;
        startDate: Date;
        endDate: Date;
        estimatedCost: import("@prisma/client/runtime/library").Decimal | null;
        currency: string;
        totalArea: import("@prisma/client/runtime/library").Decimal | null;
        workdaysPerWeek: number;
        hoursPerDay: number;
        timezone: string;
        progressCriteria: string;
    }>;
    remove(id: string, currentUser: AuthUser): Promise<{
        message: string;
    }>;
    addMember(id: string, dto: AddMemberDto, currentUser: AuthUser): Promise<{
        user: {
            id: string;
            email: string;
            fullName: string;
            role: import(".prisma/client").$Enums.UserRole;
            avatarUrl: string;
        };
    } & {
        id: string;
        role: import(".prisma/client").$Enums.UserRole;
        addedAt: Date;
        projectId: string;
        userId: string;
    }>;
}
export {};
