import { UserRole } from '@prisma/client';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
interface AuthUser {
    id: string;
    email: string;
    username: string;
    fullName: string;
    role: UserRole;
    isActive: boolean;
}
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    findAll(): Promise<{
        id: string;
        email: string;
        username: string;
        fullName: string;
        role: import(".prisma/client").$Enums.UserRole;
        phone: string;
        crea: string;
        avatarUrl: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    update(id: string, dto: UpdateUserDto, currentUser: AuthUser): Promise<{
        id: string;
        email: string;
        username: string;
        fullName: string;
        role: import(".prisma/client").$Enums.UserRole;
        phone: string;
        crea: string;
        avatarUrl: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    changePassword(id: string, dto: ChangePasswordDto, currentUser: AuthUser): Promise<{
        message: string;
    }>;
}
export {};
