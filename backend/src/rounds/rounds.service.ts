import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Round } from './round.entity';
import { Question } from './question.entity';
import sharp from 'sharp';

@Injectable()
export class RoundsService {
  constructor(
    @InjectRepository(Round)
    private roundRepository: Repository<Round>,
    @InjectRepository(Question)
    private questionRepository: Repository<Question>,
  ) {}

  async createRound(title: string) {
    const round = this.roundRepository.create({ title });
    return this.roundRepository.save(round);
  }

  async getAllRounds() {
    return this.roundRepository.find({
      order: { createdAt: 'DESC' }
    });
  }

  async getRound(id: number) {
    const round = await this.roundRepository.findOne({ where: { id } });
    if (!round) throw new NotFoundException('Round not found');
    return round;
  }

  async deleteRound(id: number) {
    await this.roundRepository.delete(id);
  }

  async updateRound(id: number, title: string) {
    const round = await this.getRound(id);
    round.title = title;
    return this.roundRepository.save(round);
  }

  async deleteQuestion(questionId: number) {
    await this.questionRepository.delete(questionId);
  }

  async addQuestionToRound(roundId: number, description: string, imagePath: string, maskPath: string, imageSource?: Buffer | string, maskSource?: Buffer | string) {
    const round = await this.getRound(roundId);
    const trueColor = await this.calculateAverageColor(imageSource || imagePath, maskSource || maskPath);

    const question = this.questionRepository.create({
      description,
      imageUrl: imagePath.startsWith('http') ? imagePath : `/${imagePath.replace(/\\/g, '/')}`,
      maskUrl: maskPath.startsWith('http') ? maskPath : `/${maskPath.replace(/\\/g, '/')}`,
      trueColor,
      round,
    });

    return this.questionRepository.save(question);
  }

  private async calculateAverageColor(imageSource: Buffer | string, maskSource: Buffer | string): Promise<string> {
    const image = typeof imageSource === 'string' ? sharp(imageSource.replace(/^\//, '')) : sharp(imageSource);
    const mask = typeof maskSource === 'string' ? sharp(maskSource.replace(/^\//, '')) : sharp(maskSource);

    const { data: imgData, info: imgInfo } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { data: maskData } = await mask.resize(imgInfo.width, imgInfo.height).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

    let rSum = 0, gSum = 0, bSum = 0, count = 0;

    for (let i = 0; i < imgData.length; i += 4) {
      const maskAlpha = maskData[i + 3];
      if (maskAlpha > 128) {
        rSum += imgData[i];
        gSum += imgData[i + 1];
        bSum += imgData[i + 2];
        count++;
      }
    }

    if (count === 0) {
      return 'rgb(128, 128, 128)';
    }

    const r = Math.round(rSum / count);
    const g = Math.round(gSum / count);
    const b = Math.round(bSum / count);

    return `rgb(${r}, ${g}, ${b})`;
  }
}
