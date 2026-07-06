import { timingSafeEqual } from 'node:crypto';
import { Request } from 'express';

import { Controller, Headers, HttpCode, Logger, Post, Req } from '@nestjs/common';

import { TypedConfigService } from '@common/config/app-config';

import { SubpageConfigService } from './subpage-config.service';

/**
 * Internal webhook called by rezeis-admin when the subpage config changes, so
 * the page picks up new branding/apps immediately instead of waiting for the
 * TTL refresh. Authenticated with a shared bearer secret
 * (`REZEIS_SUBPAGE_WEBHOOK_SECRET`). When the secret is unset the endpoint is
 * disabled (config still refreshes on its TTL).
 */
@Controller('internal/subpage-config')
export class SubpageWebhookController {
    private readonly logger = new Logger(SubpageWebhookController.name);
    private readonly secret: string | undefined;

    constructor(
        private readonly configService: TypedConfigService,
        private readonly subpageConfigService: SubpageConfigService,
    ) {
        this.secret = this.configService.get('REZEIS_SUBPAGE_WEBHOOK_SECRET');
    }

    @HttpCode(200)
    @Post('invalidate')
    async invalidate(
        @Headers('authorization') authorization: string | undefined,
        @Req() req: Request,
    ): Promise<{ ok: boolean } | void> {
        if (!this.secret) {
            this.logger.warn('Invalidate called but REZEIS_SUBPAGE_WEBHOOK_SECRET is not set.');
            req.socket?.destroy();
            return;
        }

        const provided = authorization?.startsWith('Bearer ')
            ? authorization.slice('Bearer '.length)
            : undefined;

        if (!provided || !this.isSecretValid(provided)) {
            req.socket?.destroy();
            return;
        }

        const ok = await this.subpageConfigService.invalidate();
        return { ok };
    }

    private isSecretValid(provided: string): boolean {
        if (!this.secret) {
            return false;
        }

        const a = Buffer.from(provided);
        const b = Buffer.from(this.secret);

        if (a.length !== b.length) {
            return false;
        }

        return timingSafeEqual(a, b);
    }
}
