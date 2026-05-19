"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const bcrypt = require("bcryptjs");
const prisma_service_1 = require("../common/prisma.service");
const USER_SAFE_SELECT = {
    id: true,
    email: true,
    username: true,
    fullName: true,
    role: true,
    phone: true,
    crea: true,
    avatarUrl: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
};
let UsersService = class UsersService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll() {
        return this.prisma.user.findMany({
            select: USER_SAFE_SELECT,
            orderBy: { fullName: 'asc' },
        });
    }
    async findOne(id) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            select: USER_SAFE_SELECT,
        });
        if (!user) {
            throw new common_1.NotFoundException(`Usuário com ID "${id}" não encontrado`);
        }
        return user;
    }
    async update(id, dto) {
        await this.findOne(id);
        if (dto.email || dto.username) {
            const conflictConditions = [];
            if (dto.email)
                conflictConditions.push({ email: dto.email });
            if (dto.username)
                conflictConditions.push({ username: dto.username });
            const existing = await this.prisma.user.findFirst({
                where: {
                    OR: conflictConditions,
                    NOT: { id },
                },
            });
            if (existing) {
                if (dto.email && existing.email === dto.email) {
                    throw new common_1.ConflictException('Email já cadastrado por outro usuário');
                }
                throw new common_1.ConflictException('Username já em uso por outro usuário');
            }
        }
        return this.prisma.user.update({
            where: { id },
            data: {
                ...(dto.email !== undefined && { email: dto.email }),
                ...(dto.username !== undefined && { username: dto.username }),
                ...(dto.fullName !== undefined && { fullName: dto.fullName }),
                ...(dto.phone !== undefined && { phone: dto.phone }),
                ...(dto.crea !== undefined && { crea: dto.crea }),
                ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
            },
            select: USER_SAFE_SELECT,
        });
    }
    async changePassword(id, dto) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            select: { id: true, passwordHash: true },
        });
        if (!user) {
            throw new common_1.NotFoundException(`Usuário com ID "${id}" não encontrado`);
        }
        const isCurrentValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
        if (!isCurrentValid) {
            throw new common_1.UnauthorizedException('Senha atual incorreta');
        }
        const newHash = await bcrypt.hash(dto.newPassword, 12);
        await this.prisma.user.update({
            where: { id },
            data: { passwordHash: newHash },
        });
        return { message: 'Senha alterada com sucesso' };
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], UsersService);
//# sourceMappingURL=users.service.js.map