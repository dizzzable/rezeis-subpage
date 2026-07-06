/* eslint-disable */
/**
 * Catalog generator for the Rezeis subscription page.
 *
 * Builds the default subscription-page config (v1 raw shape) with the standard
 * client catalog + incy, VALIDATES it against the real
 * `SubscriptionPageRawConfigSchema`, then emits:
 *   1. docs/examples/catalog.reference.example.json      (canonical, pretty)
 *   2. backend/src/modules/root/default-subpage-config.ts (subpage fallback)
 *   3. rezeis-admin subpage-config.default.ts             (admin source-of-truth default)
 *
 * The two TS defaults embed the config as JSON.parse(<escaped string>) so the
 * value compiles into JS (no asset-copy needed) and stays byte-identical to the
 * validated JSON.
 *
 * Run:  node scripts/gen-catalog.cjs   (from backend/)
 */
const fs = require('node:fs');
const path = require('node:path');
const { SubscriptionPageRawConfigSchema } = require('@remnawave/subscription-page-types');

const L = (en, ru) => ({ en, ru });

// ── Shared copy ──────────────────────────────────────────────────────────────
const T = {
  install: L('Install the app', 'Установите приложение'),
  add: L('Add subscription', 'Добавьте подписку'),
  connect: L('Connect', 'Подключитесь'),
  addDeep: L(
    'Tap the button below — the app opens and adds the subscription automatically.',
    'Нажмите кнопку ниже — приложение откроется и добавит подписку автоматически.',
  ),
  addCopy: L(
    'Copy the link, open the app and add the subscription manually (＋ → from clipboard).',
    'Скопируйте ссылку, откройте приложение и добавьте подписку вручную (＋ → из буфера обмена).',
  ),
  connectDesc: L(
    'Open the app, allow the VPN configuration, choose a server and connect.',
    'Откройте приложение, разрешите VPN-конфигурацию, выберите сервер и подключитесь.',
  ),
};

const extBtn = (link, text) => ({ type: 'external', link, svgIconKey: 'download', text });
const subBtn = (scheme, text) => ({ type: 'subscriptionLink', link: scheme, svgIconKey: 'link', text });
const copyBtn = (text) => ({ type: 'copyButton', link: '{{SUBSCRIPTION_LINK}}', svgIconKey: 'copy', text });

const installBlock = (installDesc, buttons) => ({
  svgIconKey: 'download',
  svgIconColor: 'blue',
  title: T.install,
  description: installDesc,
  buttons,
});
const addBlockDeep = (scheme) => ({
  svgIconKey: 'link',
  svgIconColor: 'teal',
  title: T.add,
  description: T.addDeep,
  buttons: [subBtn(scheme, L('Add to app', 'Добавить в приложение'))],
});
const addBlockCopy = () => ({
  svgIconKey: 'link',
  svgIconColor: 'teal',
  title: T.add,
  description: T.addCopy,
  buttons: [copyBtn(L('Copy link', 'Скопировать ссылку'))],
});
const connectBlock = () => ({
  svgIconKey: 'rocket',
  svgIconColor: 'green',
  title: T.connect,
  description: T.connectDesc,
  buttons: [],
});

// deep-link client: install(store) + add(scheme) + connect
const appDeep = (name, featured, storeBtns, scheme, installDesc) => ({
  name,
  featured,
  blocks: [installBlock(installDesc ?? L('Install the app from the store below.', 'Установите приложение по кнопке ниже.'), storeBtns), addBlockDeep(scheme), connectBlock()],
});
// copy-based client (no reliable deep-link): install(download) + add(copy) + connect
const appCopy = (name, featured, storeBtns, installDesc) => ({
  name,
  featured,
  blocks: [installBlock(installDesc ?? L('Download and install the app.', 'Скачайте и установите приложение.'), storeBtns), addBlockCopy(), connectBlock()],
});

// Store buttons
const appStore = (url) => extBtn(url, L('App Store', 'App Store'));
const googlePlay = (url) => extBtn(url, L('Google Play', 'Google Play'));
const apk = (url) => extBtn(url, L('Download APK', 'Скачать APK'));
const ghRelease = (url) => extBtn(url, L('GitHub releases', 'GitHub releases'));

const config = {
  version: '1',
  locales: ['en', 'ru'],
  brandingSettings: { title: 'Rezeis', logoUrl: '', supportUrl: 'https://t.me/' },
  uiConfig: { subscriptionInfoBlockType: 'cards', installationGuidesBlockType: 'accordion' },
  // Rezeis fork extension (NOT part of the upstream strict schema). Carried
  // through the subpage untouched and applied by the subpage frontend theme.
  rezeisTheme: {
    primaryColor: 'cyan',
    backgroundColor: '#0b0f17',
    accentColor: '#22d3ee',
  },
  baseSettings: {
    metaTitle: 'Subscription',
    metaDescription: 'Subscription',
    showConnectionKeys: false,
    hideGetLinkButton: false,
  },
  baseTranslations: {
    installationGuideHeader: L('Installation guide', 'Инструкция по установке'),
    connectionKeysHeader: L('Connection keys', 'Ключи подключения'),
    linkCopied: L('Copied', 'Скопировано'),
    linkCopiedToClipboard: L('Link copied to clipboard', 'Ссылка скопирована в буфер обмена'),
    getLink: L('Get link', 'Получить ссылку'),
    scanQrCode: L('Scan QR code', 'Отсканируйте QR-код'),
    scanQrCodeDescription: L('Scan the QR code with your app to import the subscription', 'Отсканируйте QR-код приложением, чтобы импортировать подписку'),
    copyLink: L('Copy link', 'Скопировать ссылку'),
    name: L('Name', 'Имя'),
    status: L('Status', 'Статус'),
    active: L('Active', 'Активна'),
    inactive: L('Inactive', 'Неактивна'),
    expires: L('Expires', 'Истекает'),
    bandwidth: L('Bandwidth', 'Трафик'),
    scanToImport: L('Scan to import', 'Отсканируйте для импорта'),
    expiresIn: L('Expires in', 'Истекает через'),
    expired: L('Expired', 'Истекла'),
    unknown: L('Unknown', 'Неизвестно'),
    indefinitely: L('Indefinitely', 'Бессрочно'),
  },
  svgLibrary: {
    apple: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.365 1.43c0 1.14-.42 2.2-1.12 3.02-.77.9-2.02 1.6-3.05 1.52-.13-1.1.42-2.26 1.09-3.02.76-.86 2.08-1.5 3.08-1.52zM20.5 17.1c-.55 1.27-.82 1.84-1.53 2.97-.99 1.57-2.39 3.53-4.12 3.54-1.54.02-1.93-.99-4.02-.98-2.09.01-2.52 1-4.06.98-1.73-.02-3.05-1.79-4.04-3.36C-.02 16.9-.3 12.2 1.4 9.7c1.2-1.76 3.1-2.79 4.88-2.79 1.82 0 2.96 1 4.46 1 1.46 0 2.35-1 4.46-1 1.59 0 3.28.87 4.48 2.36-3.94 2.16-3.3 7.78.32 9.83z"/></svg>',
    android: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 18a2 2 0 0 0 2 2h1v3a1 1 0 0 0 2 0v-3h2v3a1 1 0 0 0 2 0v-3h1a2 2 0 0 0 2-2V9H6v9zM3.5 9A1.5 1.5 0 0 0 2 10.5v5a1.5 1.5 0 0 0 3 0v-5A1.5 1.5 0 0 0 3.5 9zm17 0a1.5 1.5 0 0 0-1.5 1.5v5a1.5 1.5 0 0 0 3 0v-5A1.5 1.5 0 0 0 20.5 9z"/></svg>',
    windows: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 5.1 10.5 4v7.5H3V5.1zM10.5 12.5V20L3 18.9v-6.4h7.5zM11.5 3.9 21 2.5v9H11.5V3.9zM21 12.5v9l-9.5-1.4v-7.6H21z"/></svg>',
    linux: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c-1.7 0-3 1.6-3 3.6 0 1 .3 1.6.3 2.4 0 .9-.9 1.7-1.6 3C6.7 15 5 16.9 5 19c0 1.7 1.4 3 3.5 3 1.2 0 2.2-.6 3.5-.6s2.3.6 3.5.6c2.1 0 3.5-1.3 3.5-3 0-2.1-1.7-4-2.7-8-.7-1.3-1.6-2.1-1.6-3 0-.8.3-1.4.3-2.4C15 3.6 13.7 2 12 2zm-1.3 4.2a.7.7 0 1 1 0 1.4.7.7 0 0 1 0-1.4zm2.6 0a.7.7 0 1 1 0 1.4.7.7 0 0 1 0-1.4z"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg>',
    rocket: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 15c-1 1-1 4-1 4s3 0 4-1M15 9l-6 6M9 5s6-3 10 1 1 10 1 10-6-1-6-1M9 5 5 9l3 1 5 5 1 3 4-4"/></svg>',
  },
  platforms: {
    ios: {
      displayName: L('iOS', 'iOS'),
      svgIconKey: 'apple',
      apps: [
        appDeep('Happ', true, [appStore('https://apps.apple.com/app/happ-proxy-utility/id6504287215')], 'happ://add/{{SUBSCRIPTION_LINK}}'),
        appDeep('incy', false, [appStore('https://apps.apple.com/app/incy/id6756943388')], 'incy://add/{{SUBSCRIPTION_LINK}}', L('Install incy from the App Store. Also runs on iPad, Mac and Apple TV.', 'Установите incy из App Store. Также работает на iPad, Mac и Apple TV.')),
        appDeep('v2RayTun', false, [appStore('https://apps.apple.com/app/v2raytun/id6476628951')], 'v2raytun://import/{{SUBSCRIPTION_LINK}}'),
        appDeep('Streisand', false, [appStore('https://apps.apple.com/app/streisand/id6450534064')], 'streisand://import/{{SUBSCRIPTION_LINK}}'),
        appCopy('Shadowrocket', false, [appStore('https://apps.apple.com/app/shadowrocket/id932747118')]),
      ],
    },
    android: {
      displayName: L('Android', 'Android'),
      svgIconKey: 'android',
      apps: [
        appDeep('Happ', true, [googlePlay('https://play.google.com/store/apps/details?id=com.happproxy'), apk('https://github.com/Happ-proxy/happ-android/releases/latest/download/Happ.apk')], 'happ://add/{{SUBSCRIPTION_LINK}}'),
        appDeep('incy', false, [googlePlay('https://play.google.com/store/apps/details?id=llc.itdev.incy'), apk('https://github.com/INCY-DEV/incy-platforms/releases/latest/download/Incy.apk')], 'incy://add/{{SUBSCRIPTION_LINK}}'),
        appDeep('v2RayTun', false, [googlePlay('https://play.google.com/store/apps/details?id=com.v2raytun.android')], 'v2raytun://import/{{SUBSCRIPTION_LINK}}'),
        appDeep('Hiddify', false, [googlePlay('https://play.google.com/store/apps/details?id=app.hiddify.com'), ghRelease('https://github.com/hiddify/hiddify-app/releases')], 'hiddify://import/{{SUBSCRIPTION_LINK}}'),
        appDeep('Clash Meta', false, [ghRelease('https://github.com/MetaCubeX/ClashMetaForAndroid/releases')], 'clash://install-config?url={{SUBSCRIPTION_LINK}}'),
      ],
    },
    windows: {
      displayName: L('Windows', 'Windows'),
      svgIconKey: 'windows',
      apps: [
        appDeep('Hiddify', true, [ghRelease('https://github.com/hiddify/hiddify-app/releases')], 'hiddify://import/{{SUBSCRIPTION_LINK}}'),
        appCopy('v2rayN', false, [ghRelease('https://github.com/2dust/v2rayN/releases')]),
        appCopy('Nekoray', false, [ghRelease('https://github.com/MatsuriDayo/nekoray/releases')]),
      ],
    },
    macos: {
      displayName: L('macOS', 'macOS'),
      svgIconKey: 'apple',
      apps: [
        appDeep('Happ', true, [appStore('https://apps.apple.com/app/happ-proxy-utility/id6504287215')], 'happ://add/{{SUBSCRIPTION_LINK}}'),
        appDeep('Hiddify', false, [ghRelease('https://github.com/hiddify/hiddify-app/releases')], 'hiddify://import/{{SUBSCRIPTION_LINK}}'),
        appDeep('Streisand', false, [appStore('https://apps.apple.com/app/streisand/id6450534064')], 'streisand://import/{{SUBSCRIPTION_LINK}}'),
      ],
    },
    linux: {
      displayName: L('Linux', 'Linux'),
      svgIconKey: 'linux',
      apps: [
        appDeep('Hiddify', true, [ghRelease('https://github.com/hiddify/hiddify-app/releases')], 'hiddify://import/{{SUBSCRIPTION_LINK}}'),
        appCopy('Nekoray', false, [ghRelease('https://github.com/MatsuriDayo/nekoray/releases')]),
      ],
    },
  },
};

// ── Validate ──────────────────────────────────────────────────────────────
const result = SubscriptionPageRawConfigSchema.safeParse(config);
if (!result.success) {
  console.error('INVALID catalog:');
  console.error(JSON.stringify(result.error.issues.slice(0, 20), null, 2));
  process.exit(1);
}
console.log('Catalog VALID.');

const backendDir = path.resolve(__dirname, '..');
const repoDir = path.resolve(backendDir, '..');
const jsonPretty = JSON.stringify(config, null, 2) + '\n';
const jsonMin = JSON.stringify(config);

// 1) canonical example JSON
const examplePath = path.join(repoDir, 'docs', 'examples', 'catalog.reference.example.json');
fs.writeFileSync(examplePath, jsonPretty);

// 2) subpage fallback default (TS)
const subpageTs = `import { TSubscriptionPageRawConfig } from '@remnawave/subscription-page-types';

/**
 * Bundled default config (v1 raw shape). AUTO-GENERATED by
 * backend/scripts/gen-catalog.cjs — do not edit by hand; edit the generator.
 *
 * Served only until the effective config is fetched from rezeis-admin.
 * Embedded as JSON.parse(<string>) so it compiles into JS (no asset copy) and
 * stays byte-identical to docs/examples/catalog.reference.example.json.
 */
const RAW = ${JSON.stringify(jsonMin)};

export const DEFAULT_SUBPAGE_CONFIG = JSON.parse(RAW) as TSubscriptionPageRawConfig;
`;
fs.writeFileSync(path.join(backendDir, 'src', 'modules', 'root', 'default-subpage-config.ts'), subpageTs);

// 3) admin default (TS, no AGPL types)
const adminDefaultPath = path.resolve(
  repoDir,
  '..',
  'rezeis',
  'rezeis-admin',
  'src',
  'modules',
  'subpage-config',
  'subpage-config.default.ts',
);
const adminTs = `/**
 * Default subscription-page config (v1 raw shape) returned by the internal
 * effective endpoint until an operator saves one, and used to seed the editor.
 *
 * AUTO-GENERATED by rezeis-subpage/backend/scripts/gen-catalog.cjs — do not edit
 * by hand; edit the generator. Byte-identical to the subpage default.
 *
 * NOTE: we intentionally do NOT import '@remnawave/subscription-page-types' here
 * (AGPL-3.0) — rezeis-admin stays free of AGPL deps. Embedded as JSON.parse so it
 * compiles into JS (no asset-copy) and is handled as an opaque object.
 */
const RAW = ${JSON.stringify(jsonMin)};

export const DEFAULT_SUBPAGE_CONFIG: Record<string, unknown> = JSON.parse(RAW) as Record<
  string,
  unknown
>;
`;
if (fs.existsSync(path.dirname(adminDefaultPath))) {
  fs.writeFileSync(adminDefaultPath, adminTs);
  console.log('Wrote admin default:', adminDefaultPath);
} else {
  console.warn('Admin module dir not found, skipped:', adminDefaultPath);
}

console.log('Wrote example JSON + subpage default.');
console.log('Platforms:', Object.keys(config.platforms).join(', '));
