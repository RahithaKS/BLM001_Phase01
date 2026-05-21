import cron from 'node-cron';
import { CronExpressionParser } from 'cron-parser';
import { anaplanAutomation } from './anaplanAutomation';
import { storage } from '../storage';

export class Scheduler {
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning: boolean = false;
  private currentConfig: any = null;

  async start() {
    if (this.cronJob) {
      console.log('⚠️  Scheduler already running');
      return;
    }

    try {
      const config = await storage.getSchedulerConfig();
      
      if (!config || config.enabled === 0) {
        console.log('⏸️  Anaplan automation scheduler is disabled');
        console.log('   Enable it from Admin > Enterprise Data page');
        return;
      }

      this.currentConfig = config;
      const cronExpression = this.getCronExpression(config.hour, config.minute);

      this.cronJob = cron.schedule(
        cronExpression,
        async () => {
          if (this.isRunning) {
            console.log('⏭️  Skipping scheduled Anaplan sync - previous run still in progress');
            return;
          }

          this.isRunning = true;
          try {
            console.log(`\n⏰ SCHEDULED ANAPLAN SYNC TRIGGERED (${config.hour}:${String(config.minute).padStart(2, '0')} ${config.timezone})\n`);
            await anaplanAutomation.runAutomatedSync('scheduled');
          } catch (error) {
            console.error('❌ Scheduled Anaplan sync failed:', error);
          } finally {
            this.isRunning = false;
          }
        },
        {
          timezone: config.timezone,
        }
      );

      console.log('✅ Anaplan automation scheduler started');
      console.log(`   Schedule: Daily at ${config.hour}:${String(config.minute).padStart(2, '0')} ${config.timezone}`);
      console.log(`   Cron expression: ${cronExpression}`);
      console.log('   Next run:', this.getNextRunTime());
    } catch (error) {
      console.error('❌ Failed to start scheduler:', error);
    }
  }

  getCronExpression(hour: number, minute: number): string {
    return `${minute} ${hour} * * *`;
  }

  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      this.currentConfig = null;
      console.log('🛑 Anaplan automation scheduler stopped');
    }
  }

  async restart() {
    console.log('🔄 Restarting scheduler with new configuration...');
    this.stop();
    await this.start();
  }

  getNextRunTime(): string {
    if (!this.cronJob || !this.currentConfig) {
      return 'Not scheduled';
    }

    try {
      const config = this.currentConfig;
      const cronExpression = this.getCronExpression(config.hour, config.minute);
      
      // Use cron-parser to get the next execution time in the configured timezone
      // Don't pass currentDate - let cron-parser use current time and handle timezone conversion
      const interval = CronExpressionParser.parse(cronExpression, {
        tz: config.timezone
      });
      
      const nextRun = interval.next().toDate();
      
      // Format in the configured timezone  
      return nextRun.toLocaleString('en-IN', { 
        timeZone: config.timezone,
        dateStyle: 'full',
        timeStyle: 'long',
      });
    } catch (error) {
      console.error('Error calculating next run time:', error);
      return 'Not scheduled';
    }
  }

  isSchedulerRunning(): boolean {
    return this.cronJob !== null;
  }

  async getCurrentConfig() {
    return await storage.getSchedulerConfig();
  }

  async triggerManualSync(userId: string): Promise<any> {
    console.log(`\n🔘 MANUAL ANAPLAN SYNC TRIGGERED by user ${userId}\n`);
    return await anaplanAutomation.runAutomatedSync('manual', userId);
  }
}

export const scheduler = new Scheduler();
