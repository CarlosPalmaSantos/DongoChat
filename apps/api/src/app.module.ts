import { Module } from '@nestjs/common';
import { Gateway } from './gateway';
import { AppService } from './app.service';

@Module({
  providers: [Gateway, AppService],
})
export class AppModule { }
