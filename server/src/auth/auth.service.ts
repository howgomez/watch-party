import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwtService: JwtService) { }

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email }
    });
    if (existingUser) {
      throw new ConflictException('User already exists');
    }
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: { ...dto, password: hashedPassword }
    })

    const { password, ...result } = user;

    return { user: result, token: this.generateToken(user) };

  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) throw new UnauthorizedException('Credenciales inválidas');

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Credenciales inválidas');

    const { password, ...result } = user;
    return { user: result, token: this.generateToken(user) };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }
    const { password, ...result } = user;
    return result;
  }

  private generateToken(user: { id: string; email: string }) {
    return this.jwtService.sign({ sub: user.id, email: user.email });
  }

}
