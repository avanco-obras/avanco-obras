"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const auth_service_1 = require("./auth.service");
const prisma_service_1 = require("../common/prisma.service");
jest.mock('bcryptjs', () => ({
    hash: jest.fn().mockResolvedValue('hashed_pw'),
    compare: jest.fn(),
}));
const bcrypt = require("bcryptjs");
describe('AuthService', () => {
    let service;
    let prisma;
    let jwtService;
    let configService;
    beforeEach(async () => {
        prisma = {
            user: {
                findFirst: jest.fn(),
                findUnique: jest.fn(),
                create: jest.fn(),
            },
        };
        jwtService = { sign: jest.fn().mockReturnValue('test-token') };
        configService = {
            get: jest.fn().mockImplementation((key) => {
                if (key === 'jwt.secret')
                    return 'test-secret';
                if (key === 'jwt.expiresIn')
                    return '7d';
                return undefined;
            }),
        };
        const module = await testing_1.Test.createTestingModule({
            providers: [
                auth_service_1.AuthService,
                { provide: prisma_service_1.PrismaService, useValue: prisma },
                { provide: jwt_1.JwtService, useValue: jwtService },
                { provide: config_1.ConfigService, useValue: configService },
            ],
        }).compile();
        service = module.get(auth_service_1.AuthService);
    });
    afterEach(() => {
        jest.clearAllMocks();
    });
    describe('register', () => {
        const registerDto = {
            email: 'carlos@horizonte.com.br',
            username: 'carlos',
            fullName: 'Carlos Engenheiro',
            password: 'admin123',
        };
        it('should throw ConflictException when email already exists', async () => {
            prisma.user.findFirst.mockResolvedValue({
                id: 'existing-id',
                email: registerDto.email,
                username: 'other-username',
            });
            await expect(service.register(registerDto)).rejects.toThrow(new common_1.ConflictException('Email já cadastrado'));
            expect(prisma.user.findFirst).toHaveBeenCalledTimes(1);
            expect(prisma.user.create).not.toHaveBeenCalled();
        });
        it('should throw ConflictException when username already exists', async () => {
            prisma.user.findFirst.mockResolvedValue({
                id: 'existing-id',
                email: 'other@email.com',
                username: registerDto.username,
            });
            await expect(service.register(registerDto)).rejects.toThrow(new common_1.ConflictException('Username já em uso'));
            expect(prisma.user.create).not.toHaveBeenCalled();
        });
        it('should create user and return accessToken on success', async () => {
            const createdUser = {
                id: 'new-user-id',
                email: registerDto.email,
                username: registerDto.username,
                fullName: registerDto.fullName,
                role: 'VIEWER',
                phone: null,
                crea: null,
                avatarUrl: null,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            prisma.user.findFirst.mockResolvedValue(null);
            prisma.user.create.mockResolvedValue(createdUser);
            jwtService.sign.mockReturnValue('test-token');
            const result = await service.register(registerDto);
            expect(prisma.user.findFirst).toHaveBeenCalledTimes(1);
            expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 12);
            expect(prisma.user.create).toHaveBeenCalledTimes(1);
            expect(result).toEqual({ user: createdUser, accessToken: 'test-token' });
            expect(jwtService.sign).toHaveBeenCalledWith({ sub: createdUser.id, email: createdUser.email, role: createdUser.role }, { secret: 'test-secret', expiresIn: '7d' });
        });
    });
    describe('login', () => {
        const loginDto = { email: 'carlos@horizonte.com.br', password: 'admin123' };
        it('should throw UnauthorizedException when user not found', async () => {
            prisma.user.findUnique.mockResolvedValue(null);
            await expect(service.login(loginDto)).rejects.toThrow(new common_1.UnauthorizedException('Email ou senha inválidos'));
        });
        it('should throw UnauthorizedException when user is inactive', async () => {
            prisma.user.findUnique.mockResolvedValue({
                id: 'user-id',
                email: loginDto.email,
                isActive: false,
                passwordHash: 'hashed_pw',
                role: 'VIEWER',
            });
            await expect(service.login(loginDto)).rejects.toThrow(new common_1.UnauthorizedException('Email ou senha inválidos'));
        });
        it('should throw UnauthorizedException when password is wrong', async () => {
            prisma.user.findUnique.mockResolvedValue({
                id: 'user-id',
                email: loginDto.email,
                isActive: true,
                passwordHash: 'hashed_pw',
                role: 'VIEWER',
            });
            bcrypt.compare.mockResolvedValue(false);
            await expect(service.login(loginDto)).rejects.toThrow(new common_1.UnauthorizedException('Email ou senha inválidos'));
        });
        it('should return user (without passwordHash) and accessToken on valid credentials', async () => {
            const dbUser = {
                id: 'user-id',
                email: loginDto.email,
                username: 'carlos',
                fullName: 'Carlos Engenheiro',
                role: 'VIEWER',
                phone: null,
                crea: null,
                avatarUrl: null,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
                passwordHash: 'hashed_pw',
            };
            prisma.user.findUnique.mockResolvedValue(dbUser);
            bcrypt.compare.mockResolvedValue(true);
            jwtService.sign.mockReturnValue('test-token');
            const result = await service.login(loginDto);
            expect(result.accessToken).toBe('test-token');
            expect(result.user).not.toHaveProperty('passwordHash');
            expect(result.user.email).toBe(loginDto.email);
        });
    });
    describe('getMe', () => {
        it('should throw UnauthorizedException when user not found', async () => {
            prisma.user.findUnique.mockResolvedValue(null);
            await expect(service.getMe('nonexistent-id')).rejects.toThrow(new common_1.UnauthorizedException('Usuário não encontrado'));
        });
        it('should return user when found', async () => {
            const user = {
                id: 'user-id',
                email: 'carlos@horizonte.com.br',
                username: 'carlos',
                fullName: 'Carlos Engenheiro',
                role: 'VIEWER',
                phone: null,
                crea: null,
                avatarUrl: null,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            prisma.user.findUnique.mockResolvedValue(user);
            const result = await service.getMe('user-id');
            expect(result).toEqual(user);
            expect(prisma.user.findUnique).toHaveBeenCalledWith({
                where: { id: 'user-id' },
                select: expect.objectContaining({ id: true, email: true }),
            });
        });
    });
});
//# sourceMappingURL=auth.service.spec.js.map