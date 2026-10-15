export const messages={
 engine:['Choose local files or PostgreSQL.','Выберите локальные файлы или PostgreSQL.'],
 confirm:['Confirm the verified migration. Existing destination data is backed up before replacement.','Подтвердите перенос с проверкой. Существующие данные целевого хранилища будут сохранены в резервной копии перед заменой.'],
 busy:['Storage setup or migration is in progress.','Идёт подготовка или перенос хранилища.'],
 unavailable:['Storage is not ready. Check the Storage plugin setup notice. Queued statistics will retry.','Хранилище ещё не готово. Проверьте уведомление плагина Storage. Статистика из очереди будет отправлена повторно.'],
 url:['The external connection must start with postgres:// or postgresql://. Leave it blank for automatic local setup.','Внешнее подключение должно начинаться с postgres:// или postgresql://. Для автоматической локальной настройки оставьте поле пустым.'],
 connection:['Cannot connect to PostgreSQL or initialize its schema. The previous storage has not been switched.','Не удалось подключиться к PostgreSQL или подготовить схему. Переключение с прежнего хранилища не выполнено.'],
 container_engine_required:['Automatic PostgreSQL + TimescaleDB setup needs running rootless Podman or Docker. Use “Prepare database runtime” on this node.','Для автоматического PostgreSQL + TimescaleDB нужен работающий Podman без root или Docker. Нажмите «Подготовить среду БД» на этом узле.'],
 file_capacity:['Local files support at most 100,000 records. Migration cancelled without deleting PostgreSQL data.','Локальные файлы вмещают до 100 000 записей. Перенос отменён, данные PostgreSQL не удалены.'],
 failed:['Migration failed. The previous storage remains selected; source data and backups have not been deleted.','Перенос не выполнен. Прежнее хранилище остаётся выбранным; исходные данные и резервные копии не удалены.'],
 ready:['Storage is ready.','Хранилище готово.'],
 setup:['Preparing PostgreSQL + TimescaleDB. Downloading the image can take several minutes.','Подготавливается PostgreSQL + TimescaleDB. Загрузка образа может занять несколько минут.'],
 migration:['Copying and verifying storage. Writes will retry; do not stop this node.','Идёт копирование и проверка хранилища. Записи будут отправлены повторно; не выключайте узел.'],
 runtime:['Approve the native system prompt on this node, then retry PostgreSQL setup.','Подтвердите системный запрос на этом узле, затем повторите настройку PostgreSQL.'],
 unsupported:['Install and start rootless Podman or Docker Desktop on this node, then click Retry. No database URL is needed.','Установите и запустите Podman без root или Docker Desktop на этом узле, затем нажмите «Повторить». Строка подключения БД не нужна.']
};
export function message(key,locale){return (messages[key]||messages.failed)[locale==='ru'?1:0]}
