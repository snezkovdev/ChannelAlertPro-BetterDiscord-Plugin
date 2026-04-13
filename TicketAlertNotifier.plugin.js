/**
 * @name TicketAlertNotifier
 * @author YourName
 * @description Отслеживает сообщения с триггером "[Тикет]:" в канале 881306138686148679 и воспроизводит звуковое уведомление.
 * @version 1.2.0
 */

module.exports = class TicketAlertNotifier {
    constructor() {
        this.CHANNEL_ID  = "881306138686148679";
        this.TRIGGER     = "[Тикет]:";
        this._handler    = null;
        this._dispatcher = null;
    }

    /* ─── Поиск FluxDispatcher всеми доступными способами ───────── */
    _getDispatcher() {
        // Способ 1: официальный ключ "actionLogger" (docs.betterdiscord.app)
        try {
            const d = BdApi.Webpack.getByKeys("actionLogger");
            if (d && typeof d.subscribe === "function") return d;
        } catch (_) {}

        // Способ 2: внутренний ключ "_dispatcher" (из MessageLoggerV2)
        try {
            const d = BdApi.Webpack.getByKeys("_dispatcher")?._dispatcher;
            if (d && typeof d.subscribe === "function") return d;
        } catch (_) {}

        // Способ 3: поиск по ключам "_subscriptions" и "_actionHandlers"
        try {
            const d = BdApi.Webpack.getByKeys("_subscriptions", "_actionHandlers");
            if (d && typeof d.subscribe === "function") return d;
        } catch (_) {}

        // Способ 4: поиск через getModule с проверкой наличия subscribe + dispatch
        try {
            const d = BdApi.Webpack.getModule(
                m => m && typeof m.subscribe === "function" &&
                     typeof m.dispatch === "function" &&
                     typeof m.unsubscribe === "function" &&
                     m._subscriptions !== undefined
            );
            if (d) return d;
        } catch (_) {}

        // Способ 5: ручной обход webpackChunkdiscord_app
        try {
            const chunkKey = Object.keys(window).find(k => k.startsWith("webpackChunk"));
            if (chunkKey) {
                const chunks = window[chunkKey];
                for (const chunk of chunks) {
                    const modules = chunk[1];
                    if (!modules) continue;
                    for (const id of Object.keys(modules)) {
                        try {
                            // пробуем получить уже кешированный модуль
                            const req = window[chunkKey].find?.(c => c)?.[2];
                            if (req) {
                                const m = req(id);
                                if (m && typeof m.subscribe === "function" &&
                                    typeof m.dispatch === "function" &&
                                    m._subscriptions !== undefined) {
                                    return m;
                                }
                            }
                        } catch (_) {}
                    }
                }
            }
        } catch (_) {}

        // Способ 6: глобальный поиск через webpackChunkdiscord_app require
        try {
            let result = null;
            const chunkKey = Object.keys(window).find(k => k.startsWith("webpackChunk"));
            if (chunkKey && window[chunkKey].push) {
                window[chunkKey].push([[Symbol()], {}, (req) => {
                    const all = req.c;
                    for (const id of Object.keys(all)) {
                        const m = all[id]?.exports;
                        if (!m) continue;
                        // проверяем сам модуль
                        if (m && typeof m.subscribe === "function" &&
                            typeof m.dispatch === "function" &&
                            m._subscriptions !== undefined) {
                            result = m;
                            break;
                        }
                        // проверяем default export
                        if (m?.default && typeof m.default.subscribe === "function" &&
                            typeof m.default.dispatch === "function" &&
                            m.default._subscriptions !== undefined) {
                            result = m.default;
                            break;
                        }
                    }
                }]);
                if (result) return result;
            }
        } catch (_) {}

        return null;
    }

    /* ─── Звук через Web Audio API ─────────────────────────────── */
    _playSound() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const tones = [
                { freq: 880, start: 0,    dur: 0.18 },
                { freq: 660, start: 0.22, dur: 0.28 },
            ];
            tones.forEach(({ freq, start, dur }) => {
                const osc  = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = "sine";
                osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
                gain.gain.setValueAtTime(0,   ctx.currentTime + start);
                gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + start + 0.02);
                gain.gain.linearRampToValueAtTime(0,   ctx.currentTime + start + dur);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(ctx.currentTime + start);
                osc.stop(ctx.currentTime  + start + dur + 0.05);
            });
            setTimeout(() => ctx.close(), 1200);
        } catch (e) {
            BdApi.Logger.error("TicketAlertNotifier", "Ошибка воспроизведения звука:", e);
        }
    }

    /* ─── Жизненный цикл ────────────────────────────────────────── */
    start() {
        this._dispatcher = this._getDispatcher();

        if (!this._dispatcher) {
            BdApi.UI.showToast(
                "TicketAlertNotifier: не удалось найти Dispatcher. " +
                "Откройте DevTools (Ctrl+Shift+I) и проверьте консоль.",
                { type: "error", timeout: 8000 }
            );
            BdApi.Logger.error(
                "TicketAlertNotifier",
                "FluxDispatcher не найден ни одним из методов. " +
                "Попробуйте перезапустить Discord и включить плагин снова."
            );
            return;
        }

        this._handler = (event) => {
            try {
                const msg = event.message;
                if (!msg) return;
                if (msg.channel_id !== this.CHANNEL_ID) return;
                if (!msg.content || !msg.content.includes(this.TRIGGER)) return;

                this._playSound();
                BdApi.UI.showToast(
                    `🎫 Тикет: ${msg.content.slice(0, 80)}`,
                    { type: "info", timeout: 6000 }
                );
                BdApi.Logger.info("TicketAlertNotifier", "Триггер сработал:", msg.content);
            } catch (e) {
                BdApi.Logger.error("TicketAlertNotifier", "Ошибка в обработчике:", e);
            }
        };

        this._dispatcher.subscribe("MESSAGE_CREATE", this._handler);
        BdApi.Logger.info("TicketAlertNotifier", "Плагин запущен. Dispatcher найден.");
        BdApi.UI.showToast("✅ TicketAlertNotifier запущен", { type: "success", timeout: 3000 });
    }

    stop() {
        try {
            if (this._dispatcher && this._handler) {
                this._dispatcher.unsubscribe("MESSAGE_CREATE", this._handler);
            }
        } catch (e) {
            BdApi.Logger.error("TicketAlertNotifier", "Ошибка при остановке:", e);
        }
        this._handler    = null;
        this._dispatcher = null;
        BdApi.Logger.info("TicketAlertNotifier", "Плагин остановлен.");
    }
};
