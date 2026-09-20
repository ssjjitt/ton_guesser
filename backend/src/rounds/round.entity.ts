import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, OneToMany } from 'typeorm';
import { Question } from './question.entity';

@Entity()
export class Round {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @OneToMany(() => Question, question => question.round, { cascade: true, eager: true })
  questions: Question[];

  @CreateDateColumn()
  createdAt: Date;
}
