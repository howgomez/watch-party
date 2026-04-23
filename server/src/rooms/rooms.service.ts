import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { Room, User } from '@prisma/client';

@Injectable()
export class RoomsService {
    constructor(private prisma: PrismaService) { }

    async create(userId: string, createRoomDto: CreateRoomDto): Promise<Room> {
        const code = this.generateRoomCode();
        const room = await this.prisma.room.create({
            data: {
                ...createRoomDto,
                code,
                host_id: userId,
            },
            include: {
                host: { select: { id: true, username: true } },
                _count: { select: { participants: true } },
            },
        });
        return room;
    }

    async findAll(): Promise<Room[]> {
        return this.prisma.room.findMany({
            include: {
                host: { select: { id: true, username: true } },
                _count: { select: { participants: true } },
            },
        });
    }

    async findByCode(code: string): Promise<any> {
        const room = await this.prisma.room.findUnique({
            where: { code },
            include: {
                host: { select: { id: true, username: true } },
                participants: {
                    include: {
                        user: { select: { id: true, username: true } }
                    }
                },
                queue: {
                    orderBy: { order: 'asc' }
                }
            },
        });
        if (!room) {
            throw new NotFoundException('Room not found');
        }
        return room;
    }

    // --- Gestión de la Cola (Queue) ---

    async addToQueue(roomId: string, videoData: any) {
        const lastItem = await this.prisma.playlistItem.findFirst({
            where: { room_id: roomId },
            orderBy: { order: 'desc' }
        });
        const order = lastItem ? lastItem.order + 1 : 0;

        return this.prisma.playlistItem.create({
            data: {
                room_id: roomId,
                url: videoData.url,
                title: videoData.title,
                thumbnail: videoData.thumbnail,
                duration: videoData.duration,
                added_by: videoData.addedBy,
                order,
            }
        });
    }

    async getQueue(roomId: string) {
        return this.prisma.playlistItem.findMany({
            where: { room_id: roomId },
            orderBy: { order: 'asc' }
        });
    }

    async removeFromQueue(itemId: string) {
        return this.prisma.playlistItem.delete({
            where: { id: itemId }
        });
    }

    async popNextFromQueue(roomId: string) {
        const nextItem = await this.prisma.playlistItem.findFirst({
            where: { room_id: roomId },
            orderBy: { order: 'asc' }
        });

        if (!nextItem) return null;

        await this.prisma.playlistItem.delete({
            where: { id: nextItem.id }
        });

        return nextItem;
    }

    // Une a un usuario a una sala existente (max 10 personas)
    async join(code: string, userId: string): Promise<Room> {
        const room = await this.findByCode(code);

        // Verifica si el usuario ya es participe preventivamente
        const isParticipant = await this.prisma.roomParticipant.findFirst({
            where: {
                room_id: room.id,
                user_id: userId,
            },
        });

        if (isParticipant) {
            return room;
        }

        // Verifica la capacidad de la sala
        const participantCount = await this.prisma.roomParticipant.count({
            where: { room_id: room.id },
        });

        if (participantCount >= 10) {
            throw new ForbiddenException('La sala está llena');
        }

        // Agrega el vinculo en la DB
        await this.prisma.roomParticipant.create({
            data: {
                room_id: room.id,
                user_id: userId,
            },
        });

        return this.findByCode(code);
    }

    // Gestiona la salida de un usuario. Si es host, cierra (inactiva) la room entera.
    // Si es un participante normal, simplemente se retira.
    async leave(code: string, userId: string): Promise<Room> {
        const room = await this.findByCode(code);
        
        if (room.host_id === userId) {
            // El host abandona: se cierra/desactiva la sala
            return this.prisma.room.update({
                where: { id: room.id },
                data: { is_active: false },
            });
        } else {
            // Participante normal abandona: eliminamos su participacion
            try {
                await this.prisma.roomParticipant.delete({
                    where: { room_id_user_id: { room_id: room.id, user_id: userId } }
                });
            } catch (err) {
                // Ignorar error si no formaba parte de la sala
            }
            return room;
        }
    }

    // Eliminacion de emergencia de una sala y sus dependencias (Solo dueño)
    async delete(code: string, userId: string): Promise<void> {
        const room = await this.findByCode(code);

        if (room.host_id !== userId) {
            throw new ForbiddenException('Solo el creador puede eliminar la sala');
        }

        // Eliminamos la sala y Prisma se encarga en cascada (si configuraste OnDelete: Cascade)
        // O si no, borramos las dependencias manuales
        await this.prisma.roomParticipant.deleteMany({ where: { room_id: room.id } });
        await this.prisma.message.deleteMany({ where: { room_id: room.id } });
        
        await this.prisma.room.delete({
            where: { id: room.id },
        });
    }

    // Funcion helper para generar un codigo aleatorio en letras MAYUSCULAS/Numeros
    private generateRoomCode(): string {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }
}
