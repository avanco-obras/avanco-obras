import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaService } from '../common/prisma.service';

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed_pw'),
  compare: jest.fn(),
}));

import * as bcrypt from 'bcryptjs';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
    };
  };
  let jwtService: { sign: jest.Mock };
  let configService: { get: jest.Mock };

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
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'jwt.secret') return 'test-secret';
        if (key === 'jwt.expiresIn') return '7d';
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // register
  // ---------------------------------------------------------------------------
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

      await expect(service.register(registerDto as any)).rejects.toThrow(
        new ConflictException('Email já cadastrado'),
      );
      expect(prisma.user.findFirst).toHaveBeenCalledTimes(1);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when username already exists', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'existing-id',
        email: 'other@email.com',
        username: registerDto.username,
      });

      await expect(service.register(registerDto as any)).rejects.toThrow(
        new ConflictException('Username já em uso'),
      );
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

      const result = await service.register(registerDto as any);

      expect(prisma.user.findFirst).toHaveBeenCalledTimes(1);
      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 12);
      expect(prisma.user.create).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ user: createdUser, accessToken: 'test-token' });
      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: createdUser.id, email: createdUser.email, role: createdUser.role },
        { secret: 'test-secret', expiresIn: '7d' },
      );
    });
  });

  // ---------------------------------------------------------------------------
  // login
  // ---------------------------------------------------------------------------
  describe('login', () => {
    const loginDto = { email: 'carlos@horizonte.com.br', password: 'admin123' };

    it('should throw UnauthorizedException when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        new UnauthorizedException('Email ou senha inválidos'),
      );
    });

    it('should throw UnauthorizedException when user is inactive', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-id',
        email: loginDto.email,
        isActive: false,
        passwordHash: 'hashed_pw',
        role: 'VIEWER',
      });

      await expect(service.login(loginDto)).rejects.toThrow(
        new UnauthorizedException('Email ou senha inválidos'),
      );
    });

    it('should throw UnauthorizedException when password is wrong', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-id',
        email: loginDto.email,
        isActive: true,
        passwordHash: 'hashed_pw',
        role: 'VIEWER',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        new UnauthorizedException('Email ou senha inválidos'),
      );
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
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      jwtService.sign.mockReturnValue('test-token');

      const result = await service.login(loginDto);

      expect(result.accessToken).toBe('test-token');
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.user.email).toBe(loginDto.email);
    });
  });

  // ---------------------------------------------------------------------------
  // getMe
  // ---------------------------------------------------------------------------
  describe('getMe', () => {
    it('should throw UnauthorizedException when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getMe('nonexistent-id')).rejects.toThrow(
        new UnauthorizedException('Usuário não encontrado'),
      );
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
