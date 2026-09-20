import { NestFactory } from '@nestjs/common';
import { AppModule } from '../backend/src/app.module';

let app;

export default async function handler(req, res) {
  if (!app) {
    app = await NestFactory.create(AppModule);
    app.setGlobalPrefix('api');
    await app.init();
  }
  
  const instance = app.getHttpAdapter().getInstance();
  return instance(req, res);
}
