import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
export declare class AuthService {
    private prisma;
    private jwtService;
    private configService;
    constructor(prisma: PrismaService, jwtService: JwtService, configService: ConfigService);
    register(dto: RegisterDto): Promise<{
        user: {
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
        };
        accessToken: string;
    }>;
    login(dto: LoginDto): Promise<{
        user: {
            id: string;
            email: string;
            username: string;
            fullName: string;
            role: import(".prisma/client").$Enums.UserRole;
            phone: string | null;
            crea: string | null;
            avatarUrl: string | null;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
        };
        accessToken: string;
    }>;
    getMe(userId: string): Promise<{
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
    private generateAccessToken;
}
