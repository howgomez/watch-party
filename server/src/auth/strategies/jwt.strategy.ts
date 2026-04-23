import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        private configService: ConfigService,
        private prisma: PrismaService,
    ) {
        const jwtSecret = configService.get('JWT_SECRET');
        if (!jwtSecret) {
            throw new Error('JWT_SECRET must be defined');
        }

        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            secretOrKey: jwtSecret,
        });
    }
    async validate(payload: { sub: string; email: string }) {
        const user = await this.prisma.user.findUnique({
            where: { id: payload.sub }
        })
        if (!user) {
            throw new UnauthorizedException();
        }
        const { password, ...result } = user;
        return result;
    }
}