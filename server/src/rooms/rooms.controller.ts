import { Controller, Post, Body, Get, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { Request } from 'express';
import { CreateRoomDto } from './dto/create-room.dto';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) { }

  // Crea una nueva sala y asigna al usuario creador como host
  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Req() req, @Body() createRoomDto: CreateRoomDto) {
    // req.user.id contiene el userId luego de pasar por JwtAuthGuard (validado en la BDD via Prisma)
    return this.roomsService.create(req.user.id, createRoomDto);
  }

  // Obtiene la lista de salas disponibles (opcionalmente expuesto, puede ser util para un lobby publico)
  @Get()
  async findAll() {
    return this.roomsService.findAll();
  }

  // Busca una sala especifica mediante su codigo unico (join code)
  @Get(':code')
  async findByCode(@Param('code') code: string) {
    return this.roomsService.findByCode(code);
  }

  // Agrega al usuario a la lista de participantes de la sala (hasta max 10)
  @UseGuards(JwtAuthGuard)
  @Post(':code/join')
  async join(@Param('code') code: string, @Req() req) {
    return this.roomsService.join(code, req.user.id);
  }

  // Permite al usuario/dueño cerrar y salir de la sala (cambia is_active = false)
  @UseGuards(JwtAuthGuard)
  @Post(':code/leave')
  async leave(@Param('code') code: string, @Req() req) {
    return this.roomsService.leave(code, req.user.id);
  }

  // Elimina la sala permanentemente. Solo el dueño de la sala puede hacerlo.
  @UseGuards(JwtAuthGuard)
  @Delete(':code')
  async delete(@Param('code') code: string, @Req() req) {
    return this.roomsService.delete(code, req.user.id);
  }
}
