import { Controller, Get, Post, Body, Param, Delete, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { RoundsService } from './rounds.service';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';
import { put } from '@vercel/blob';

@Controller('api/rounds')
export class RoundsController {
  constructor(private readonly roundsService: RoundsService) {}

  @Get()
  findAll() {
    return this.roundsService.getAllRounds();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.roundsService.getRound(+id);
  }

  @Post()
  createRound(@Body('title') title: string) {
    return this.roundsService.createRound(title);
  }

  @Delete(':id')
  removeRound(@Param('id') id: string) {
    return this.roundsService.deleteRound(+id);
  }

  @Post(':id/questions')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'image', maxCount: 1 },
        { name: 'mask', maxCount: 1 },
      ],
      {
        // We only use disk storage if NOT using Vercel Blob
        storage: process.env.BLOB_READ_WRITE_TOKEN 
          ? undefined 
          : diskStorage({
              destination: join(__dirname, '..', '..', 'uploads'),
              filename: (req, file, cb) => {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
                cb(null, file.fieldname + '-' + uniqueSuffix + extname(file.originalname));
              },
            }),
      },
    ),
  )
  async addQuestion(
    @Param('id') roundId: string,
    @UploadedFiles() files: { image?: Express.Multer.File[]; mask?: Express.Multer.File[] },
    @Body('description') description: string,
  ) {
    const imageFile = files.image?.[0];
    const maskFile = files.mask?.[0];

    if (!imageFile || !maskFile) {
      throw new Error('Image and mask files are required');
    }

    let imageUrl = '';
    let maskUrl = '';

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      // Upload to Vercel Blob
      const imgBlob = await put(`images/${Date.now()}-${imageFile.originalname}`, imageFile.buffer, { access: 'public' });
      const maskBlob = await put(`masks/${Date.now()}-${maskFile.originalname}`, maskFile.buffer, { access: 'public' });
      imageUrl = imgBlob.url;
      maskUrl = maskBlob.url;
    } else {
      // Local disk fallback
      imageUrl = `/uploads/${imageFile.filename}`;
      maskUrl = `/uploads/${maskFile.filename}`;
    }

    return this.roundsService.addQuestionToRound(
      +roundId, 
      description, 
      imageUrl, 
      maskUrl, 
      imageFile.buffer || imageFile.path, 
      maskFile.buffer || maskFile.path
    );
  }
}
