import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ConfigModule } from 'nestjs-config';
import { resolve } from 'path';
import { DynamicDataModule } from './dynamic-data/dynamic-data.module';

@Module({
  imports: [
    ConfigModule.load(resolve(__dirname, 'config', '**/!(*.d).{ts,js}')),
    DynamicDataModule
  ],
  controllers: [AppController],
})
export class AppModule {}
