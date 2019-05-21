import { Controller, Get, Inject, Logger } from '@nestjs/common';
import { ConfigService } from 'nestjs-config';

@Controller()
export class AppController {
  private readonly logger: Logger;

  constructor(private readonly config: ConfigService) {
    this.logger = new Logger(AppController.name);
    this.config = config;
  }

  @Get()
  getHello(): string {
    return 'hello';
  }
}
