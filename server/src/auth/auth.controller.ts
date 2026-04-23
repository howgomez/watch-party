import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  // Endpoint para registrar un nuevo usuario
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }
  
  // Endpoint para hacer login y obtener el token JWT
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // Endpoint protegido para obtener los datos del usuario logueado
  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@Request() req) {
    // req.user viene del payload de jwt.strategy.ts -> { sub: id, email: email }
    return this.authService.getMe(req.user.sub || req.user.id);
  }
}
