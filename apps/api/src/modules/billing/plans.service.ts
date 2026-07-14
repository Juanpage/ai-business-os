import { Injectable, NotFoundException } from '@nestjs/common';
import { Plan } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Los planes son globales de la plataforma (no pertenecen a ningun tenant) y
 * aqui son de SOLO LECTURA: los define la plataforma (seed / panel admin).
 */
@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllActive(): Promise<Plan[]> {
    return this.prisma.plan.findMany({
      where: { status: 'active', deletedAt: null },
      orderBy: { price: 'asc' },
    });
  }

  async findOne(id: string): Promise<Plan> {
    const plan = await this.prisma.plan.findFirst({
      where: { id, deletedAt: null },
    });

    if (!plan) {
      throw new NotFoundException('Plan no encontrado.');
    }

    return plan;
  }
}
