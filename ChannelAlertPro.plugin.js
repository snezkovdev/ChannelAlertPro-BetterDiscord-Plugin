/**
 * @name ChannelAlertPro
 * @description Мониторинг сообщений в нескольких каналах Discord с гибкими триггерами и звуковыми уведомлениями. Поддержка загрузки собственных звуков.
 * @version 2.0.0
 * @author ChannelAlertPro
 */

'use strict';

// ─── Встроенные звуки (Base64 WAV) ────────────────────────────────────────────
// Генерируем программно через Web Audio API — не нужны файлы

function generateBeepB64(freq1 = 880, freq2 = 660, duration = 0.18, type = 'sine') {
    const sampleRate = 44100;
    const numSamples = Math.floor(sampleRate * duration * 2);
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);

    // WAV header
    const writeStr = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, numSamples * 2, true);

    const half = Math.floor(numSamples / 2);
    for (let i = 0; i < numSamples; i++) {
        const freq = i < half ? freq1 : freq2;
        const t = i / sampleRate;
        const envelope = i < 512 ? i / 512 : i > numSamples - 512 ? (numSamples - i) / 512 : 1;
        let sample;
        if (type === 'square') sample = Math.sign(Math.sin(2 * Math.PI * freq * t));
        else if (type === 'sawtooth') sample = 2 * ((freq * t) % 1) - 1;
        else sample = Math.sin(2 * Math.PI * freq * t);
        view.setInt16(44 + i * 2, Math.round(sample * envelope * 28000), true);
    }

    let bin = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
}

// ─── Предустановленные звуки ───────────────────────────────────────────────────
const PRESET_SOUNDS = {
    ding:    { label: '🔔 Динь',         freq1: 880,  freq2: 1100, type: 'sine',     dur: 0.22 },
    alert:   { label: '🚨 Тревога',      freq1: 660,  freq2: 880,  type: 'sine',     dur: 0.20 },
    pop:     { label: '💬 Поп',          freq1: 1200, freq2: 900,  type: 'sine',     dur: 0.10 },
    chime:   { label: '🎵 Колокол',      freq1: 523,  freq2: 784,  type: 'sine',     dur: 0.30 },
    blip:    { label: '📟 Блип',         freq1: 1000, freq2: 1000, type: 'square',   dur: 0.12 },
    urgent:  { label: '⚡ Срочно',       freq1: 440,  freq2: 880,  type: 'square',   dur: 0.25 },
    soft:    { label: '🌙 Мягкий',       freq1: 698,  freq2: 523,  type: 'sine',     dur: 0.28 },
    retro:   { label: '👾 Ретро',        freq1: 800,  freq2: 600,  type: 'sawtooth', dur: 0.15 },
};

// ─── Хранилище данных ──────────────────────────────────────────────────────────
const DEFAULT_RULE = () => ({
    id:         Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name:       'Новое правило',
    enabled:    true,
    channelId:  '',
    trigger:    '',
    matchCase:  false,
    sound:      'ding',
    customB64:  null,
    volume:     0.8,
    showToast:  true,
});

// ─── Утилита: найти FluxDispatcher ────────────────────────────────────────────
function findDispatcher() {
    const tries = [
        () => BdApi.Webpack.getByKeys('_actionHandlers', '_subscriptions'),
        () => BdApi.Webpack.getByKeys('actionLogger'),
        () => BdApi.Webpack.getByKeys('_dispatcher')?._dispatcher,
        () => BdApi.Webpack.getModule(m => m && typeof m.subscribe === 'function' && typeof m.dispatch === 'function' && m._subscriptions),
        () => {
            const chunk = window.webpackChunkdiscord_app;
            if (!chunk) return null;
            let found = null;
            const req = chunk.push([[Symbol()], {}, r => { found = r; }]);
            chunk.pop();
            if (!found) return null;
            return Object.values(found.c || {}).map(m => m?.exports).find(
                e => e && typeof e.subscribe === 'function' && typeof e.dispatch === 'function' && e._subscriptions
            );
        },
    ];
    for (const fn of tries) {
        try { const r = fn(); if (r && typeof r.subscribe === 'function') return r; } catch (_) {}
    }
    return null;
}

// ─── Воспроизведение звука ────────────────────────────────────────────────────
function playSound(rule) {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();

        // Если есть кастомный Base64 — играем его
        if (rule.customB64) {
            const bin = atob(rule.customB64);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            ctx.decodeAudioData(bytes.buffer, (decoded) => {
                const src = ctx.createBufferSource();
                const gain = ctx.createGain();
                gain.gain.value = rule.volume ?? 0.8;
                src.buffer = decoded;
                src.connect(gain);
                gain.connect(ctx.destination);
                src.start();
                src.onended = () => ctx.close();
            });
            return;
        }

        // Иначе генерируем встроенный звук
        const preset = PRESET_SOUNDS[rule.sound] || PRESET_SOUNDS.ding;
        const b64 = generateBeepB64(preset.freq1, preset.freq2, preset.dur, preset.type);
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        ctx.decodeAudioData(bytes.buffer, (decoded) => {
            const src = ctx.createBufferSource();
            const gain = ctx.createGain();
            gain.gain.value = rule.volume ?? 0.8;
            src.buffer = decoded;
            src.connect(gain);
            gain.connect(ctx.destination);
            src.start();
            src.onended = () => ctx.close();
        });
    } catch (e) {
        console.error('[ChannelAlertPro] Ошибка звука:', e);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── Панель настроек (Settings Panel) ─────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
function buildSettingsPanel(rules, saveRules) {
    const el = document.createElement('div');
    el.style.cssText = `
        font-family: 'gg sans', 'Noto Sans', Whitney, sans-serif;
        color: #dcddde;
        padding: 8px 0;
    `;

    const css = `
        .cap-panel * { box-sizing: border-box; }
        .cap-panel { display: flex; flex-direction: column; gap: 12px; }

        .cap-rule {
            background: #2b2d31;
            border: 1px solid #1e1f22;
            border-radius: 10px;
            overflow: hidden;
            transition: border-color .15s;
        }
        .cap-rule:hover { border-color: #5865f2; }
        .cap-rule.disabled { opacity: 0.55; }

        .cap-rule-header {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 14px;
            background: #313338;
            cursor: pointer;
            user-select: none;
        }
        .cap-rule-header:hover { background: #383a40; }

        .cap-rule-name-input {
            flex: 1;
            background: transparent;
            border: none;
            outline: none;
            font-size: 15px;
            font-weight: 600;
            color: #fff;
            cursor: text;
        }
        .cap-rule-name-input::placeholder { color: #72767d; }

        .cap-toggle {
            position: relative;
            width: 38px; height: 20px;
            flex-shrink: 0;
        }
        .cap-toggle input { opacity: 0; width: 0; height: 0; position: absolute; }
        .cap-toggle-slider {
            position: absolute; inset: 0;
            background: #4f545c;
            border-radius: 20px;
            cursor: pointer;
            transition: background .2s;
        }
        .cap-toggle-slider::before {
            content: '';
            position: absolute;
            width: 14px; height: 14px;
            left: 3px; top: 3px;
            background: #fff;
            border-radius: 50%;
            transition: transform .2s;
        }
        .cap-toggle input:checked + .cap-toggle-slider { background: #5865f2; }
        .cap-toggle input:checked + .cap-toggle-slider::before { transform: translateX(18px); }

        .cap-chevron {
            font-size: 12px;
            color: #72767d;
            transition: transform .2s;
            flex-shrink: 0;
        }
        .cap-chevron.open { transform: rotate(180deg); }

        .cap-rule-body {
            padding: 14px;
            display: none;
            flex-direction: column;
            gap: 12px;
        }
        .cap-rule-body.open { display: flex; }

        .cap-field { display: flex; flex-direction: column; gap: 4px; }
        .cap-label {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: .04em;
            color: #b5bac1;
        }
        .cap-input {
            background: #1e1f22;
            border: 1px solid #3f4147;
            border-radius: 6px;
            color: #dcddde;
            font-size: 14px;
            padding: 7px 10px;
            outline: none;
            width: 100%;
            transition: border-color .15s;
        }
        .cap-input:focus { border-color: #5865f2; }
        .cap-input::placeholder { color: #4f545c; }

        .cap-row { display: flex; gap: 10px; align-items: flex-end; }
        .cap-row .cap-field { flex: 1; }

        .cap-sound-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 6px;
        }
        .cap-sound-btn {
            background: #1e1f22;
            border: 1.5px solid #3f4147;
            border-radius: 7px;
            color: #b5bac1;
            font-size: 12px;
            padding: 6px 4px;
            cursor: pointer;
            text-align: center;
            transition: all .15s;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .cap-sound-btn:hover { border-color: #5865f2; color: #fff; background: #27293d; }
        .cap-sound-btn.active { border-color: #5865f2; background: #3b3fa8; color: #fff; }
        .cap-sound-btn.custom-active { border-color: #57f287; background: #1a3d2b; color: #57f287; }

        .cap-volume-row { display: flex; align-items: center; gap: 10px; }
        .cap-volume-row input[type=range] {
            flex: 1;
            accent-color: #5865f2;
            height: 4px;
        }
        .cap-volume-val {
            font-size: 12px;
            color: #5865f2;
            font-weight: 700;
            min-width: 36px;
            text-align: right;
        }

        .cap-custom-area {
            background: #1e1f22;
            border: 1.5px dashed #3f4147;
            border-radius: 8px;
            padding: 10px 12px;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .cap-custom-area label {
            font-size: 12px; color: #b5bac1;
        }
        .cap-file-row { display: flex; gap: 8px; align-items: center; }
        .cap-btn {
            background: #4f545c;
            border: none;
            border-radius: 6px;
            color: #fff;
            font-size: 12px;
            padding: 6px 12px;
            cursor: pointer;
            transition: background .15s;
            white-space: nowrap;
        }
        .cap-btn:hover { background: #5d6269; }
        .cap-btn.danger { background: #ed4245; }
        .cap-btn.danger:hover { background: #c03537; }
        .cap-btn.success { background: #57f287; color: #000; }
        .cap-btn.success:hover { background: #3cc76e; }
        .cap-btn.primary { background: #5865f2; }
        .cap-btn.primary:hover { background: #4752c4; }

        .cap-filename { font-size: 12px; color: #57f287; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 160px; }

        .cap-check-row { display: flex; align-items: center; gap: 8px; }
        .cap-check-row input[type=checkbox] { accent-color: #5865f2; width: 16px; height: 16px; cursor: pointer; }
        .cap-check-row label { font-size: 13px; color: #dcddde; cursor: pointer; }

        .cap-actions { display: flex; justify-content: space-between; align-items: center; padding-top: 6px; border-top: 1px solid #3f4147; margin-top: 4px; }

        .cap-add-btn {
            display: flex; align-items: center; justify-content: center; gap: 8px;
            background: #313338;
            border: 1.5px dashed #5865f2;
            border-radius: 10px;
            color: #5865f2;
            font-size: 14px;
            font-weight: 600;
            padding: 12px;
            cursor: pointer;
            transition: all .15s;
        }
        .cap-add-btn:hover { background: #2a2c41; color: #7289da; }

        .cap-status-dot {
            width: 8px; height: 8px;
            border-radius: 50%;
            background: #57f287;
            flex-shrink: 0;
        }
        .cap-status-dot.off { background: #ed4245; }

        .cap-hint { font-size: 11px; color: #72767d; margin-top: 2px; }

        .cap-sep { height: 1px; background: #3f4147; margin: 2px 0; }
    `;

    const styleEl = document.createElement('style');
    styleEl.textContent = css;
    el.appendChild(styleEl);

    const panel = document.createElement('div');
    panel.className = 'cap-panel';
    el.appendChild(panel);

    // ── Рендер всех правил ───────────────────────────────────────────
    function renderAll() {
        panel.innerHTML = '';

        rules.forEach((rule, idx) => {
            const card = document.createElement('div');
            card.className = 'cap-rule' + (rule.enabled ? '' : ' disabled');

            // ── Header ──
            const header = document.createElement('div');
            header.className = 'cap-rule-header';

            // Статус-точка
            const dot = document.createElement('div');
            dot.className = 'cap-status-dot' + (rule.enabled ? '' : ' off');

            // Название
            const nameInput = document.createElement('input');
            nameInput.className = 'cap-rule-name-input';
            nameInput.placeholder = 'Название правила';
            nameInput.value = rule.name;
            nameInput.addEventListener('click', e => e.stopPropagation());
            nameInput.addEventListener('change', () => { rule.name = nameInput.value; saveRules(); });

            // Тоггл
            const toggleWrap = document.createElement('label');
            toggleWrap.className = 'cap-toggle';
            toggleWrap.addEventListener('click', e => e.stopPropagation());
            const toggleInput = document.createElement('input');
            toggleInput.type = 'checkbox';
            toggleInput.checked = rule.enabled;
            toggleInput.addEventListener('change', () => {
                rule.enabled = toggleInput.checked;
                card.className = 'cap-rule' + (rule.enabled ? '' : ' disabled');
                dot.className = 'cap-status-dot' + (rule.enabled ? '' : ' off');
                saveRules();
            });
            const toggleSlider = document.createElement('span');
            toggleSlider.className = 'cap-toggle-slider';
            toggleWrap.append(toggleInput, toggleSlider);

            // Шеврон
            const chevron = document.createElement('span');
            chevron.className = 'cap-chevron';
            chevron.textContent = '▼';

            header.append(dot, nameInput, toggleWrap, chevron);

            // ── Body ──
            const body = document.createElement('div');
            body.className = 'cap-rule-body';

            // Открыть/закрыть
            let isOpen = false;
            header.addEventListener('click', () => {
                isOpen = !isOpen;
                body.classList.toggle('open', isOpen);
                chevron.classList.toggle('open', isOpen);
            });

            // ── Channel ID ──
            const fieldChannel = document.createElement('div');
            fieldChannel.className = 'cap-field';
            const labelChannel = document.createElement('div');
            labelChannel.className = 'cap-label';
            labelChannel.textContent = 'ID канала';
            const inputChannel = document.createElement('input');
            inputChannel.className = 'cap-input';
            inputChannel.placeholder = 'Например: 881306138686148679';
            inputChannel.value = rule.channelId;
            inputChannel.addEventListener('change', () => { rule.channelId = inputChannel.value.trim(); saveRules(); });
            const hintChannel = document.createElement('div');
            hintChannel.className = 'cap-hint';
            hintChannel.textContent = 'ПКМ на канале → Копировать ID (нужен режим разработчика)';
            fieldChannel.append(labelChannel, inputChannel, hintChannel);

            // ── Trigger ──
            const fieldTrigger = document.createElement('div');
            fieldTrigger.className = 'cap-field';
            const labelTrigger = document.createElement('div');
            labelTrigger.className = 'cap-label';
            labelTrigger.textContent = 'Текст-триггер';
            const inputTrigger = document.createElement('input');
            inputTrigger.className = 'cap-input';
            inputTrigger.placeholder = 'Например: [Тикет]:';
            inputTrigger.value = rule.trigger;
            inputTrigger.addEventListener('change', () => { rule.trigger = inputTrigger.value; saveRules(); });
            const checkCase = document.createElement('div');
            checkCase.className = 'cap-check-row';
            const cbCase = document.createElement('input');
            cbCase.type = 'checkbox';
            cbCase.id = `matchcase-${rule.id}`;
            cbCase.checked = rule.matchCase;
            cbCase.addEventListener('change', () => { rule.matchCase = cbCase.checked; saveRules(); });
            const lbCase = document.createElement('label');
            lbCase.setAttribute('for', `matchcase-${rule.id}`);
            lbCase.textContent = 'Учитывать регистр';
            checkCase.append(cbCase, lbCase);
            fieldTrigger.append(labelTrigger, inputTrigger, checkCase);

            // ── Sound selector ──
            const fieldSound = document.createElement('div');
            fieldSound.className = 'cap-field';
            const labelSound = document.createElement('div');
            labelSound.className = 'cap-label';
            labelSound.textContent = 'Звук уведомления';
            const soundGrid = document.createElement('div');
            soundGrid.className = 'cap-sound-grid';

            let activeSoundBtns = {};

            Object.entries(PRESET_SOUNDS).forEach(([key, preset]) => {
                const btn = document.createElement('button');
                btn.className = 'cap-sound-btn' + (rule.sound === key && !rule.customB64 ? ' active' : '');
                btn.textContent = preset.label;
                activeSoundBtns[key] = btn;

                btn.addEventListener('click', () => {
                    rule.sound = key;
                    rule.customB64 = null;
                    saveRules();
                    // Обновляем вид
                    Object.values(activeSoundBtns).forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    if (customBtn) customBtn.classList.remove('custom-active');
                    filenameSpan.textContent = '';
                    // Предпрослушивание
                    playSound(rule);
                });

                soundGrid.appendChild(btn);
            });

            fieldSound.append(labelSound, soundGrid);

            // ── Кастомный звук ──
            const customArea = document.createElement('div');
            customArea.className = 'cap-custom-area';
            const customLabel = document.createElement('label');
            customLabel.textContent = '🎵 Загрузить свой звук (MP3 / WAV / OGG)';

            const fileRow = document.createElement('div');
            fileRow.className = 'cap-file-row';

            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'audio/*';
            fileInput.style.display = 'none';

            const uploadBtn = document.createElement('button');
            uploadBtn.className = 'cap-btn';
            uploadBtn.textContent = '📂 Выбрать файл';

            const filenameSpan = document.createElement('span');
            filenameSpan.className = 'cap-filename';
            filenameSpan.textContent = rule.customB64 ? '✓ Загружен' : '';

            let customBtn = null;

            uploadBtn.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', () => {
                const file = fileInput.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (e) => {
                    const full = e.target.result; // data:audio/xxx;base64,XXXX
                    rule.customB64 = full.split(',')[1];
                    rule.sound = '_custom';
                    saveRules();
                    filenameSpan.textContent = file.name;
                    Object.values(activeSoundBtns).forEach(b => b.classList.remove('active'));
                    if (customBtn) customBtn.classList.add('custom-active');
                    playSound(rule);
                };
                reader.readAsDataURL(file);
            });

            const clearCustomBtn = document.createElement('button');
            clearCustomBtn.className = 'cap-btn danger';
            clearCustomBtn.textContent = '✕';
            clearCustomBtn.title = 'Удалить кастомный звук';
            clearCustomBtn.style.padding = '6px 10px';
            clearCustomBtn.addEventListener('click', () => {
                rule.customB64 = null;
                rule.sound = 'ding';
                saveRules();
                filenameSpan.textContent = '';
                if (customBtn) customBtn.classList.remove('custom-active');
                if (activeSoundBtns['ding']) {
                    Object.values(activeSoundBtns).forEach(b => b.classList.remove('active'));
                    activeSoundBtns['ding'].classList.add('active');
                }
            });

            fileRow.append(fileInput, uploadBtn, filenameSpan, clearCustomBtn);

            // Кнопка "Свой звук" в гриде
            const customSoundBtn = document.createElement('button');
            customSoundBtn.className = 'cap-sound-btn' + (rule.customB64 ? ' custom-active' : '');
            customSoundBtn.textContent = '📁 Свой';
            customSoundBtn.style.gridColumn = 'span 4';
            customSoundBtn.addEventListener('click', () => fileInput.click());
            customBtn = customSoundBtn;
            soundGrid.appendChild(customSoundBtn);

            customArea.append(customLabel, fileRow);

            // ── Громкость ──
            const fieldVol = document.createElement('div');
            fieldVol.className = 'cap-field';
            const labelVol = document.createElement('div');
            labelVol.className = 'cap-label';
            labelVol.textContent = 'Громкость';
            const volRow = document.createElement('div');
            volRow.className = 'cap-volume-row';
            const volRange = document.createElement('input');
            volRange.type = 'range';
            volRange.min = 0; volRange.max = 1; volRange.step = 0.05;
            volRange.value = rule.volume ?? 0.8;
            const volVal = document.createElement('span');
            volVal.className = 'cap-volume-val';
            volVal.textContent = Math.round((rule.volume ?? 0.8) * 100) + '%';
            volRange.addEventListener('input', () => {
                rule.volume = parseFloat(volRange.value);
                volVal.textContent = Math.round(rule.volume * 100) + '%';
                saveRules();
            });
            volRow.append(volRange, volVal);
            fieldVol.append(labelVol, volRow);

            // ── Toast ──
            const toastRow = document.createElement('div');
            toastRow.className = 'cap-check-row';
            const cbToast = document.createElement('input');
            cbToast.type = 'checkbox';
            cbToast.id = `toast-${rule.id}`;
            cbToast.checked = rule.showToast;
            cbToast.addEventListener('change', () => { rule.showToast = cbToast.checked; saveRules(); });
            const lbToast = document.createElement('label');
            lbToast.setAttribute('for', `toast-${rule.id}`);
            lbToast.textContent = 'Показывать всплывающее уведомление (Toast)';
            toastRow.append(cbToast, lbToast);

            // ── Кнопки действий ──
            const actions = document.createElement('div');
            actions.className = 'cap-actions';

            const testBtn = document.createElement('button');
            testBtn.className = 'cap-btn success';
            testBtn.textContent = '▶ Тест звука';
            testBtn.addEventListener('click', () => playSound(rule));

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'cap-btn danger';
            deleteBtn.textContent = '🗑 Удалить правило';
            deleteBtn.addEventListener('click', () => {
                rules.splice(idx, 1);
                saveRules();
                renderAll();
            });

            actions.append(testBtn, deleteBtn);

            body.append(
                fieldChannel,
                fieldTrigger,
                fieldSound,
                customArea,
                fieldVol,
                toastRow,
                document.createElement('div'), // sep
                actions,
            );
            body.querySelector('div:last-of-type').className = 'cap-sep';

            card.append(header, body);
            panel.appendChild(card);
        });

        // ── Кнопка "Добавить" ──
        const addBtn = document.createElement('div');
        addBtn.className = 'cap-add-btn';
        addBtn.innerHTML = '<span style="font-size:20px">+</span> Добавить правило';
        addBtn.addEventListener('click', () => {
            rules.push(DEFAULT_RULE());
            saveRules();
            renderAll();
            // Автооткрыть последнее правило
            const cards = panel.querySelectorAll('.cap-rule');
            const lastCard = cards[cards.length - 2]; // последнее правило (не кнопка)
            if (lastCard) lastCard.querySelector('.cap-rule-header')?.click();
        });
        panel.appendChild(addBtn);
    }

    renderAll();
    return el;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── Основной класс плагина ────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
module.exports = class ChannelAlertPro {
    constructor(meta) {
        this.meta = meta;
        this._handler = null;
        this._dispatcher = null;
    }

    // Загрузить правила из хранилища BD
    get rules() {
        return BdApi.Data.load(this.meta.name, 'rules') || [];
    }

    saveRules(rules) {
        BdApi.Data.save(this.meta.name, 'rules', rules);
    }

    start() {
        this._dispatcher = findDispatcher();

        if (!this._dispatcher) {
            BdApi.UI.showToast('⚠️ ChannelAlertPro: FluxDispatcher не найден. Откройте консоль для деталей.', { type: 'error', timeout: 6000 });
            console.error('[ChannelAlertPro] Не удалось найти FluxDispatcher. Попробуйте перезапустить Discord.');
            return;
        }

        this._handler = (event) => {
            const msg = event?.message;
            if (!msg?.channel_id || !msg?.content) return;

            const rules = this.rules;
            for (const rule of rules) {
                if (!rule.enabled) continue;
                if (!rule.channelId || !rule.trigger) continue;
                if (msg.channel_id !== rule.channelId) continue;

                const content = rule.matchCase ? msg.content : msg.content.toLowerCase();
                const trigger = rule.matchCase ? rule.trigger : rule.trigger.toLowerCase();

                if (content.includes(trigger)) {
                    playSound(rule);
                    if (rule.showToast) {
                        const short = msg.content.length > 60 ? msg.content.slice(0, 60) + '…' : msg.content;
                        BdApi.UI.showToast(`🔔 ${rule.name}: ${short}`, { type: 'info', timeout: 5000 });
                    }
                    console.log(`[ChannelAlertPro] Сработало правило "${rule.name}" | Канал: ${msg.channel_id} | Триггер: ${rule.trigger}`);
                }
            }
        };

        this._dispatcher.subscribe('MESSAGE_CREATE', this._handler);
        BdApi.UI.showToast('✅ ChannelAlertPro запущен', { type: 'success', timeout: 2500 });
        console.log('[ChannelAlertPro] Плагин запущен. Правил загружено:', this.rules.length);
    }

    stop() {
        if (this._dispatcher && this._handler) {
            this._dispatcher.unsubscribe('MESSAGE_CREATE', this._handler);
        }
        this._handler = null;
        this._dispatcher = null;
        BdApi.UI.showToast('⛔ ChannelAlertPro остановлен', { type: 'warning', timeout: 2500 });
        console.log('[ChannelAlertPro] Плагин остановлен.');
    }

    getSettingsPanel() {
        // Получаем живой массив правил
        const rules = this.rules;
        const saveRules = () => this.saveRules(rules);
        return buildSettingsPanel(rules, saveRules);
    }
};
