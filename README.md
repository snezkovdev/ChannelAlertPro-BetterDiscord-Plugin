# 🔔 ChannelAlertPro — BetterDiscord Plugin

<div align="center">

![Version](https://img.shields.io/badge/version-2.0.0-5865F2?style=for-the-badge&logo=discord&logoColor=white)
![BetterDiscord](https://img.shields.io/badge/BetterDiscord-compatible-43b581?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey?style=for-the-badge)

**Мониторинг сообщений в нескольких каналах Discord с гибкими триггерами и звуковыми уведомлениями**

[📥 Скачать плагин](#-установка) • [🐛 Сообщить об ошибке](../../issues/new?template=bug_report.md) • [💡 Предложить идею](../../issues/new?template=feature_request.md)

</div>

---

## ✨ Возможности

- 🗂 **Несколько правил** — создавайте неограниченное количество пар «канал + триггер»
- 🔊 **8 встроенных звуков** — Динь, Тревога, Поп, Колокол, Блип, Срочно, Мягкий, Ретро
- 📁 **Свой звук** — загрузите любой MP3 / WAV / OGG прямо в настройки плагина
- 🔉 **Громкость** — индивидуальный слайдер 0–100% для каждого правила
- 🔤 **Регистр** — опциональный чувствительный поиск триггера
- 💬 **Toast-уведомление** — всплывашка Discord при срабатывании
- 🔛 **Вкл/Выкл по правилу** — каждое правило можно отключить отдельно
- 💾 **Автосохранение** — настройки хранятся через `BdApi.Data` и не теряются
- 🛡 **Надёжный поиск Dispatcher** — 6 методов fallback, работает на всех версиях BD

---

## 📸 Скриншоты

> Панель настроек плагина в Discord:

```
┌─────────────────────────────────────────────────┐
│  🔔 ChannelAlertPro                             │
│  ─────────────────────────────────────────────  │
│  ┌─ Правило 1 ────────────────────── 🔛 ✏ 🗑 ─┐ │
│  │ Канал ID: 881306138686148679                │ │
│  │ Триггер:  [Тикет]:                         │ │
│  │ Звук:     🔔 Динь        Громкость: ████░  │ │
│  └─────────────────────────────────────────────┘ │
│                                                  │
│  ┌─ Правило 2 ────────────────────── 🔛 ✏ 🗑 ─┐ │
│  │ Канал ID: 123456789012345678                │ │
│  │ Триггер:  СРОЧНО                           │ │
│  │ Звук:     🚨 Тревога     Громкость: ██████ │ │
│  └─────────────────────────────────────────────┘ │
│                                                  │
│  [ + Добавить правило ]                          │
└─────────────────────────────────────────────────┘
```

---

## 📥 Установка

### Способ 1 — Прямое скачивание

1. Скачайте [`ChannelAlertPro.plugin.js`](../../raw/main/ChannelAlertPro.plugin.js)
2. Поместите файл в папку плагинов BetterDiscord:

| ОС | Путь |
|----|----|
| **Windows** | `%APPDATA%\BetterDiscord\plugins\` |
| **macOS** | `~/Library/Application Support/BetterDiscord/plugins/` |
| **Linux** | `~/.config/BetterDiscord/plugins/` |

3. Откройте Discord → ⚙️ Настройки → **BetterDiscord → Plugins**
4. Найдите `ChannelAlertPro` и нажмите переключатель ✅

### Способ 2 — Через Git

```bash
# Windows
git clone https://github.com/YOUR_USERNAME/ChannelAlertPro.git
copy ChannelAlertPro\ChannelAlertPro.plugin.js %APPDATA%\BetterDiscord\plugins\

# macOS / Linux
git clone https://github.com/YOUR_USERNAME/ChannelAlertPro.git
cp ChannelAlertPro/ChannelAlertPro.plugin.js ~/Library/Application\ Support/BetterDiscord/plugins/
```

> ⚠️ Требуется установленный [BetterDiscord](https://betterdiscord.app) и десктопный Discord

---

## ⚙️ Настройка

### Как узнать ID канала

1. В Discord: **Настройки → Расширенные → Режим разработчика** — включить
2. ПКМ на нужном канале → **«Скопировать ID»**

### Как добавить правило

1. Настройки → ChannelAlertPro → **«+ Добавить правило»**
2. Введите:
   - **Название** — для удобной навигации (например: «Тикеты», «Срочные»)
   - **ID канала** — числовой ID канала Discord
   - **Текст-триггер** — слово или фраза для поиска в сообщении
   - **Учитывать регистр** — точное совпадение (`[Тикет]:` ≠ `[тикет]:`)
3. Выберите **звук** из списка или загрузите **свой файл** (MP3/WAV/OGG)
4. Настройте **громкость** слайдером
5. Нажмите **Сохранить**

### Загрузка своего звука

В настройках правила нажмите **📁 Свой звук** → выберите файл → звук конвертируется в Base64 и сохраняется прямо в настройках плагина, без внешних зависимостей.

---

## 🔊 Встроенные звуки

| Иконка | Название | Описание |
|--------|----------|----------|
| 🔔 | Динь | Классическое уведомление (440 → 880 Гц) |
| 🚨 | Тревога | Нарастающий тревожный сигнал |
| 💬 | Поп | Короткий мессенджерский поп |
| 🎵 | Колокол | Мягкий долгий колокол |
| 📟 | Блип | Квадратная волна (800 Гц) |
| ⚡ | Срочно | Резкий двойной сигнал |
| 🌙 | Мягкий | Тихий нисходящий тон |
| 👾 | Ретро | Пилообразный ретро-звук |

---

## 🛠 Техническое

### Совместимость

| Компонент | Версия |
|-----------|--------|
| BetterDiscord | ≥ 1.9.0 |
| Discord Desktop | Актуальная |
| Node.js | Встроенный в Electron |

### Как работает мониторинг

```
Discord WebSocket → FluxDispatcher → MESSAGE_CREATE event
                                          ↓
                              Проверка channel_id
                                          ↓
                              Поиск триггера в content
                                          ↓
                         Web Audio API → звуковое уведомление
                         BdApi.UI.showToast() → всплывашка
```

### FluxDispatcher Fallback (6 методов)

```js
BdApi.Webpack.getByKeys("actionLogger")
BdApi.Webpack.getByKeys("_dispatcher")?._dispatcher  
BdApi.Webpack.getByKeys("_subscriptions", "_actionHandlers")
BdApi.Webpack.getModule(m => m?.subscribe && m?.dispatch && m?._subscriptions)
// + 2 метода низкоуровневого обхода webpackChunkdiscord_app
```

---

## 🐛 Известные проблемы

| Проблема | Решение |
|----------|---------|
| `FluxDispatcher не найден` | Откройте консоль (Ctrl+Shift+I) и напишите в [Issues](../../issues) результат `BdApi.Webpack.getByKeys("actionLogger")` |
| Звук не воспроизводится | Проверьте, что браузер/Discord не заглушает вкладку |
| Настройки не сохраняются | Убедитесь что у BetterDiscord есть доступ к папке данных |

---

## 🤝 Вклад в проект

Pull Request'ы приветствуются! Перед отправкой:

1. Fork репозитория
2. Создайте ветку: `git checkout -b feature/my-feature`
3. Зафиксируйте: `git commit -m 'feat: add my feature'`
4. Запушьте: `git push origin feature/my-feature`
5. Откройте Pull Request

---

## 📄 Лицензия

Распространяется под лицензией **MIT**. Подробнее см. [LICENSE](LICENSE).

---

<div align="center">

Сделано с ❤️ для сообщества BetterDiscord

⭐ Поставьте звезду, если плагин оказался полезным!

</div>
