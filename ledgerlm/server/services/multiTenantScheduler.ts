import cron, { ScheduledTask } from 'node-cron';
import { CronExpressionParser } from 'cron-parser';
import { storage } from '../storage';
import { domainAnaplanAutomation } from './domainAnaplanAutomation';
import { syncAllScheduledAzureBlobConnectors } from './azureBlobSyncService';
import { DomainSchedulerConfig } from '@shared/schema';

interface DomainJob {
  domainId: string;
  companyId: string;
  cronJob: ScheduledTask;
  config: DomainSchedulerConfig;
  isRunning: boolean;
}

export class MultiTenantScheduler {
  private domainJobs: Map<string, DomainJob> = new Map();

  async startAllDomainSchedulers(): Promise<void> {
    console.log('\n🔄 Starting multi-tenant Anaplan schedulers...\n');
    
    try {
      const configs = await storage.getAllDomainSchedulerConfigs();
      
      if (configs.length === 0) {
        console.log('   No domain scheduler configurations found');
        return;
      }

      for (const config of configs) {
        if (config.enabled === 1) {
          await this.startDomainScheduler(config);
        } else {
          console.log(`   ⏸️  ${config.domainId}: Disabled`);
        }
      }

      console.log(`\n✅ Started ${this.domainJobs.size} domain scheduler(s)\n`);
    } catch (error) {
      console.error('❌ Failed to start domain schedulers:', error);
    }
  }

  async startDomainScheduler(config: DomainSchedulerConfig): Promise<void> {
    const domainId = config.domainId;

    if (this.domainJobs.has(domainId)) {
      console.log(`   ⚠️  Scheduler already running for domain: ${domainId}`);
      return;
    }

    const domain = await storage.getDomain(domainId);
    if (!domain || !domain.companyId) {
      console.log(`   ⏸️  ${domainId}: No company linked`);
      return;
    }

    const cronExpression = `${config.minute} ${config.hour} * * *`;

    const cronJob = cron.schedule(
      cronExpression,
      async () => {
        const job = this.domainJobs.get(domainId);
        if (!job) return;

        if (job.isRunning) {
          console.log(`⏭️  Skipping scheduled sync for ${domainId} - previous run still in progress`);
          return;
        }

        job.isRunning = true;
        try {
          console.log(`\n⏰ SCHEDULED SYNC for domain ${domainId} (${config.hour}:${String(config.minute).padStart(2, '0')} ${config.timezone})\n`);

          // Run Anaplan sync
          await domainAnaplanAutomation.runDomainSync(
            domainId,
            domain.companyId!,
            'scheduled'
          );

          // Run Azure Blob sync for all scheduled connectors
          await syncAllScheduledAzureBlobConnectors(domainId, domain.companyId!);

        } catch (error) {
          console.error(`❌ Scheduled sync failed for ${domainId}:`, error);
        } finally {
          job.isRunning = false;
        }
      },
      {
        timezone: config.timezone,
      }
    );

    this.domainJobs.set(domainId, {
      domainId,
      companyId: domain.companyId,
      cronJob,
      config,
      isRunning: false,
    });

    console.log(`   ✅ ${domainId}: ${config.hour}:${String(config.minute).padStart(2, '0')} ${config.timezone}`);
  }

  async stopDomainScheduler(domainId: string): Promise<void> {
    const job = this.domainJobs.get(domainId);
    if (job) {
      job.cronJob.stop();
      this.domainJobs.delete(domainId);
      console.log(`🛑 Stopped scheduler for domain: ${domainId}`);
    }
  }

  async restartDomainScheduler(domainId: string): Promise<void> {
    await this.stopDomainScheduler(domainId);
    
    const config = await storage.getDomainSchedulerConfig(domainId);
    if (config && config.enabled === 1) {
      await this.startDomainScheduler(config);
    }
  }

  stopAll(): void {
    this.domainJobs.forEach((job, domainId) => {
      job.cronJob.stop();
      console.log(`🛑 Stopped scheduler for domain: ${domainId}`);
    });
    this.domainJobs.clear();
  }

  getNextRunTime(domainId: string): string {
    const job = this.domainJobs.get(domainId);
    if (!job) {
      return 'Not scheduled';
    }

    try {
      const config = job.config;
      const cronExpression = `${config.minute} ${config.hour} * * *`;
      
      const interval = CronExpressionParser.parse(cronExpression, {
        tz: config.timezone
      });
      
      const nextRun = interval.next().toDate();
      
      return nextRun.toLocaleString('en-IN', { 
        timeZone: config.timezone,
        dateStyle: 'full',
        timeStyle: 'long',
      });
    } catch (error) {
      return 'Error calculating';
    }
  }

  isDomainSchedulerRunning(domainId: string): boolean {
    return this.domainJobs.has(domainId);
  }

  getDomainStatus(domainId: string): {
    isRunning: boolean;
    isConfigured: boolean;
    nextRun: string;
  } {
    const job = this.domainJobs.get(domainId);
    return {
      isRunning: job !== undefined,
      isConfigured: job !== undefined,
      nextRun: this.getNextRunTime(domainId),
    };
  }

  async triggerManualSync(domainId: string, userId: string): Promise<any> {
    const domain = await storage.getDomain(domainId);
    if (!domain || !domain.companyId) {
      throw new Error(`Domain not found or no company linked: ${domainId}`);
    }

    console.log(`\n🔘 MANUAL SYNC TRIGGERED for domain ${domainId} by user ${userId}\n`);

    const anaplanResult = await domainAnaplanAutomation.runDomainSync(
      domainId,
      domain.companyId,
      'manual',
      userId
    );

    await syncAllScheduledAzureBlobConnectors(domainId, domain.companyId);

    return anaplanResult;
  }
}

export const multiTenantScheduler = new MultiTenantScheduler();
