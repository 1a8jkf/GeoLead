// injected.js — roda no contexto MAIN da página (mesmo mundo que o React do WhatsApp)

(function() {
    'use strict';

    const delay = ms => new Promise(res => setTimeout(res, ms));

    function isVisible(elem) {
        if (!elem) return false;
        const rect = elem.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    function clickElement(el) {
        if (!el) return;
        el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
        el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
        el.click();
    }

    function findChatInput() {
        return document.querySelector('#main div[contenteditable="true"]') ||
               document.querySelector('div[contenteditable="true"][data-tab="10"]') ||
               document.querySelector('footer div[contenteditable="true"]');
    }

    function findVisibleSendButton() {
        const icons = document.querySelectorAll('span[data-icon="send"], span[data-testid="send"]');
        for (let i = icons.length - 1; i >= 0; i--) {
            const parent = icons[i].closest('button, div[role="button"]');
            if (parent && isVisible(parent)) return parent;
            if (isVisible(icons[i])) return icons[i];
        }

        const allBtns = document.querySelectorAll('button, div[role="button"]');
        for (let i = allBtns.length - 1; i >= 0; i--) {
            const btn = allBtns[i];
            if (!isVisible(btn)) continue;
            const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
            const title = (btn.getAttribute('title') || '').toLowerCase();
            if (aria.includes('enviar') || aria.includes('send') || title.includes('enviar') || title.includes('send')) {
                return btn;
            }
        }

        const footer = document.querySelector('footer');
        if (footer) {
            const fBtns = footer.querySelectorAll('button, div[role="button"]');
            if (fBtns.length > 0) return fBtns[fBtns.length - 1];
        }

        return null;
    }

    function findAttachButton() {
        const icons = document.querySelectorAll('span[data-icon="plus"], span[data-icon="clip"], span[data-icon="attach-menu-plus"]');
        for (let i = 0; i < icons.length; i++) {
            const parent = icons[i].closest('button, div[role="button"]');
            if (parent && isVisible(parent)) return parent;
            if (isVisible(icons[i])) return icons[i];
        }

        const allBtns = document.querySelectorAll('button, div[role="button"]');
        for (let i = 0; i < allBtns.length; i++) {
            const btn = allBtns[i];
            if (!isVisible(btn)) continue;
            const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
            const title = (btn.getAttribute('title') || '').toLowerCase();
            if (aria.includes('anexar') || aria.includes('attach') || title.includes('anexar') || title.includes('attach')) {
                return btn;
            }
        }

        const footer = document.querySelector('footer');
        if (footer) {
            const fBtns = footer.querySelectorAll('button, div[role="button"]');
            if (fBtns.length >= 3) return fBtns[1];
        }

        return null;
    }

    function findUnsupportedFileDialog() {
        const dialogs = document.querySelectorAll(
            'div[role="dialog"], div[data-testid="popup-controls"], [role="alert"], [aria-live="polite"], [aria-live="assertive"]'
        );
        for (const dialog of dialogs) {
            if (!isVisible(dialog)) continue;
            const text = (dialog.textContent || '').toLowerCase();
            const unsupported = text.includes('não é compatível') ||
                text.includes('não são compatíveis') ||
                text.includes('não suportado') ||
                text.includes('arquivo não suportado') ||
                text.includes('not supported') ||
                text.includes('unsupported file') ||
                text.includes('is not compatible') ||
                text.includes("isn't compatible") ||
                text.includes('no es compatible') ||
                text.includes('no son compatibles');
            if (unsupported) return dialog;
        }
        return null;
    }

    function closeDialog(dialog) {
        if (!dialog) return;
        const button = dialog.querySelector('button, div[role="button"]');
        if (button) {
            clickElement(button);
            return;
        }
        document.dispatchEvent(new KeyboardEvent('keydown', {
            bubbles: true,
            cancelable: true,
            key: 'Escape',
            code: 'Escape',
            keyCode: 27
        }));
    }

    async function dismissUnsupportedNotice(dialog) {
        closeDialog(dialog);
        await waitFor(() => {
            const attached = document.documentElement && document.documentElement.contains(dialog);
            return !attached || !isVisible(dialog) ? true : null;
        }, 3500);
    }

    function waitFor(fn, timeout = 15000) {
        return new Promise(resolve => {
            const result = fn();
            if (result) return resolve(result);

            let timer;
            const obs = new MutationObserver(() => {
                const r = fn();
                if (r) { obs.disconnect(); clearTimeout(timer); resolve(r); }
            });
            obs.observe(document.body, { childList: true, subtree: true });
            timer = setTimeout(() => { obs.disconnect(); resolve(null); }, timeout);
        });
    }

    async function dataURItoBlob(dataURI) {
        // Fetch em data URI preserva os bytes binários; não passamos o áudio
        // por strings/base64 manualmente para não corromper o contêiner.
        const res = await fetch(dataURI);
        return res.blob();
    }

    async function dataURItoFile(dataURI, fileName, mimeType) {
        const blob = await dataURItoBlob(dataURI);
        return new File([blob], fileName, { type: mimeType });
    }

    function detectAudioContainer(bytes) {
        if (!bytes || bytes.length < 4) return '';
        if (bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3) return 'webm';
        if (bytes[0] === 0x4F && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) return 'ogg';
        if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
            bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45) return 'wav';
        if (bytes.length >= 8 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) return 'm4a';
        if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return 'mp3';
        if (bytes[0] === 0xFF && (bytes[1] & 0xF6) === 0xF0) return 'aac';
        if (bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0) return 'mp3';
        return '';
    }

    function inferAudioContainer(attachData) {
        const type = String(attachData.type || '').toLowerCase();
        const extension = String(attachData.name || '').split('.').pop().toLowerCase();
        if (type.includes('mpeg') || extension === 'mp3') return 'mp3';
        if (type.includes('mp4') || extension === 'm4a' || extension === 'mp4') return 'm4a';
        if (type.includes('ogg') || extension === 'ogg' || extension === 'opus') return 'ogg';
        if (type.includes('aac') || extension === 'aac') return 'aac';
        if (type.includes('webm') || extension === 'webm') return 'webm';
        if (type.includes('wav') || extension === 'wav') return 'wav';
        return '';
    }

    function audioFormatInfo(container) {
        const formats = {
            mp3: { mimeType: 'audio/mpeg', extension: 'mp3', nativeMedia: true },
            m4a: { mimeType: 'audio/mp4', extension: 'm4a', nativeMedia: true },
            ogg: { mimeType: 'audio/ogg', extension: 'ogg', nativeMedia: true },
            aac: { mimeType: 'audio/aac', extension: 'aac', nativeMedia: true },
            webm: { mimeType: 'audio/webm', extension: 'webm', nativeMedia: false },
            wav: { mimeType: 'audio/wav', extension: 'wav', nativeMedia: false }
        };
        return formats[container] || null;
    }

    function fileNameWithExtension(fileName, extension) {
        const raw = String(fileName || 'audio_geolead').replace(/[\\/:*?"<>|]+/g, '_');
        const base = raw.replace(/\.[^.]+$/, '') || 'audio_geolead';
        return `${base}.${extension}`;
    }

    async function normalizeAudioAttachment(attachData) {
        const blob = await dataURItoBlob(attachData.data);
        const signature = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
        const detectedContainer = detectAudioContainer(signature);
        const container = detectedContainer || inferAudioContainer(attachData);
        const format = audioFormatInfo(container);
        if (!format) throw new Error('audio_format_unknown');

        const name = fileNameWithExtension(attachData.name, format.extension);
        return {
            blob,
            format,
            name,
            file: new File([blob], name, { type: format.mimeType })
        };
    }

    function findPreviewSendButton() {
        const icons = document.querySelectorAll('span[data-icon*="send"], span[data-testid*="send"]');
        for (let i = icons.length - 1; i >= 0; i--) {
            const parent = icons[i].closest('button, div[role="button"]');
            if (parent && isVisible(parent) && !parent.closest('footer')) return parent;
        }

        const allBtns = document.querySelectorAll('button, div[role="button"]');
        for (let i = allBtns.length - 1; i >= 0; i--) {
            const btn = allBtns[i];
            if (!isVisible(btn) || btn.closest('footer')) continue;
            const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
            const title = (btn.getAttribute('title') || '').toLowerCase();
            if (aria.includes('enviar') || aria.includes('send') || title.includes('enviar') || title.includes('send')) return btn;
        }
        return null;
    }

    function findDocumentInput(inputs) {
        return inputs.find(input => {
            const accept = (input.getAttribute('accept') || '').trim().toLowerCase();
            return accept === '*' || accept === '*/*' || accept === '';
        }) || null;
    }

    function findAudioInput(inputs) {
        return inputs.find(input => (input.getAttribute('accept') || '').toLowerCase().includes('audio')) || null;
    }

    async function putAudioInAttachmentPreview(file, preferNativeMedia) {
        const attachBtn = findAttachButton();
        if (!attachBtn) return { status: 'attach_button_missing' };

        clickElement(attachBtn);
        await delay(450);

        const fileInputs = await waitFor(() => {
            const inputs = Array.from(document.querySelectorAll('input[type="file"]'));
            return inputs.length ? inputs : null;
        }, 5000);
        if (!fileInputs) return { status: 'file_input_missing' };

        const documentInput = findDocumentInput(fileInputs);
        const audioInput = findAudioInput(fileInputs);
        const targetInput = preferNativeMedia && audioInput ? audioInput : documentInput || audioInput;
        if (!targetInput) return { status: 'file_input_missing' };

        const dt = new DataTransfer();
        dt.items.add(file);
        targetInput.files = dt.files;
        targetInput.dispatchEvent(new Event('change', { bubbles: true }));

        const validation = await waitFor(() => {
            const unsupportedDialog = findUnsupportedFileDialog();
            if (unsupportedDialog) return { status: 'unsupported', dialog: unsupportedDialog };
            const sendButton = findPreviewSendButton();
            if (sendButton) return { status: 'ready', sendButton };
            return null;
        }, 6000);

        if (validation) return validation;
        return { status: 'preview_timeout' };
    }

    async function sendAttachment(attachData, messageText) {
        let previewSendButton = null;
        if (attachData.type && attachData.type.startsWith('audio/')) {
            console.log(`GeoLead [MAIN]: Preparando áudio (${attachData.type})...`);
            let normalized;
            try {
                normalized = await normalizeAudioAttachment(attachData);
            } catch (error) {
                console.error('GeoLead [MAIN]: Não foi possível reconhecer o contêiner real do áudio.', error);
                return false;
            }

            // Primeiro preserva o tipo de mídia correto. Se o WhatsApp recusar,
            // reabre o menu e envia os mesmos bytes pelo seletor de documento.
            const primaryFile = normalized.format.nativeMedia
                ? normalized.file
                : new File([normalized.blob], normalized.name, { type: 'application/octet-stream' });
            let attempt = await putAudioInAttachmentPreview(primaryFile, normalized.format.nativeMedia);
            if (attempt.status === 'unsupported') {
                await dismissUnsupportedNotice(attempt.dialog);
                if (primaryFile.type !== 'application/octet-stream') {
                    const documentFile = new File([normalized.blob], normalized.name, { type: 'application/octet-stream' });
                    attempt = await putAudioInAttachmentPreview(documentFile, false);
                }
            }

            if (attempt.status === 'unsupported') {
                closeDialog(attempt.dialog);
                console.error('GeoLead [MAIN]: O WhatsApp recusou o áudio também como documento.');
                return false;
            }
            if (attempt.status !== 'ready') {
                console.error(`GeoLead [MAIN]: O preview do áudio não ficou pronto (${attempt.status}).`);
                return false;
            }
            previewSendButton = attempt.sendButton;
        } else {
            console.log(`GeoLead [MAIN]: Usando fluxo de COLAR para anexo (${attachData.type}) e mensagem...`);

            const file = await dataURItoFile(
                attachData.data,
                attachData.name || 'anexo.png',
                attachData.type || 'image/png'
            );

            const chatInput = findChatInput();
            if (!chatInput) {
                console.error("GeoLead [MAIN]: Chat input não encontrado");
                return false;
            }

            console.log("GeoLead [MAIN]: Colando anexo e mensagem no input...");
            chatInput.focus();

            // Simula o colar (paste) do anexo e do texto simultaneamente
            const dt = new DataTransfer();
            dt.items.add(file);
            if (messageText) {
                dt.items.add(messageText, 'text/plain');
            }

            const pasteEvent = new ClipboardEvent('paste', {
                clipboardData: dt,
                bubbles: true,
                cancelable: true
            });
            chatInput.dispatchEvent(pasteEvent);

            // Espera a janela de preview ser aberta pelo WhatsApp
            await delay(1500);
        }

        // Procura botão enviar EXCLUSIVO da janela de preview (modal)
        // Ignora o botão de enviar padrão do chat para não enviar texto solto por acidente
        const sendBtn = previewSendButton || await waitFor(() => findPreviewSendButton(), 10000);

        if (sendBtn) {
            console.log("GeoLead [MAIN]: Arquivo pronto. Enviando pela janela de preview.");
            await delay(800); // Tempo para o React puxar o texto e montar a legenda inteira
            clickElement(sendBtn);
            await delay(1000); // Tempo para o envio ser registrado
            return true;
        }

        console.warn("GeoLead [MAIN]: Botão enviar não encontrado no preview.");
        return false;
    }

    // Escuta pedidos do content script via custom events
    window.addEventListener('lumo-send-attachment', async (e) => {
        const { attachData, messageText, requestId } = e.detail;
        const success = await sendAttachment(attachData, messageText);
        window.dispatchEvent(new CustomEvent('lumo-attachment-result', {
            detail: { requestId, success }
        }));
    });

    console.log("GeoLead [MAIN]: Script injetado com sucesso. Usando fluxo nativo de anexos.");
})();
