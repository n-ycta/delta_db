# Delta DB
Независимый внешний плагин Node.js 22+; PostgreSQL 16 + TimescaleDB. Ядро не импортирует SQL-драйвер.

1. `POSTGRES_PASSWORD=... docker compose up -d`
2. `npm ci`; скопируйте `.env.example` в `.env`, задайте секреты.
3. Создайте токен через `delta call tokens.create` со scopes `register:storage`, `call:storage.*` и именем `storage`.
4. `npm start` выполняет идемпотентную миграцию и подключается к ядру.
5. `npm test` проверяет схемы/SQL; полный E2E требует PostgreSQL с TimescaleDB.

Контракт: `contracts/storage-v1.json`. Замена БД: реализуйте те же capabilities и назначьте `STORAGE_COMPONENT` всем потребителям. Никаких SQL-запросов в ядре или веб-UI.

Запись транзакционная, повтор `(time,id)` идемпотентен. UUID и timestamp нужно сохранять при повторе. JSONB dimensions/payload допускают данные любых плагинов; временные ряды — hypertable. Приватные документы привязаны к идентичности токена; токены должны иметь уникальные имена. `storage.query` разрешает чтение всех источников: выдавайте его только доверенным аналитикам. Срок хранения по умолчанию не ограничен; резервное копирование и retention настраиваются оператором PostgreSQL. Пароли не коммитить. Доступ снаружи — только через TLS/VPN.
