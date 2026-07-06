# rezeis-subpage — исследование Remnawave Subscription Page

> Полное техническое исследование апстрима `remnawave/subscription-page`, на базе
> которого создаётся наш форк `rezeis-subpage`.
>
> Дата исследования: 2026-07-06 · Базовая версия апстрима: **v7.2.6** (tag `7.2.6`, commit `5fefecd`)
> Источники: https://github.com/remnawave/subscription-page · https://remna.st/ · https://docs.rw

---

## 0. TL;DR / ключевой вывод

- Апстрим **на React** (React 19 + Mantine 9 + Vite), а не «не на React», как предполагалось.
  Это важно: форк не требует смены стека — мы работаем в том же React/TS-стеке, что и остальной
  фронтенд reiwa/rezeis-admin, и можем переиспользовать подходы к i18n и стилю.
- Это **два отдельных приложения** в одном репозитории:
  - `frontend/` — SPA (Vite build → статика).
  - `backend/` — NestJS (Express), который **раздаёт собранную статику** фронта и проксирует
    данные подписки из Remnawave Panel по API-токену.
- Лицензия апстрима — **AGPL-3.0-only**. Это накладывает обязательства (см. §8): при публичном
  развёртывании модифицированной версии исходники модификаций должны быть доступны.
- Основная точка кастомизации без правки кода — **`frontend/public/assets/app-config.json`**
  (брендинг + каталог приложений по платформам + пошаговые инструкции с i18n).

---

## 1. Архитектура

```
subscription-page/
├── backend/                 # NestJS 11 (CommonJS) — API + раздача статики фронта
│   ├── src/
│   │   ├── main.ts          # bootstrap: helmet, compression, cookie-parser, trust proxy,
│   │   │                    #  static assets, CORS(GET), global prefix = CUSTOM_SUB_PREFIX
│   │   ├── app.module.ts
│   │   ├── common/          # config (TypedConfigService), middlewares, filters, utils
│   │   └── modules/         # бизнес-модули (проксирование к панели, рендер конфигов)
│   ├── ecosystem.config.js  # PM2 (pm2-runtime в контейнере)
│   ├── docker-entrypoint.sh
│   └── nest-cli.json
├── frontend/                # React 19 + Mantine 9 + Vite 8 (ESM) — Feature-Sliced Design
│   ├── src/
│   │   ├── app.tsx / main.tsx
│   │   ├── app/             # layouts + router
│   │   ├── pages/           # main, errors/5xx
│   │   ├── widgets/main/    # subscription-info, subscription-link, installation-guide, raw-keys
│   │   ├── entities/        # zustand-стора: app-config-store, subscription-info-store
│   │   ├── shared/          # ui, hooks, hocs, utils, constants/theme (Mantine overrides)
│   │   └── global.css
│   ├── public/assets/       # app-config.json + фавиконки
│   ├── vite.config.ts       # vite-plugin-ejs, remove-console, webfont-dl, visualizer
│   └── index.html
├── Dockerfile               # multi-stage: собирает backend, копирует frontend/dist → образ
├── docker-compose.yml / -prod.yml
├── Makefile                 # bump-версий (backend+frontend), install, tag-release
└── .env.sample
```

### 1.1 Как это работает в рантайме
1. Пользователь открывает `https://<sub-domain>/<shortUuid>` (или c `CUSTOM_SUB_PREFIX`).
2. NestJS (`main.ts`) отдаёт SPA-статику (`useStaticAssets`, `setViewEngine('html')` через ejs).
3. Фронт грузит `assets/app-config.json` (брендинг + каталог клиентов), парсит его
   (`shared/utils/config-parser`) в `app-config-store` (zustand).
4. Фронт запрашивает данные подписки; backend ходит в **Remnawave Panel** (`REMNAWAVE_PANEL_URL`)
   с `REMNAWAVE_API_TOKEN` и возвращает инфо о подписке / ссылки / raw-ключи.
5. Виджеты рендерят: инфо о подписке, ссылку-подписку (+ QR через `uqr`), пошаговый гайд
   установки под конкретный клиент, «сырые» ключи.

### 1.2 Технологический стек
| Слой | Технологии |
|------|-----------|
| Frontend | React 19.2, Mantine 9.3 (core/hooks/modals/notifications/nprogress), Vite 8, Zustand 5, react-router 7, zod 3, dayjs, i18next language-detector, `@tabler/icons-react`, `uqr` (QR), `jsencrypt`/`cryptohapp` (крипта happ), `ofetch` |
| Backend | NestJS 11, Express 5, `@nestjs/axios`+axios, helmet, compression, cookie-parser, morgan, winston/nest-winston, `nestjs-zod`, jsonwebtoken/`@nestjs/jwt`, `proxy-addr`, ejs, superjson |
| Общие контракты | `@remnawave/backend-contract@2.7.2`, `@remnawave/subscription-page-types@0.4.0` |
| Инфра | Docker (node:24-trixie-slim), PM2 (`pm2-runtime`), Makefile |
| Качество | ESLint 9 (perfectionist, airbnb-base, import), Prettier, Stylelint (SCSS standard), dependency-cruiser |

---

## 2. Конфигурация (backend `.env`)

> ⚠️ **Важно:** корневой `.env.sample` **неполон** — реальная схема (`backend/src/common/config/
> app-config/config.schema.ts`) требует ещё `INTERNAL_JWT_SECRET`, `SUBPAGE_CONFIG_UUID` и др.
> Ниже — актуальная таблица по схеме (источник истины — `config.schema.ts`).

| Переменная | Обяз.? | Назначение |
|-----------|:---:|-----------|
| `APP_PORT` | нет (`3010`) | Порт NestJS. |
| `REMNAWAVE_PANEL_URL` | **да** | URL панели (`http://remnawave:3000` или `https://panel.example.com`). Должен начинаться с `http://`/`https://`. |
| `REMNAWAVE_API_TOKEN` | **да** | **Секрет.** Bearer-токен из Remnawave Dashboard → Settings → API Tokens. |
| `INTERNAL_JWT_SECRET` | **да** | **Секрет.** Ключ для JWT session-cookie и шифрования subpage-config UUID (`crypt-utils`). |
| `SUBPAGE_CONFIG_UUID` | нет (`00000000-…0`) | UUID конфига сабстраницы в панели. Sentinel по умолчанию → берётся per-subscription UUID от панели; иначе — фиксированный. |
| `CUSTOM_SUB_PREFIX` | нет | Кастомный корневой путь (напр. `sub`) → global prefix (маршрут app-config исключён). |
| `TRUST_PROXY` | нет (`1`) | Express `trust proxy`: `true/false`, число хопов или список пресетов/CIDR. |
| `CADDY_AUTH_API_TOKEN` | нет | `X-Api-Key` к панели (Caddy-security / Tiny Auth). |
| `CLOUDFLARE_ZERO_TRUST_CLIENT_ID` / `_SECRET` | нет | Заголовки `CF-Access-Client-*` для Cloudflare ZT. |
| `EGAMES_COOKIE` | нет | Значение заголовка `Cookie` для запросов к панели (частный кейс). |
| `MARZBAN_LEGACY_LINK_ENABLED` | нет (`false`) | Поддержка legacy-ссылок Marzban. |
| `MARZBAN_LEGACY_SECRET_KEY` | если legacy on | Секрет(ы) для legacy Marzban (через запятую). |
| `MARZBAN_LEGACY_SUBSCRIPTION_VALID_FROM` | нет | ISO-дата отсечки валидности. |
| `MARZBAN_LEGACY_DROP_REVOKED_SUBSCRIPTIONS` | нет (`false`) | Отбрасывать отозванные подписки. |

> ⚠️ Секреты (`REMNAWAVE_API_TOKEN`, `INTERNAL_JWT_SECRET`, `MARZBAN_LEGACY_SECRET_KEY`, CF-секреты)
> держать только в `.env` вне git. Для форка: расширить `.env.sample` недостающими ключами.

---

## 2A. Связь с Remnawave — «цепляется ли она к панели?» (ГЛАВНОЕ)

**Да, сабстраница жёстко завязана на Remnawave.** Это не автономная страница — это тонкий
рендер поверх API панели. Подтверждено кодом `backend/src/common/axios/axios.service.ts`,
`modules/root/*`.

### Что происходит при старте (bootstrap)
1. `AxiosService.onModuleInit`: создаёт axios с `baseURL = REMNAWAVE_PANEL_URL`,
   `Authorization: Bearer REMNAWAVE_API_TOKEN`, зовёт `GetMetadataCommand` (проверка связи).
   **Если панель недоступна → процесс `exit(1)`** (сабстраница не стартует).
2. `SubpageConfigService.onApplicationBootstrap`:
   - `GetSubscriptionPageConfigsCommand` → **список UUID конфигов сабстраницы из панели**.
     Если ответ `404` → сообщение «нужен Remnawave Panel >= 2.4.0».
   - для каждого UUID → `GetSubscriptionPageConfigCommand` → полный конфиг (брендинг + платформы/
     приложения + `baseSettings`) → валидация `SubscriptionPageRawConfigSchema` → кэш в память
     (`subpageConfigMap`). **Если ни одного валидного нет → `exit(1)`.**

> Вывод: **сам «app-config» (бренд, каталог клиентов, baseSettings) хранится В Remnawave-панели**
> (раздел настроек сабстраницы, начиная с Panel 2.4.0) и подтягивается сабстраницей по UUID.
> Локальный `frontend/public/assets/app-config.json` в проде — это лишь dev/дефолтный сэмпл.

### Что происходит на каждый запрос
- **Браузер** (`returnWebpage`): `GetSubscriptionInfoByShortUuidCommand` (статус подписки) +
  `GetSubpageConfigByShortUuidCommand` (какой subpage-config применить + `webpageAllowed`).
  Если Remnawave вернул `webpageAllowed === false` (правило SRR в панели) → соединение рвётся.
  Далее рендерится `index.html` с `panelData` (base64 данных подписки) и ставится JWT-cookie
  `session` (подписан `INTERNAL_JWT_SECRET`, содержит зашифрованный subpage-config UUID `su`).
- Фронт затем GET-ит маршрут app-config (`APP_CONFIG_ROUTE_WO_LEADING_PATH`, напр. `/app-config`)
  с этой cookie → бэк отдаёт разрешённый конфиг из кэша (`getSubscriptionPageConfig`).
- **Не-браузер (VPN-клиент)**: `getSubscription` проксирует `GET api/sub/{shortUuid}[/{clientType}]`
  с панели и возвращает **сырой контент конфига** + заголовки. Т.е. и сам VPN-конфиг идёт из панели.

### Используемые эндпоинты панели (`@remnawave/backend-contract`)
`GetMetadataCommand`, `GetSubscriptionPageConfigsCommand`, `GetSubscriptionPageConfigCommand`,
`GetSubscriptionInfoByShortUuidCommand`, `GetSubpageConfigByShortUuidCommand`,
`GetUserByUsernameCommand`, `GET api/sub/{shortUuid}`. Заголовок реального IP —
`REMNAWAVE_REAL_IP_HEADER`.

### Минимум для запуска форка
`REMNAWAVE_PANEL_URL` + `REMNAWAVE_API_TOKEN` + `INTERNAL_JWT_SECRET`, доступная панель
**Remnawave >= 2.4.0** и **хотя бы один валидный subpage-config** в ней.

---

## 2B. Как это ложится на наш стек (rezeis-admin / reiwa)

Из `.env.example` обоих сервисов:
- **Remnawave** — реальная VPN-панель (подписки, ноды, subpage-configs).
- **rezeis-admin** — операторская панель НАД Remnawave (есть `REMNAWAVE_HOST/PORT`, `REMNAWAVE_TOKEN`,
  принимает вебхуки Remnawave). Источник истины по бизнес-логике (биллинг, антифрод, уведомления).
- **reiwa** — пользовательский edge (Telegram-бот + Mini App), ходит в rezeis-admin.

Сабстраница цепляется **к Remnawave напрямую**, НЕ к rezeis-admin. Поэтому есть два пути дать
оператору управлять ею «из нашей панели» (детали и рекомендация — в `REZEIS-FORK.md`, раздел
«Интеграция настроек»):

- **Путь A (нативный):** subpage смотрит в Remnawave; конфиг сабстраницы (бренд+клиенты+baseSettings)
  CRUD-им через Remnawave API прямо из rezeis-admin (токен уже есть). Тогда «скачать/вставить»
  не нужно — конфиг живой, подтягивается по UUID.
- **Путь B (расцепление):** форкаем бэкенд так, чтобы конфиг брался НЕ из Remnawave
  (`getSubscriptionPageConfigList/ByUuid`), а из локального файла или из rezeis-admin API.
  Данные подписки всё равно нужны из Remnawave (или проксировать их через rezeis-admin).
  Именно этот вариант отвечает модели «настроил в rezeis → отдал конфиг в subpage».

---

## 3. Точки кастомизации форка

Отсортировано от «безопасно/без кода» к «глубоко/с кодом».

### 3.1 `frontend/public/assets/app-config.json` — ГЛАВНАЯ точка (без кода)
Структура:
```jsonc
{
  "config": {
    "additionalLocales": ["ru","zh","fa","fr"],
    "branding": { "name": "...", "logoUrl": "...", "supportUrl": "..." }
  },
  "platforms": {
    "ios": [ { "id","name","isFeatured","urlScheme","isNeedBase64Encoding?",
               "installationStep": { "buttons":[{buttonLink,buttonText:{en,ru,...}}], "description":{...} },
               "addSubscriptionStep": {...},
               "additionalAfterAddSubscriptionStep?": { buttons,title,description },
               "connectAndUseStep": {...} } ],
    "android": [...], "windows":[...], "macos":[...], "linux":[...], "androidTV":[...], "appleTV":[...]
  }
}
```
Тут задаётся: имя/логотип/ссылка поддержки, список клиентов по платформам, deep-link
`urlScheme` для авто-добавления подписки, и локализованные тексты инструкций. **Всё многоязычное
inline** (объекты `{en, ru, zh, fa, fr, ...}`).

Для reiwa/rezeis: сюда идут наш бренд (`name`, `logoUrl`, `supportUrl`) и наш отобранный список
клиентов (напр. Happ / v2rayTun / Hiddify) с нашими текстами RU/EN.

### 3.2 Брендинг/тема (лёгкий код)
- `frontend/src/shared/ui/remnawave-logo/` — компонент логотипа.
- `frontend/src/shared/constants/theme/` (+ `overrides/card`) — Mantine-тема (цвета, радиусы, карточки).
  Здесь приводим вид к liquid-glass стилю кабинета reiwa.
- `frontend/src/global.css` — глобальные стили/фон.
- `frontend/public/assets/favicon*` — фавиконки.

### 3.3 UI-виджеты (средний код)
`frontend/src/widgets/main/`:
- `subscription-info/` — карточка статуса подписки (трафик/срок).
- `subscription-link/` — ссылка + QR + «скопировать».
- `installation-guide/` — пошаговый гайд (blocks: accordion / cards / minimal / timeline).
- `raw-keys/` — «сырые» ключи конфигов.

### 3.4 i18n
- Локали фронта: `i18next-browser-languagedetector` + inline-тексты из `app-config.json`.
- Список активных языков — `config.additionalLocales` (+ базовый `en`).
- Правило проекта (release-discipline): любая новая видимая строка должна иметь **и `ru`, и `en`**.

### 3.5 Backend (глубоко)
`backend/src/modules/` — проксирование к панели, рендер конфигов, поддержка Marzban legacy,
Cloudflare ZT/Caddy-заголовки. Трогать только при изменении логики интеграции.

---

## 4. Сборка / запуск (dev)

```bash
# Frontend (Vite dev на :3333 по умолчанию)
cd frontend && npm install && npm run start:dev
#   npm run start:build   # tsc + vite build → frontend/dist
#   npm run typecheck / npm run lint (eslint + stylelint)

# Backend (NestJS)
cd backend && npm install && npm run start:dev   # watch
#   npm run build         # nest build → dist/
#   npm run start:prod    # node dist/src/main
```
В dev backend ищет статику в `dev_frontend/`; в проде — в `/opt/app/frontend` (см. `main.ts`).

Makefile-цели: `make install`, `make bump-patch|minor|major`, `make show-versions`, `make tag-release`.

---

## 5. Docker / деплой

- **Multi-stage `Dockerfile`**: стадия `backend-build` (`npm ci` → `npm run build` → prune dev),
  финальный образ node:24-trixie-slim: копирует `dist/`, `node_modules/`, `frontend/dist/ → frontend/`,
  ставит PM2 глобально, `ENTRYPOINT docker-entrypoint.sh`, `CMD pm2-runtime start ecosystem.config.js --env production`.
- ⚠️ Важно: `Dockerfile` **НЕ собирает фронт** — он копирует уже готовый `frontend/dist/`.
  Значит CI/локальный билд должен собрать фронт (`cd frontend && npm run start:build`) **до** `docker build`.
- `docker-compose.yml` (dev) и `docker-compose-prod.yml` (образ из реестра) — деплой рядом с панелью.
- Официальный образ: `remnawave/subscription-page:latest` (docs.rw → install/subscription-page/bundled).

---

## 6. Интеграция с Remnawave Panel

- Backend авторизуется в панели через `REMNAWAVE_API_TOKEN` (Bearer) и, опционально,
  `CADDY_AUTH_API_TOKEN` (`X-Api-Key`) / Cloudflare ZT client id+secret.
- Контракты типов — пакеты `@remnawave/backend-contract` и `@remnawave/subscription-page-types`
  (в т.ч. `APP_CONFIG_ROUTE_WO_LEADING_PATH` — маршрут, исключённый из global prefix, чтобы
  `app-config.json` был доступен даже с `CUSTOM_SUB_PREFIX`).
- Панель отдаёт статус подписки/ссылки; страница только рендерит и раскладывает по клиентам.

---

## 7. Форки сообщества (обзор)

Всего у апстрима ~111 форков; подавляющее большинство — тривиальные (0 звёзд, косметика).
Заслуживающие внимания как референс:

| Форк | Что интересного |
|------|-----------------|
| **legiz-ru/material-remnawave-subscription-page** | Самый известный кастом — Material-тема/редизайн. Хороший референс по брендингу и структуре кастомизации. |
| **legiz-ru/my-remnawave** | Набор файлов/конфигов автора legiz (app-config, клиенты, роутинг-правила). |
| robocyyp/subscription-page-blue | «Blue» цветовая тема — пример минимального рескина через тему. |
| juhnsooqa/subscription-page-noclip | Вариант без «clip»-поведения. |
| GoGoButters/subscription-page, NetLynxVPN/subscription-page | «custom sub page» — точечные правки брендинга. |

Вывод: готового форка «под нас» нет — берём чистый апстрим v7.2.6 как базу, а `legiz-ru/*`
используем как источник идей по клиентам и routing-правилам (лицензия у них тоже AGPL-3.0).

---

## 8. Лицензия (AGPL-3.0) — важно

- Апстрим и большинство форков — **AGPL-3.0-only** (`LICENCE` в корне).
- AGPL требует: при предоставлении доступа к модифицированной версии **по сети** (а сабстраница
  именно сетевой сервис) — предоставлять пользователям исходный код своей версии.
- Практика для `rezeis-subpage`:
  - Сохраняем файл `LICENCE` и авторство апстрима.
  - Наш форк тоже под AGPL-3.0 (совместимость).
  - Держим ссылку на исходники нашего форка доступной (напр. ссылка в футере/`supportUrl` или репозиторий).
  - Не удаляем copyright-заголовки апстрима.

---

## 9. Риски и заметки

- `Dockerfile` не билдит фронт → легко получить образ со **старой** статикой. В нашем пайплайне
  явно собирать фронт перед docker build (добавить шаг в CI, см. git-workflow steering).
- `app-config.json` дублируется: `frontend/public/assets/` и корневой `public/assets/`. При
  кастомизации синхронизировать/определить единый источник правды.
- Много секретов в `.env` — не коммитить; в rezeis-admin уже есть дисциплина `.env.example`.
- i18n inline в JSON → легко забыть язык. Проверять наличие `ru`+`en` для каждой строки (правило проекта).
- Стек совпадает с нашим (React/Vite/TS) → можно переиспользовать liquid-glass стиль кабинета reiwa.
