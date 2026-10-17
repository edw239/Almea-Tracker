import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Env } from '../../config/env';
import { TaskNotificationsService } from './task-notifications.service';
import { TaskSchedulesService } from './task-schedules.service';

@Injectable()
export class WorkSchedulerService {
  private readonly logger = new Logger(WorkSchedulerService.name);
  private dueScanRunning = false;
  private schedulesRunning = false;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly notifications: TaskNotificationsService,
    private readonly schedules: TaskSchedulesService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async scanDueBucketsJob() {
    if (!this.config.get('SCHEDULER_ENABLED', { infer: true })) {
      return;
    }
    if (this.dueScanRunning) {
      return;
    }
    this.dueScanRunning = true;
    try {
      const scanned = await this.notifications.scanDueBucketsAllUsers();
      if (scanned > 0) {
        this.logger.debug(`due scan users=${scanned}`);
      }
    } catch (error) {
      this.logger.error('due scan failed', error as Error);
    } finally {
      this.dueScanRunning = false;
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async runSchedulesJob() {
    if (!this.config.get('SCHEDULER_ENABLED', { infer: true })) {
      return;
    }
    if (this.schedulesRunning) {
      return;
    }
    this.schedulesRunning = true;
    try {
      const result = await this.schedules.runDueSchedules();
      if (result.claimed > 0) {
        this.logger.log(
          `schedules claimed=${result.claimed} tasks=${result.createdTasks}`,
        );
      }
    } catch (error) {
      this.logger.error('schedule run failed', error as Error);
    } finally {
      this.schedulesRunning = false;
    }
  }
}
