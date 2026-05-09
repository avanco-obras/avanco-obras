import { UserRole } from '@prisma/client';
export declare class RegisterDto {
    email: string;
    username: string;
    fullName: string;
    password: string;
    role?: UserRole;
    phone?: string;
    crea?: string;
}
