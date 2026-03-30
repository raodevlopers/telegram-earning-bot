import type { Telegraf } from "telegraf";
import type { Logger } from "pino";
import type { UserRecord } from "../../../shared/src/types.js";
import type { AppConfig } from "../config/env.js";
import type { UserService } from "./user-service.js";

export class ReminderService {
  private interval: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly bot: Telegraf,
    private readonly userService: UserService,
    private readonly config: AppConfig,
    private readonly logger: Logger
  ) {}

  start() {
    if (this.interval) {
      return;
    }

    this.interval = setInterval(() => {
      void this.tick();
    }, this.config.reminders.scanIntervalMs);

    void this.tick();
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private async tick() {
    if (this.running) {
      return;
    }

    this.running = true;
    try {
      const users = await this.userService.listUsersDueForReminder(50);
      for (const user of users) {
        await this.sendReminder(user);
      }
    } catch (error) {
      this.logger.error({ err: error }, "reminder_tick_failed");
    } finally {
      this.running = false;
    }
  }

  private async sendReminder(user: UserRecord) {
    try {
      await this.bot.telegram.sendMessage(user.telegramId, this.buildReminderMessage(user), {
        parse_mode: "HTML"
      });
      await this.userService.markReminderSent(user.id);
      this.logger.info({ userId: user.id }, "reminder_sent");
    } catch (error) {
      this.logger.warn({ err: error, userId: user.id }, "reminder_send_failed");
      await this.userService.rescheduleReminderRetry(user.id, 60);
    }
  }

  private buildReminderMessage(user: UserRecord) {
    const firstName = user.firstName?.trim() || user.displayName;
    const messages: string[] = [
      `Hi <b>${firstName}</b> ✨\nNew earning tasks kabhi bhi drop ho sakte hain. Aaj bhi check karo, referral share karo aur withdrawal target ko jaldi unlock karo.`,
      `<b>${firstName}</b> 💸\nAapka next reward aapka wait kar raha hai. Bot kholo, task complete karo, aur referral se extra Rs 5 add karo.`,
      `Hello <b>${firstName}</b> 🚀\nTask list refresh karna mat bhoolna. Proof bhejo, balance build karo, aur first withdrawal ke aur kareeb aa jao.`,
      `<b>${firstName}</b> 🎯\nAaj ka goal simple hai: task complete karo, doston ko refer karo, aur Rs 35 withdrawal milestone hit karo.`
    ];

    return messages[Math.floor(Math.random() * messages.length)] || messages[0] || "Income Hub reminder";
  }
}
