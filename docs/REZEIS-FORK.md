# rezeis-subpage — план форка и рабочий процесс

Наш форк Remnawave Subscription Page. Все наработки по сабстранице ведём здесь,
в `V:\REZEIS_ADMIN_RUID_USER\rezeis-subpage`.

Полное техническое исследование апстрима → [`REZEIS-RESEARCH.md`](./REZEIS-RESEARCH.md).

---

## Что уже сделано (bootstrap)

- Каталог `rezeis-subpage/` создан как **git-форк** апстрима.
- Клон апстрима на теге **v7.2.6** (`git clone --depth 1`), HEAD = commit `5fefecd`.
- Remote `origin` переименован в **`upstream`** → случайный `git push` НЕ уйдёт в remnawave.
- Добавлены наши доки в `docs/` (это исследование + этот план).

Проверить состояние:
```powershell
cd V:\REZEIS_ADMIN_RUID_USER\rezeis-subpage
git remote -v          # upstream -> github.com/remnawave/subscription-page
git log --oneline -1   # 5fefecd (tag 7.2.6)
```

---

## Настройка своего remote (когда будет наш репозиторий)

> Не выполнять до явной команды оператора (release-discipline).

```powershell
# полная история апстрима (клон был --depth 1)
git fetch upstream --unshallow

# наш репозиторий как origin
git remote add origin <URL-нашего-rezeis-subpage.git>
git branch -M main
# git push -u origin main   # только по команде оператора
```

Синхронизация с апстримом позже:
```powershell
git fetch upstream --tags
git merge upstream/main        # или rebase; разрешить конфликты в наших кастом-файлах
```

---

## Порядок кастомизации (рекомендуемый)

1. **Брендинг без кода** — `frontend/public/assets/app-config.json`:
   `config.branding` (name/logoUrl/supportUrl), `config.additionalLocales`, каталог `platforms.*`
   с нашими клиентами и текстами RU/EN.
2. **Тема** — `frontend/src/shared/constants/theme/**` + `global.css` → liquid-glass стиль reiwa.
3. **Логотип** — `frontend/src/shared/ui/remnawave-logo/` + `frontend/public/assets/favicon*`.
4. **Виджеты** (по необходимости) — `frontend/src/widgets/main/**`.
5. **i18n** — каждая новая видимая строка имеет `ru` И `en` (правило релиз-дисциплины).

Держать кастом-правки локализованными в наборе файлов, чтобы merge с апстримом был безболезненным.

---

## Интеграция настроек (как рулить сабстраницей «из rezeis панели»)

Сабстраница цепляется **к Remnawave напрямую** (нужны `REMNAWAVE_PANEL_URL` + `REMNAWAVE_API_TOKEN`,
панель >= 2.4.0). Сам конфиг сабстраницы (бренд + каталог клиентов + baseSettings) хранится
**в Remnawave** и подтягивается по UUID. Полный разбор — `REZEIS-RESEARCH.md` §2A. Отсюда два пути:

### Путь A — нативный (subpage ↔ Remnawave), рекомендуемый как первый шаг
- Subpage не трогаем логически: он читает subpage-config из Remnawave по `SUBPAGE_CONFIG_UUID`.
- В **rezeis-admin** делаем экран «Сабстраница»: форма бренда (name/logo/support), список клиентов
  по платформам, baseSettings — и сохраняем это в Remnawave через его API
  (`Get/Create/Update SubscriptionPageConfig`; rezeis-admin уже держит `REMNAWAVE_TOKEN`).
- Оператор настраивает всё в нашей панели → Remnawave хранит → subpage сразу отдаёт. «Скачивать/
  вставлять» вручную не нужно.
- ⚠️ Проверить в `@remnawave/backend-contract`, что есть команды **Create/Update** subpage-config
  (не только Get). Если только Get — переходим к плану B для редактирования.

### Путь B — расцепление (конфиг из rezeis, а не из Remnawave)
Ровно модель «настроил в rezeis → получил конфиг → он в subpage». Форкаем backend:
- Заменить в `modules/root/subpage-config.service.ts` источник:
  вместо `axiosService.getSubscriptionPageConfigList()/ByUuid()` — читать конфиг из
  (а) локального файла (напр. `config/subpage-config.json`, монтируется/деплоится нами), или
  (б) rezeis-admin API (rezeis становится источником истины бренда сабстраницы).
- Данные подписки (`getSubscription`, `getSubscriptionInfo`, `getSubpageConfig.webpageAllowed`)
  всё равно берутся из Remnawave — либо оставить прямой вызов панели, либо проксировать через
  rezeis-admin.
- Плюс: полный контроль, единый источник (rezeis). Минус: расходимся с апстримом → сложнее merge;
  берём на себя схему конфига (`SubscriptionPageRawConfigSchema`).

**Рекомендация:** сначала A (быстро, без расхождения с апстримом, использует уже готовую
интеграцию rezeis-admin↔Remnawave). К B переходить, только если нужно, чтобы источником истины
бренда сабстраницы была именно rezeis-панель, а не Remnawave.

---

## ✅ ВЫБРАННОЕ НАПРАВЛЕНИЕ (решение оператора): полноценный свой проект (Путь B)

Причина: в самой Remnawave-панели нормально настраивать сабстраницу неудобно. Делаем **свой
проект `rezeis-subpage` по референсу remnawave subpage**, который:
- **цепляется к Remnawave** только за данными подписки (`api/sub/...`, sub-info);
- **брендинг/настройки берёт и применяет из rezeis-admin** (наша панель — источник истины);
- визуально — liquid-glass, как остальной reiwa/rezeis-admin.

### Стек (без смены)
Backend NestJS + Frontend React 19/Mantine 9/Vite (как в референсе) — совпадает с rezeis-admin
(NestJS+Prisma+React). Референс-база уже склонирована (v7.2.6), правим точечно.

### Целевой поток данных
```
[Браузер] → rezeis-subpage (Nest) ── config ──▶ rezeis-admin API  (бренд/клиенты/baseSettings)
                     │
                     └────────── sub data ─────▶ Remnawave  (getSubscriptionInfo / api/sub/…)
[VPN-клиент] → rezeis-subpage ── proxy ─────────▶ Remnawave  (api/sub/{shortUuid}[/{client}])
rezeis-admin ── invalidate webhook ───────────▶ rezeis-subpage  (сброс кэша конфига)
```

### Что меняем в `rezeis-subpage/backend`
- `modules/root/subpage-config.service.ts`: источник конфига — **rezeis-admin**, не Remnawave.
  Убрать `getSubscriptionPageConfigList/ByUuid`; добавить fetch из rezeis-admin + кэш + TTL +
  инвалидация по вебхуку (как reiwa bot-config).
- Оставить `getSubscriptionInfo` / `getSubscription` (данные подписки из Remnawave).
- `webpageAllowed`/per-sub UUID из Remnawave — по умолчанию не нужны (конфиг наш); при желании
  оставить как доп. гейт.
- Расширить `.env`: `REZEIS_ADMIN_URL`, `REZEIS_ADMIN_TOKEN`, `REZEIS_SUBPAGE_WEBHOOK_SECRET`
  (+ существующие `REMNAWAVE_*`, `INTERNAL_JWT_SECRET`).
- Свою zod-схему конфига (перенести/адаптировать `SubscriptionPageRawConfigSchema`, чтобы не
  зависеть от `@remnawave/subscription-page-types` в части конфига).

### Что добавляем в `rezeis-admin`
- Модуль `subpage-config` (Prisma-модель: branding + platforms/apps + baseSettings + i18n).
- Экран в `web/` (liquid-glass): редактор бренда, каталог клиентов по платформам, тексты RU/EN,
  предпросмотр. Сохранение → БД.
- Публичный эндпоинт «эффективный конфиг сабстраницы» (JSON) для rezeis-subpage (по токену).
- Push invalidate в rezeis-subpage при сохранении (переиспользовать существующий webhook-механизм,
  которым admin бьёт reiwa).

### Зафиксированные решения (оператор, 2026-07-06)
1. **Данные подписки** — из Remnawave **напрямую** (100%). rezeis-admin в этот путь не вставляем.
2. **Каталог клиентов** — берём весь стандартный набор из референсного `app-config.json`
   (Happ, Stash, Streisand, Shadowrocket, Clash Mi, FlClashX, Clash Meta, v2rayTun, Hiddify и т.д.)
   **плюс добавить `incy`** ⚠️ *(уточнить точное имя/платформа клиента «incy» перед вводом данных)*.
   Оператор в панели может включать/выключать/править.
3. **Один глобальный конфиг** сабстраницы (без мультиконфига на старте).
4. **i18n — как в reiwa: `ru,en`** (базовый `en` + `ru`).
5. **Свой всё**: отдельный контейнер `rezeis-subpage` (свой Dockerfile) + свой поддомен,
   в общем docker-compose рядом с rezeis/reiwa/remnawave.

---

## Реализовано (2026-07-06) — backend: источник конфига = rezeis-admin

Слайс 1 готов и проверен (`tsc` + `eslint` зелёные на изменённых файлах):

- **Схема конфига переиспользована как есть** — `SubscriptionPageRawConfigSchema` из
  `@remnawave/subscription-page-types` (v1). Фронт потребляет тот же shape → его менять не нужно.
  Меняем только **источник** конфига.
- `modules/root/subpage-config.service.ts` — переписан: тянет конфиг из **rezeis-admin**
  (`GET {REZEIS_ADMIN_URL}/api/subpage-config/effective`, Bearer `REZEIS_ADMIN_TOKEN`),
  валидирует схемой, кэширует в памяти с TTL, фоновой refresh при устаревании, `invalidate()`.
  Убрана зависимость от Remnawave subpage-config (`getSubscriptionPageConfigList/ByUuid`, UUID-логика).
- `modules/root/default-subpage-config.ts` — **встроенный дефолт** (валидный `TSubscriptionPageRawConfig`,
  локали `en`+`ru`), отдаётся пока rezeis-admin недоступен на старте (без падения процесса).
- `modules/root/root.service.ts` — `returnWebpage` больше не зовёт Remnawave subpage-config и SRR;
  baseSettings берутся из нашего конфига; sub-data по-прежнему из Remnawave (`getSubscriptionInfo`).
- `modules/root/root.controller.ts` — `GET assets/.app-config-v2.json` отдаёт наш `getConfig()`.
- `modules/root/subpage-webhook.controller.ts` — **POST `/internal/subpage-config/invalidate`**
  (bearer `REZEIS_SUBPAGE_WEBHOOK_SECRET`, timing-safe), исключён из global prefix в `main.ts`.
- `config.schema.ts` — новые env: `REZEIS_ADMIN_URL`, `REZEIS_ADMIN_TOKEN`,
  `REZEIS_SUBPAGE_WEBHOOK_SECRET`, `SUBPAGE_CONFIG_TTL_SECONDS`. `SUBPAGE_CONFIG_UUID` удалён.
- `.env.sample` — переписан под новую модель.
- `.gitattributes` — LF для всего репо (Windows-checkout ставил CRLF, prettier ждёт LF).

---

## Реализовано (2026-07-06) — слайс 2: модуль `subpage-config` в rezeis-admin

Backend rezeis-admin (`tsc` + `eslint` зелёные, `prisma generate` ок):

- **Prisma**: модель `SubpageConfig` (singleton `key="default"`, `config Json`) +
  ручная миграция `prisma/migrations/20260706000000_subpage_config/migration.sql`.
- **Модуль** `src/modules/subpage-config/`:
  - `services/subpage-config.service.ts` — get effective (стор или дефолт) / replace (upsert singleton).
  - `services/subpage-cache-invalidator.service.ts` — POST invalidate в subpage
    (`{REZEIS_SUBPAGE_URL}/internal/subpage-config/invalidate`, Bearer `REZEIS_SUBPAGE_WEBHOOK_SECRET`,
    fire-and-forget, 3s timeout) — зеркало `ReiwaCacheInvalidatorService`.
  - `interceptors/subpage-cache-invalidate.interceptor.ts` — авто-invalidate после любой мутации.
  - `controllers/admin-subpage-config.controller.ts` — `GET/PUT /api/admin/subpage-config`
    (`AdminJwtAuthGuard` + `RbacGuard`, `@RequirePermission('subpage_config','view'|'edit')`).
  - `controllers/internal-subpage-config.controller.ts` — `GET /api/internal/subpage-config/effective`
    (`InternalAdminAuthGuard` — Bearer api-token с audience «Subpage»).
  - `subpage-config.default.ts` — дефолт (en+ru), **без AGPL-пакета**.
  - `subpage-config.validation.ts` — поверхностная zod-схема (полная валидация — на стороне subpage).
- **RBAC**: новый ресурс `subpage_config: ['view','edit']` (superadmin получит на следующем бут-сиде).
- **env**: `REZEIS_SUBPAGE_URL`, `REZEIS_SUBPAGE_WEBHOOK_SECRET` в `env.schema.ts` + `.env.example`.
- **AppModule**: `SubpageConfigModule` зарегистрирован.
- **rezeis-subpage**: путь фетча выровнен на `/api/internal/subpage-config/effective`.

### Лицензионное решение (важно)
AGPL-пакет `@remnawave/subscription-page-types` **НЕ добавляется** в rezeis-admin (проприетарный).
Полная валидация конфига — только на стороне subpage (AGPL). Admin хранит/отдаёт JSON + shallow-zod.

### Связка «токены» (как настроить)
1. В rezeis-admin: Settings → API tokens → создать токен (audience «Subpage»).
2. В `rezeis-subpage/.env`: `REZEIS_ADMIN_URL=http://rezeis:8000`, `REZEIS_ADMIN_TOKEN=<токен>`.
3. Общий секрет invalidate: одинаковый `REZEIS_SUBPAGE_WEBHOOK_SECRET` в обоих `.env`
   + `REZEIS_SUBPAGE_URL` в admin.

---

## Реализовано (2026-07-06) — слайс 3: экран-редактор в rezeis-admin web/

Frontend rezeis-admin (`tsc` + `eslint` зелёные на новых/изменённых файлах):

- `web/src/features/subpage-config/subpage-config-api.ts` — zod-схема (shallow, `.passthrough()`)
  + `subpageConfigApi` (`GET/PUT /admin/subpage-config`) + `SUBPAGE_CONFIG_KEYS`.
- `web/src/features/subpage-config/subpage-config-page.tsx` — редактор (default export, lazy):
  - вкладка «Основное»: брендинг (name/logo/support), baseSettings (meta + 2 свитча),
    uiConfig (2 селекта: infoBlock / guideBlock);
  - вкладка «Клиенты и переводы (JSON)»: полный конфиг в textarea (правка platforms/переводов/svg),
    live-валидация, блокировка сохранения при невалидном JSON;
  - Save (PUT) + Reset, баннер «отдаётся дефолт, пока не сохранён», toast’ы.
- i18n: `web/src/i18n/features/subpageConfig.{en,ru}.ts` + регистрация в `i18n.ts`
  (`I18nFeature` union + `fetchFeatureBundle`); пункт меню `adminNav.items.subpageConfig` (ru+en).
- Роут `/subpage-config` в `router.tsx` (lazy + `withFeatureBundle`); пункт меню в
  `admin-nav-config.ts` (группа configuration, иконка `Globe`, `requiredPermission subpage_config/view`).

### End-to-end готово (backend + admin UI)
Оператор правит конфиг в rezeis-admin → сохраняется в БД (`subpage_configs`) → subpage тянет его
по api-токену и ревалидирует → admin пушит invalidate при сохранении. Полный каталог клиентов пока
редактируется через вкладку JSON (визуальный per-client редактор — позже).

---

## Реализовано (2026-07-06) — слайс 4: docker/деплой + клиент incy

### Docker (self-contained)
- **`Dockerfile`** переписан self-contained: стадия `frontend-build` (npm ci + `npm run start:build`
  → `frontend/dist`) + `backend-build` + runtime. Больше НЕ нужно собирать фронт вручную до
  `docker build` (чинит footgun апстрима). Метки — Rezeis + AGPL-3.0.
- **`docker-compose.yml`** (prod, build from source): сервис `rezeis-subpage`
  (container/hostname `rezeis-subpage`), `expose 3010`, healthcheck (`kill -0 1`), mem-лимиты,
  join внешней **`remnawave-network`** — чтобы ходить к `remnawave:3000` (данные подписки) и
  `rezeis:8000` (конфиг). Наружу порт не публикуется — reverse proxy маршрутизирует поддомен.
- **`docker-compose-prod.yml`** — вариант с готовым образом (`ghcr.io/<owner>/rezeis-subpage`).

Reverse proxy (Caddy пример):
```
sub.example.com { reverse_proxy rezeis-subpage:3010 }
```

### Клиент `incy` (опознан)
- incy — кросс-платформенный клиент на Xray-core. iOS/iPadOS/macOS/Apple TV (App Store
  `id6756943388`), Android/Android TV (Google Play `llc.itdev.incy`, APK на GitHub `INCY-DEV/incy-platforms`).
- **Deep-link для добавления подписки: `incy://add/{url}`** (док: incy.gitbook.io deep-links).
  В v1-конфиге кнопка типа `subscriptionLink` с `link: "incy://add/{{SUBSCRIPTION_LINK}}"`
  (токен из `TemplateEngine`, регекс `/\{\{(\w+)\}\}/`).
- **Готовый валидный пример каталога** с incy (iOS+Android, en+ru, минимальный svgLibrary):
  `docs/examples/catalog-incy.example.json` — **проверен `SubscriptionPageRawConfigSchema` → VALID**.
  Оператор может вставить его во вкладку «Клиенты и переводы (JSON)» в rezeis-admin.

---

## Реализовано (2026-07-06) — слайс 5: полный каталог клиентов (дефолт)

- **Генератор** `backend/scripts/gen-catalog.cjs` — собирает каталог в v1-форме, **валидирует
  `SubscriptionPageRawConfigSchema`** и пишет 3 артефакта (byte-identical):
  1. `docs/examples/catalog.reference.example.json` (канонический, pretty);
  2. `backend/src/modules/root/default-subpage-config.ts` (fallback subpage);
  3. `rezeis-admin/.../subpage-config/subpage-config.default.ts` (дефолт-источник в admin).
- Встроено как `JSON.parse(<escaped string>)` → компилируется в JS (без asset-copy; `nest build`
  не копирует .json), и одинаково в обоих репозиториях.
- **Набор клиентов** (3 блока Install/Add/Connect, en+ru, deep-link или copy):
  - iOS: Happ*, incy, v2RayTun, Streisand, Shadowrocket(copy)
  - Android: Happ*, incy, v2RayTun, Hiddify, Clash Meta
  - Windows: Hiddify*, v2rayN(copy), Nekoray(copy)
  - macOS: Happ*, Hiddify, Streisand
  - Linux: Hiddify*, Nekoray(copy)  (* — featured)
- Deep-links: `happ://add/…`, `incy://add/…`, `v2raytun://import/…`, `streisand://import/…`,
  `hiddify://import/…`, `clash://install-config?url=…`; клиенты без надёжного deep-link — copyButton.
- Итог: свежая установка сразу показывает полный каталог (admin отдаёт этот дефолт, пока оператор
  не сохранит свой). Перегенерация: `cd backend && node scripts/gen-catalog.cjs`.

---

## Реализовано (2026-07-06) — слайсы 6–7: liquid-glass фронт + CI

### Слайс 6 — liquid-glass ребрендинг фронта (stylelint + tsc зелёные)
- `frontend/src/global.css` — фон под reiwa: анимированная aurora (violet/cyan/teal/blue,
  `prefers-reduced-motion` учтён), стеклянный header (`blur+saturate`, inset-хайлайт), тонированные
  info-карточки с blur + inset-хайлайтом.
- `frontend/src/shared/constants/theme/overrides/card/card.module.css` — фирменное liquid-glass
  стекло: `backdrop-blur(14px) saturate`, inset-хайлайт + мягкая тень, верхний «блик» (`::after`),
  свечение при hover. Класс-имена сохранены (компоненты не трогал).
- `.stylelintrc.json` — отключил `color-function-alias-notation` (апстрим-стиль `rgba`, чтобы и
  старый CSS проходил); поправил пред-существующие нарушения в `shared/ui/page/page.module.css`
  (`fadeIn`→`fade-in`). `stylelint '**/*.css'` → 0 ошибок; `npm run typecheck` → ок.

### Слайс 7 — CI (self-contained образ)
- `.github/workflows/build-and-push.yml` переписан под форк: job `gates` (backend `tsc`+`eslint`,
  frontend `typecheck`+`lint`) → multi-arch (amd64/arm64) `docker build` → push в
  `ghcr.io/<owner>/rezeis-subpage` (`GITHUB_TOKEN`, без внешних секретов). Триггер: тег `v*` /
  ручной. Т.к. Dockerfile self-contained — отдельная сборка фронта в CI не нужна.
- Удалён апстрим-workflow `build-and-push-dev.yml` (пушил в `remnawave` namespace + требовал
  Docker Hub секреты, триггерился на любой тег).

### Проверка сборки end-to-end (2026-07-06)
Обе стадии Dockerfile прогнаны локально (Docker daemon недоступен в этой среде, сам `docker build`
не гонялся):
- **frontend**: `tsc` (exit 0) + `vite build` → `dist/` собран (`index.html` + ассеты, наш
  liquid-glass CSS скомпилирован). `✓ built`.
- **backend**: `nest build` → `dist/src/main.js` присутствует (exit 0).
Т.е. приложение реально собирается; остаётся только сам `docker build` (запустит CI/деплой).

### Реализовано (2026-07-06) — слайс 8: визуальный редактор каталога
- `web/src/features/subpage-config/subpage-config-clients.tsx` — вкладка **«Клиенты»**: дерево
  платформа → приложение → блок → кнопка без сырого JSON. Возможности: добавить/удалить платформу
  (из известных ключей ios/android/windows/macos/linux/androidTV/appleTV), приложения (имя,
  featured, добавить/удалить), блоки (иконка из svgLibrary, цвет, title/description в ru+en),
  кнопки (тип external/subscriptionLink/copyButton, ссылка с подсказкой `{{SUBSCRIPTION_LINK}}`,
  иконка, текст ru+en). Иммутабельные правки через `structuredClone`.
- Вкладка встроена в редактор (Основное / **Клиенты** / JSON); i18n ru+en добавлены.
- `tsc` + `eslint` зелёные. JSON-вкладка остаётся для массового импорта/сложных правок.

### Реализовано (2026-07-06) — слайс 9: полное покрытие конфига в UI
- `web/src/features/subpage-config/subpage-config-assets.tsx`:
  - **Переводы** — редактор всех строк `baseTranslations` (по языкам ru/en).
  - **Иконки** — CRUD `svgLibrary` (ключ latin-only + SVG-разметка + превью, add/remove).
- Редактор теперь 5 вкладок: **Основное / Клиенты / Иконки / Переводы / JSON** — редактируется
  100% полей конфига визуально, JSON остаётся как запасной путь. i18n ru+en, `tsc`+`eslint` зелёные.

### Реализовано (2026-07-06) — слайс 10: тема subpage из панели (accent + фон)
Кросс-репо фича «визуал из rezeis», сборка end-to-end проверена (`vite build` ✓):
- **Конфиг**: добавлено поле-расширение `rezeisTheme { primaryColor, backgroundColor, accentColor }`
  (в дефолт через генератор; не входит в upstream strict-схему).
- **rezeis-admin**: во вкладке «Основное» — блок **Тема** (`subpage-config-assets.tsx` → `SubpageTheme`):
  палитра из 12 Mantine-цветов (свотчи с hex), color-picker для фона и акцента. Пишет `rezeisTheme`
  (shallow-схема `passthrough` пропускает). i18n ru+en.
- **subpage backend**: `subpage-config.service.ts` проносит `rezeisTheme` мимо strip’а strict-схемы
  (merge в кэш).
- **subpage frontend**: `shared/constants/theme/rezeis-theme.ts` (валидация: Mantine-цвет из
  allow-list + hex-регекс → защита от CSS-инъекции). `app.tsx` применяет `primaryColor` к Mantine
  (useMemo-тема) и ставит CSS-переменные `--rezeis-bg`/`--rezeis-accent` (useEffect). `global.css` +
  `card.module.css` используют эти переменные (фон, accent-слой aurora, hover-свечение карточек через
  `color-mix`). Тема применяется вживую после загрузки конфига; при отсутствии — дефолты.

**Итог**: страница `Subpage` в панели теперь гибкая и по контенту, и по визуалу — 6 вкладок:
Основное (+Тема) / Клиенты / Иконки / Переводы / JSON.

### Осталось (опционально)
- лого/фавиконки под reiwa-бренд; расширить набор клиентов (Stash, FlClashX, v2box…).
- `docker build` + деплой в общий compose (CI / VPS).

---

## Связь rezeis-admin ↔ subpage: токены и настройка (same-VPS / split-VPS)

Между admin и сабкой **два независимых канала** (у каждого своя аутентификация):

### Канал 1 — subpage → rezeis-admin (тянет конфиг)
- subpage зовёт `GET {REZEIS_ADMIN_URL}/api/internal/subpage-config/effective`
  с `Authorization: Bearer <REZEIS_ADMIN_TOKEN>`.
- Токен — это **API-токен, выпущенный в rezeis-admin** (Settings → API tokens), проверяется
  `InternalAdminAuthGuard` по таблице `api_tokens` (audience `rezeis-internal-api`, TTL 180 дней).
  Тот же механизм, что у reiwa (`REZEIS_TOKEN`).
- **Да — надо выпустить токен в панели и вставить его сабке.** Шаги:
  1. rezeis-admin → Settings → API tokens → создать (имя, напр. «Subpage»).
  2. Скопировать токен → в `rezeis-subpage/.env`: `REZEIS_ADMIN_TOKEN=<токен>`.

### Канал 2 — rezeis-admin → subpage (мгновенный invalidate при сохранении)
- admin зовёт `POST {REZEIS_SUBPAGE_URL}/internal/subpage-config/invalidate`
  с `Authorization: Bearer <REZEIS_SUBPAGE_WEBHOOK_SECRET>` (timing-safe сравнение на сабке).
- Это **общий секрет** (не API-токен): один и тот же в обоих `.env`.
  1. Сгенерировать: `openssl rand -hex 32`.
  2. `rezeis-subpage/.env` и `rezeis-admin/.env`: `REZEIS_SUBPAGE_WEBHOOK_SECRET=<секрет>`.
  3. `rezeis-admin/.env`: `REZEIS_SUBPAGE_URL=<адрес сабки>`.
- Необязателен: если не настроить — конфиг всё равно подтянется по TTL (`SUBPAGE_CONFIG_TTL_SECONDS`,
  по умолч. 300с). invalidate лишь ускоряет до ~мгновенно.

### Матрица адресов
| Переменная | Same-VPS (общий `remnawave-network`) | Split-VPS (разные хосты) |
|---|---|---|
| subpage `REZEIS_ADMIN_URL` | `http://rezeis:8000` | `https://<admin-domain>` |
| admin `REZEIS_SUBPAGE_URL` | `http://rezeis-subpage:3010` | `https://<subpage-domain>` |
| subpage `REMNAWAVE_PANEL_URL` | `http://remnawave:3000` | `https://<panel-domain>` |

### Нюанс prod (учтён в коде)
Сабка в проде включает `proxyCheckMiddleware`: **рвёт любой запрос без `X-Forwarded-For` и
`X-Forwarded-Proto: https`**. Поэтому:
- **Split-VPS**: admin ходит на `https://<subpage-domain>` через reverse-proxy сабки — заголовки
  ставит прокси, всё ок.
- **Same-VPS**: admin ходит напрямую на `rezeis-subpage:3010` (без прокси) — поэтому инвалидатор
  admin **сам добавляет** `X-Forwarded-For: 127.0.0.1` + `X-Forwarded-Proto: https`
  (см. `SubpageCacheInvalidatorService`), чтобы пройти проверку. Ничего настраивать не нужно.
- Канал 1 (subpage→admin) этой проверки не касается (это вызов admin, а не сабки).

### Итого что вставить (минимум)
`rezeis-subpage/.env`: `REMNAWAVE_PANEL_URL`, `REMNAWAVE_API_TOKEN`, `INTERNAL_JWT_SECRET`,
`REZEIS_ADMIN_URL`, `REZEIS_ADMIN_TOKEN` (+ опц. `REZEIS_SUBPAGE_WEBHOOK_SECRET`).
`rezeis-admin/.env`: `REZEIS_SUBPAGE_URL` (+ опц. `REZEIS_SUBPAGE_WEBHOOK_SECRET`).

---

## Локальная разработка

```powershell
# frontend
cd frontend; npm install; npm run start:dev      # Vite dev
cd frontend; npm run typecheck; npm run lint      # eslint + stylelint (0 warnings)
cd frontend; npm run start:build                  # tsc + vite build -> frontend/dist

# backend
cd backend; npm install; npm run start:dev        # NestJS watch
cd backend; npm run build; npm run lint
```

`.env` для backend — скопировать из `.env.sample`, заполнить `REMNAWAVE_PANEL_URL` и
`REMNAWAVE_API_TOKEN`. Секреты не коммитить.

---

## Сборка образа (важный нюанс)

`Dockerfile` **не собирает фронт**, а копирует готовый `frontend/dist/`. Поэтому пайплайн:
```powershell
cd frontend; npm run start:build     # 1) собрать фронт -> frontend/dist
cd ..; docker build -t rezeis-subpage:local .   # 2) затем образ
```
Добавить шаг сборки фронта в CI перед `docker build` (см. steering `git-workflow.md`).

---

## Лицензия / комплаенс (AGPL-3.0)

- Форк остаётся под **AGPL-3.0-only**; файл `LICENCE` и авторство апстрима не удаляем.
- Т.к. это сетевой сервис — исходники нашей версии должны быть доступны пользователям
  (ссылка в футере/`supportUrl` или публичный репозиторий).

---

## TODO (следующие шаги, по команде оператора)

- [ ] Завести собственный remote `origin` для `rezeis-subpage` и запушить базу v7.2.6.
- [ ] Прописать наш `app-config.json` (бренд reiwa + отобранные клиенты, тексты RU/EN).
- [ ] Тема liquid-glass + логотип + фавиконки.
- [ ] Ревизия `.gitignore` (убедиться, что `.env`, `dev_frontend/`, `dist/` игнорируются).
- [ ] Шаг сборки фронта в CI перед docker build.
- [ ] Стратегия синка с `upstream` (merge vs rebase) и периодичность.
