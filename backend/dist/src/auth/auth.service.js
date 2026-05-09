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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const bcrypt = require("bcryptjs");
const prisma_service_1 = require("../common/prisma.service");
let AuthService = class AuthService {
    constructor(prisma, jwtService, configService) {
        this.prisma = prisma;
        this.jwtService = jwtService;
        this.configService = configService;
    }
    async register(dto) {
        const existing = await this.prisma.user.findFirst({
            where: { OR: [{ email: dto.email }, { username: dto.username }] },
        });
        if (existing) {
            if (existing.email === dto.email) {
                throw new common_1.ConflictException('Email já cadastrado');
            }
            throw new common_1.ConflictException('Username já em uso');
        }
        const passwordHash = await bcrypt.hash(dto.password, 12);
        const user = await this.prisma.user.create({
            data: {
                email: dto.email,
                username: dto.username,
                fullName: dto.fullName,
                passwordHash,
                role: dto.role || 'VIEWER',
                phone: dto.phone,
                crea: dto.crea,
            },
            select: {
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
            },
        });
        const accessToken = this.generateAccessToken(user.id, user.email, user.role);
        return { user, accessToken };
    }
    async login(dto) {
        const user = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });
        if (!user || !user.isActive) {
            throw new common_1.UnauthorizedException('Email ou senha inválidos');
        }
        const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
        if (!isPasswordValid) {
            throw new common_1.UnauthorizedException('Email ou senha inválidos');
        }
        const { passwordHash: _, ...safeUser } = user;
        const accessToken = this.generateAccessToken(user.id, user.email, user.role);
        return { user: safeUser, accessToken };
    }
    async getMe(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
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
            },
        });
        if (!user)
            throw new common_1.UnauthorizedException('Usuário não encontrado');
        return user;
    }
    generateAccessToken(userId, email, role) {
        return this.jwtService.sign({ sub: userId, email, role }, {
            secret: this.configService.get('jwt.secret'),
            expiresIn: this.configService.get('jwt.expiresIn') || '7d',
        });
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        config_1.ConfigService])
], AuthService);
//# sourceMappingURL=auth.service.js.map