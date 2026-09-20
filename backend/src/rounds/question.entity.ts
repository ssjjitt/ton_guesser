import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { Round } from './round.entity';

@Entity()
export class Question {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  description: string;

  @Column()
  imageUrl: string;

  @Column()
  maskUrl: string;

  @Column()
  trueColor: string;

  @ManyToOne(() => Round, round => round.questions, { onDelete: 'CASCADE' })
  round: Round;
}
