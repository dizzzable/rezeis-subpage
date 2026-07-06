import axios, { AxiosInstance } from 'axios';

import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';

import {
    SubscriptionPageRawConfigSchema,
    TSubscriptionPageRawConfig,
} from '@remnawave/subscription-page-types';

import { TypedConfigService } from '@common/config/app-config';

import { DEFAULT_SUBPAGE_CONFIG } from './default-subpage-config';

/**
 * Source of truth for the subscription-page config is **rezeis-admin**, not the
 * Remnawave panel. This service fetches the effective config from rezeis-admin,
 * validates it against the upstream `SubscriptionPageRawConfigSchema`, caches it
 * in memory with a TTL, and exposes an `invalidate()` hook driven by a webhook
 * from rezeis-admin (same pattern as reiwa bot-config).
 *
 * Subscription DATA still comes directly from Remnawave (see AxiosService).
 */
@Injectable()
export class SubpageConfigService implements OnApplicationBootstrap {
    private readonly logger = new Logger(SubpageConfigService.name);

    private readonly http: AxiosInstance;
    private readonly ttlMs: number;

    private cached: { rezeisTheme?: unknown } & TSubscriptionPageRawConfig = DEFAULT_SUBPAGE_CONFIG;
    private lastFetchedAt = 0;
    private refreshing: Promise<void> | null = null;

    constructor(private readonly configService: TypedConfigService) {
        const baseURL = this.configService.getOrThrow('REZEIS_ADMIN_URL');
        const token = this.configService.getOrThrow('REZEIS_ADMIN_TOKEN');

        this.ttlMs = this.configService.getOrThrow('SUBPAGE_CONFIG_TTL_SECONDS') * 1000;

        this.http = axios.create({
            baseURL,
            timeout: 10_000,
            headers: {
                'user-agent': 'Rezeis Subscription Page',
                Authorization: `Bearer ${token}`,
            },
        });
    }

    public async onApplicationBootstrap(): Promise<void> {
        try {
            await this.refresh();
        } catch {
            this.logger.warn(
                'Initial subpage config fetch from rezeis-admin failed — serving bundled default ' +
                    'until rezeis-admin becomes reachable.',
            );
        }
    }

    /** Effective config for the frontend. Triggers a background refresh when stale. */
    public getConfig(): TSubscriptionPageRawConfig {
        if (Date.now() - this.lastFetchedAt > this.ttlMs) {
            void this.refresh().catch((error) => {
                this.logger.debug(`Background subpage config refresh failed: ${error}`);
            });
        }

        return this.cached;
    }

    public getBaseSettings(): TSubscriptionPageRawConfig['baseSettings'] {
        return this.cached.baseSettings;
    }

    /** Force an immediate refresh (called by the rezeis-admin invalidate webhook). */
    public async invalidate(): Promise<boolean> {
        try {
            await this.refresh();
            return true;
        } catch (error) {
            this.logger.error(`Subpage config invalidate/refresh failed: ${error}`);
            return false;
        }
    }

    private async refresh(): Promise<void> {
        if (this.refreshing) {
            return this.refreshing;
        }

        this.refreshing = (async (): Promise<void> => {
            try {
                const response = await this.http.get('/api/internal/subpage-config/effective');

                // rezeis-admin may wrap the payload as { response: <config> } or return it raw.
                const raw =
                    response.data &&
                    typeof response.data === 'object' &&
                    'response' in response.data
                        ? (response.data as { response: unknown }).response
                        : response.data;

                const parsed = await SubscriptionPageRawConfigSchema.safeParseAsync(raw);

                if (!parsed.success) {
                    this.logger.error(
                        `Fetched subpage config is invalid: ${JSON.stringify(
                            parsed.error.issues.slice(0, 5),
                        )}`,
                    );
                    return;
                }

                // Preserve the Rezeis fork extension (`rezeisTheme`), which the
                // upstream strict schema strips during validation.
                const merged: { rezeisTheme?: unknown } & TSubscriptionPageRawConfig = parsed.data;
                if (raw && typeof raw === 'object' && 'rezeisTheme' in raw) {
                    merged.rezeisTheme = (raw as { rezeisTheme?: unknown }).rezeisTheme;
                }

                this.cached = merged;
                this.lastFetchedAt = Date.now();
                this.logger.log('[OK] Subpage config refreshed from rezeis-admin.');
            } finally {
                this.refreshing = null;
            }
        })();

        return this.refreshing;
    }
}
