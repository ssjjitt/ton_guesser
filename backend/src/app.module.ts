import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RoundsModule } from './rounds/rounds.module';
import { Round } from './rounds/round.entity';
import { Question } from './rounds/question.entity';
import { ConfigModule } from '@nestjs/config';

const isVercel = process.env.VERCEL === '1' || process.env.POSTGRES_URL;

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        if (process.env.POSTGRES_URL) {
          return {
            type: 'postgres',
            url: process.env.POSTGRES_URL.replace('?sslmode=require', ''),
            entities: [Round, Question],
            synchronize: true,
            ssl: {
              rejectUnauthorized: false,
            },
          };
        }
        return {
          type: 'better-sqlite3',
          database: 'dev.db',
          entities: [Round, Question],
          synchronize: true,
        };
      },
    }),
    ServeStaticModule.forRoot(
      {
        rootPath: join(__dirname, '..', 'uploads'),
        serveRoot: '/uploads',
      },
      {
        rootPath: join(__dirname, '..', '..', 'frontend', 'dist'),
        exclude: ['/api/(.*)', '/uploads/(.*)'],
      }
    ),
    RoundsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
