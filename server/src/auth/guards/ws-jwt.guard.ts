import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { WsException } from '@nestjs/websockets';

// Este guard protege nuestros web-sockets para asegurar
// que el usuario esta autenticado con JWT
@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient();
    const token = this.extraerToken(client);

    if (!token) {
      throw new WsException('Token de autenticación no provisto');
    }

    try {
      // Verificamos y extraemos los datos del usuario (el payload del JWT)
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get('JWT_SECRET'),
      });
      // Guardamos la info del usuario en la conexion para usarla en eventos (ej: client.user.sub)
      client.user = payload;
    } catch {
      throw new WsException('Token inválido');
    }

    return true;
  }

  // Busca el token en los headers de conexion inicial o en auth.token
  private extraerToken(client: any): string | undefined {
    const authHeader = client.handshake.headers['authorization'];
    if (authHeader && authHeader.split(' ')[0] === 'Bearer') {
      return authHeader.split(' ')[1];
    }
    
    const authToken = client.handshake.auth.token;
    if (authToken) {
        return authToken;
    }
    
    return undefined;
  }
}
