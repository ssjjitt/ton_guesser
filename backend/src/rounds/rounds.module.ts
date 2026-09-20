import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoundsController } from './rounds.controller';
import { RoundsService } from './rounds.service';
import { Round } from './round.entity';
import { Question } from './question.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Round, Question])],
  controllers: [RoundsController],
  providers: [RoundsService],
})
export class RoundsModule {}
