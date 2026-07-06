import axios, { AxiosInstance } from 'axios';
import { readFile } from 'node:fs/promises';

import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';

import {
    SubscriptionPageRawConfigSchema,
    TSubscriptionPageRawConfig,
} from '@remnawave/subscription-page-types';

import { TypedConfigService } from '@common/config/app-config';

import { DEFAULT_SUBPAGE_CONFIG } from './default-subpage-config';

type CachedConfig = { rezeisTheme?: unknown } & TSubscriptionPageRawConfig;
type ConfigSource = 'admin' | 'default' | 'file';

/**
 * Provides the subscription-page config. Two mutually-exclusive sources:
 *
 *  1. **file** — when `SUBPAGE_CONFIG_FILE` is set, the config is read from a
 *     mounted JSON file (the classic "download from the panel → mount into the
 *     container" workflow, like the upstream subscription page). Re-read on the
 *     TTL and on invalidate so a changed file is picked up.
 *  2. **rezeis-admin** — otherwise it is fetched from rezeis-admin
 *     (`/api/internal/subpage-config/effective`) with a bearer api-token, cached
 *     with a TTL and refreshed on an invalidate webhook.
 *
 * The config is validated against the upstream `SubscriptionPageRawConfigSchema`;
 * the Rezeis `rezeisTheme` extension is preserved across validation. Subscription
 * DATA always comes directly from Remnawave (see AxiosService).
 */
@Injectable()
export class SubpageConfigService implements OnApplicationBootstrap {
    private readonly logger = new Logger(SubpageConfigService.name);

    private readonly source: ConfigSource;
    private readonly filePath: string | undefined;
    private readonly http: AxiosInstance | null;
    private readonly ttlMs: number;

    private cached: CachedConfig = DEFAULT_SUBPAGE_CONFIG;
    private lastFetchedAt = 0;
    private refreshing: Promise<void> | null = null;

    constructor(private readonly configService: TypedConfigService) {
        this.ttlMs = this.configService.getOrThrow('SUBPAGE_CONFIG_TTL_SECONDS') * 1000;

        this.filePath = this.configService.get('SUBPAGE_CONFIG_FILE') || undefined;
        const adminUrl = this.configService.get('REZEIS_ADMIN_URL');
        const adminToken = this.configService.get('REZEIS_ADMIN_TOKEN');

        if (this.filePath) {
            this.source = 'file';
            this.http = null;
        } else if (adminUrl && adminToken) {
            this.source = 'admin';
            this.http = axios.create({
                baseURL: adminUrl,
                timeout: 10_000,
                headers: {
                    'user-agent': 'Rezeis Subscription Page',
                    Authorization: `Bearer ${adminToken}`,
                },
            });
        } else {
            this.source = 'default';
            this.http = null;
        }
    }

    public async onApplicationBootstrap(): Promise<void> {
        this.logger.log(`Subpage config source: ${this.source}`);
        if (this.source === 'default') {
            this.logger.warn(
                'No config source configured (set SUBPAGE_CONFIG_FILE or REZEIS_ADMIN_URL + ' +
                    'REZEIS_ADMIN_TOKEN) — serving the bundled default.',
            );
            return;
        }

        try {
            await this.refresh();
        } catch {
            this.logger.warn(
                `Initial subpage config load (${this.source}) failed — serving bundled default ` +
                    'until the source becomes available.',
            );
        }
    }

    /** Effective config for the frontend. Triggers a background refresh when stale. */
    public getConfig(): TSubscriptionPageRawConfig {
        if (this.source !== 'default' && Date.now() - this.lastFetchedAt > this.ttlMs) {
            void this.refresh().catch((error) => {
                this.logger.debug(`Background subpage config refresh failed: ${error}`);
            });
        }

        return this.cached;
    }

    public getBaseSettings(): TSubscriptionPageRawConfig['baseSettings'] {
        return this.cached.baseSettings;
    }

    /** Force an immediate refresh (invalidate webhook, or manual). */
    public async invalidate(): Promise<boolean> {
        if (this.source === 'default') {
            return false;
        }
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
                const raw =
                    this.source === 'file' ? await this.readFromFile() : await this.readFromAdmin();
                if (raw === undefined) {
                    return;
                }
                await this.applyRaw(raw);
            } finally {
                this.refreshing = null;
            }
        })();

        return this.refreshing;
    }

    private async readFromFile(): Promise<unknown> {
        const content = await readFile(this.filePath as string, 'utf8');
        return JSON.parse(content);
    }

    private async readFromAdmin(): Promise<unknown> {
        const response = await (this.http as AxiosInstance).get(
            '/api/internal/subpage-config/effective',
        );
        // rezeis-admin may wrap the payload as { response: <config> } or return it raw.
        return response.data && typeof response.data === 'object' && 'response' in response.data
            ? (response.data as { response: unknown }).response
            : response.data;
    }

    private async applyRaw(raw: unknown): Promise<void> {
        const parsed = await SubscriptionPageRawConfigSchema.safeParseAsync(raw);

        if (!parsed.success) {
            this.logger.error(
                `Subpage config is invalid: ${JSON.stringify(parsed.error.issues.slice(0, 5))}`,
            );
            return;
        }

        // Preserve the Rezeis fork extension (`rezeisTheme`), which the upstream
        // strict schema strips during validation.
        const merged: CachedConfig = parsed.data;
        if (raw && typeof raw === 'object' && 'rezeisTheme' in raw) {
            merged.rezeisTheme = (raw as { rezeisTheme?: unknown }).rezeisTheme;
        }

        this.cached = merged;
        this.lastFetchedAt = Date.now();
        this.logger.log(`[OK] Subpage config refreshed (${this.source}).`);
    }
}
