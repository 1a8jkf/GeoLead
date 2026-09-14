// content.js — roda no mundo ISOLATED do Chrome

if (!window.geoLeadListenerAdded) {
    window.geoLeadListenerAdded = true;

    (function injectMainWorldScript() {
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('injected.js');
        script.onload = function() { this.remove(); };
        (document.head || document.documentElement).appendChild(script);
    })();

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'execute_send') {
            if (isExecuting) {
                sendResponse({ status: 'busy' });
                return true;
            }
            sendResponse({ status: 'received' });
            executeSendAction(request);
        }
        if (request.action === 'execute_followup') {
            if (isExecuting) {
                sendResponse({ status: 'busy' });
                return true;
            }
            sendResponse({ status: 'received' });
            executeFollowupAction(request);
        }
        if (request.action === 'ping') {
            const readiness = getWhatsAppPageReadiness();
            sendResponse({ status: 'alive', ...readiness });
        }
        return true;
    });
}

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

function getWhatsAppPageReadiness() {
    const loginRequired = isWhatsAppLoginRequired();
    const appReady = Boolean(
        document.querySelector('#pane-side, #main, [data-testid="chat-list"], [data-testid="chatlist-header"]') ||
        document.querySelector('[aria-label*="lista de conversas" i], [aria-label*="chat list" i]')
    );
    return {
        documentReady: document.readyState === 'interactive' || document.readyState === 'complete',
        appReady,
        loginRequired
    };
}

function findVisibleSendButton() {
    const icons = document.querySelectorAll('span[data-icon="send"], span[data-testid="send"]');
    for (let i = icons.length - 1; i >= 0; i--) {
        const parent = icons[i].closest('button, div[role="button"]');
        if (parent && isVisible(parent)) return parent;
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
        if (fBtns.length > 0) {
            const lastBtn = fBtns[fBtns.length - 1];
            // Verifica se o último botão é o de microfone
            if (lastBtn.querySelector('span[data-icon="ptt"]') || lastBtn.querySelector('span[data-icon="mic"]') || lastBtn.querySelector('span[data-icon="audio-call"]')) {
                return null; // Não clica no microfone acidentalmente!
            }
            return lastBtn;
        }
    }
    return null;
}

function findErrorDialog() {
    const btns = document.querySelectorAll('div[data-testid="popup-controls"] button, div[role="dialog"] button');
    for (const btn of btns) {
        if (isVisible(btn)) return btn;
    }
    return null;
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

// Delega envio de anexo para o injected.js (mundo MAIN)
function sendAttachment(attachData, messageText) {
    return new Promise((resolve) => {
        const requestId = 'req_' + Date.now() + '_' + Math.random();

        function onResult(e) {
            if (e.detail && e.detail.requestId === requestId) {
                window.removeEventListener('lumo-attachment-result', onResult);
                resolve(e.detail.success);
            }
        }
        window.addEventListener('lumo-attachment-result', onResult);

        window.dispatchEvent(new CustomEvent('lumo-send-attachment', {
            detail: { attachData, messageText, requestId }
        }));

        setTimeout(() => {
            window.removeEventListener('lumo-attachment-result', onResult);
            resolve(false);
        }, 30000);
    });
}

let isExecuting = false;

function formatPhoneForWhatsApp(phoneStr) {
    let digits = String(phoneStr || '').replace(/\D/g, '');
    if (digits.startsWith('0') && digits.length >= 11 && digits.length <= 12) {
        digits = '55' + digits.substring(1);
    } else if (!digits.startsWith('55') && (digits.length === 10 || digits.length === 11)) {
        digits = '55' + digits;
    }
    return digits;
}

async function executeSendAction(request) {
    if (isExecuting) return;
    isExecuting = true;
    const task = request && request.task;

    try {
        const hasAttachment = request && request.attachment && request.attachment.data;
        const hasAudio = request && request.audio && request.audio.data;
        const hasText = task && task.message && task.message.trim().length > 0;

        if (task && task.phone) {
            const formattedPhone = formatPhoneForWhatsApp(task.phone);
            const link = document.createElement('a');
            link.href = `https://web.whatsapp.com/send/?phone=${formattedPhone}`;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            setTimeout(() => {
                if (link.parentNode) link.parentNode.removeChild(link);
            }, 5000);
        }

        // IMPRESCINDÍVEL: Aguarda o WhatsApp iniciar a transição de tela.
        // Sem isso, a extensão acha o input do contato *anterior* que ainda está na tela
        // e cola a imagem nele bem na hora que a tela vai mudar!
        await delay(1200);

        // Espera o chat carregar ou a caixa de erro aparecer (sem congelar 15s)
        const result = await waitFor(() => {
            const input = findChatInput();
            if (input) return { type: 'input', el: input };

            const err = findErrorDialog();
            if (err) return { type: 'error', el: err };

            return null;
        }, 15000);

        if (!result || result.type === 'error') {
            if (result && result.type === 'error') {
                clickElement(result.el);
            } else {
                const errBtn = findErrorDialog();
                if (errBtn) clickElement(errBtn);
            }
            await delay(300);
            chrome.runtime.sendMessage({ action: 'task_error', taskId: task && task.id });
            isExecuting = false;
            return;
        }

        const chatInput = result.el;

        // Aguarda mínimo para o WhatsApp estabilizar o chat
        await delay(500);

        // Se tem mensagem de texto e não tem anexo, escrevemos na caixa de texto manualmente
        if (hasText && !hasAttachment) {
            const inputReady = await placeTextInChat(task.message, task.phone);
            if (!inputReady) {
                console.warn("GeoLead: Falha ao inserir texto no chat.");
            }
        }

        if (hasAttachment) {
            // Anexo principal (+ texto se houver) via PASTE
            const success = await sendAttachment(request.attachment, hasText ? task.message : '');
            if (!success) {
                console.warn("GeoLead: Falha ao enviar anexo.");
                chrome.runtime.sendMessage({ action: 'task_error', taskId: task && task.id });
                isExecuting = false;
                return;
            }

            // Se além do anexo principal houver um áudio gravado
            if (hasAudio) {
                await delay(1500); // Tempo para o chat voltar da tela de preview do anexo
                const audioSuccess = await sendAttachment(request.audio, '');
                if (!audioSuccess) {
                    console.warn("GeoLead: Falha ao enviar áudio gravado.");
                }
            }
        } else if (hasAudio) {
            // Sem anexo principal, mas tem áudio
            const success = await sendAttachment(request.audio, '');
            if (!success) {
                console.warn("GeoLead: Falha ao enviar áudio.");
                chrome.runtime.sendMessage({ action: 'task_error', taskId: task && task.id });
                isExecuting = false;
                return;
            }
        } else if (hasText) {
            // Só texto: clica no botão de enviar ou pressiona Enter
            await delay(500);

            // Aguarda o botão de enviar aparecer
            const sendBtn = await waitFor(() => findVisibleSendButton(), 5000);
            if (sendBtn) {
                clickElement(sendBtn);
            } else {
                console.warn("GeoLead: Botão de enviar não encontrado, tentando Enter...");
                chatInput.focus();
                chatInput.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter', keyCode: 13, code: 'Enter' }));
                chatInput.dispatchEvent(new KeyboardEvent('keypress', { bubbles: true, cancelable: true, key: 'Enter', keyCode: 13, code: 'Enter' }));
                chatInput.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: 'Enter', keyCode: 13, code: 'Enter' }));
            }
            await delay(500);
        }

        chrome.runtime.sendMessage({ action: 'task_completed', taskId: task && task.id });

    } catch (err) {
        console.error("GeoLead: Erro:", err);
        chrome.runtime.sendMessage({ action: 'task_error', taskId: task && task.id });
    }

    isExecuting = false;
}

function navigateToWhatsAppChat(phone, message = '') {
    const formattedPhone = formatPhoneForWhatsApp(phone);
    const link = document.createElement('a');
    link.href = `https://web.whatsapp.com/send/?phone=${formattedPhone}`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
        if (link.parentNode) link.parentNode.removeChild(link);
    }, 5000);
}

function isWhatsAppLoginRequired() {
    if (document.querySelector('#pane-side, #main')) return false;
    const bodyText = String(document.body && document.body.innerText || '').toLowerCase().slice(0, 12000);
    const hasQr = Boolean(document.querySelector('[data-ref] canvas, [data-ref], [data-testid*="qrcode"], canvas[aria-label*="scan" i], [aria-label*="QR" i]'));
    return hasQr || bodyText.includes('use whatsapp on your phone') || bodyText.includes('escaneie o código') ||
        bodyText.includes('scan the qr code') || bodyText.includes('conectar com número de telefone');
}

function normalizeConversationText(value) {
    return String(value || '')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

function getMessageDirection(node) {
    const row = node && node.closest ? node.closest('.message-in, .message-out') : null;
    const target = row || node;
    if (!target || !target.classList) return '';
    if (target.classList.contains('message-in')) return 'in';
    if (target.classList.contains('message-out')) return 'out';
    return '';
}

function getMessageText(node) {
    if (!node) return '';
    const textNodes = node.querySelectorAll('.selectable-text.copyable-text, .selectable-text, [data-pre-plain-text]');
    const values = [];
    textNodes.forEach(textNode => {
        const value = String(textNode.innerText || textNode.textContent || '').trim();
        if (value && !values.includes(value)) values.push(value);
    });
    return (values.join(' ') || String(node.innerText || node.textContent || '')).trim();
}

function collectConversationMessages() {
    const main = document.querySelector('#main');
    if (!main) return [];
    let rows = Array.from(main.querySelectorAll('.message-in, .message-out'));
    if (rows.length === 0) {
        rows = Array.from(main.querySelectorAll('[data-testid="msg-container"]'))
            .map(node => node.closest('.message-in, .message-out') || node);
    }
    rows = rows.filter((row, index) => rows.indexOf(row) === index);
    return rows.map((node, index) => ({
        index,
        direction: getMessageDirection(node),
        text: getMessageText(node)
    })).filter(message => message.direction);
}

function detectReplyAfterCampaignMessage(messages, lastMessage) {
    if (!Array.isArray(messages) || messages.length === 0) return 'unknown';
    const marker = normalizeConversationText(lastMessage);
    let markerIndex = -1;
    if (marker) {
        for (let index = messages.length - 1; index >= 0; index--) {
            const candidate = normalizeConversationText(messages[index].text);
            if (messages[index].direction === 'out' && candidate && (candidate === marker || candidate.includes(marker) || marker.includes(candidate))) {
                markerIndex = index;
                break;
            }
        }
    }
    if (markerIndex >= 0) {
        return messages.slice(markerIndex + 1).some(message => message.direction === 'in') ? 'replied' : 'not_replied';
    }
    const latest = messages[messages.length - 1];
    if (latest.direction === 'in') return 'replied';
    if (latest.direction === 'out') return 'not_replied';
    return 'unknown';
}

function wasPendingFollowupAlreadySent(messages, lastMessage, pendingMessage) {
    if (!Array.isArray(messages) || messages.length === 0) return false;
    const pending = normalizeConversationText(pendingMessage);
    if (!pending) return false;
    const marker = normalizeConversationText(lastMessage);
    let markerIndex = -1;
    if (marker) {
        for (let index = messages.length - 1; index >= 0; index--) {
            const text = normalizeConversationText(messages[index].text);
            if (messages[index].direction === 'out' && text && (text === marker || text.includes(marker) || marker.includes(text))) {
                markerIndex = index;
                break;
            }
        }
    }
    return messages.some((message, index) => {
        if (message.direction !== 'out' || (markerIndex >= 0 && index <= markerIndex)) return false;
        const text = normalizeConversationText(message.text);
        return text && (text === pending || text.includes(pending) || pending.includes(text));
    });
}

async function placeTextInChat(message, phone) {
    let input = findChatInput();
    if (!input) return null;
    input.focus();

    try {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(input);
        selection.removeAllRanges();
        selection.addRange(range);
        document.execCommand('insertText', false, message);
    } catch (_) {}

    input.dispatchEvent(new Event('input', { bubbles: true }));
    await delay(350);

    const expected = normalizeConversationText(message);
    if (expected && !normalizeConversationText(input.textContent).includes(expected)) {
        console.warn('GeoLead: Fallback inserindo texto caractere por caractere...');
        input.textContent = message;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await delay(350);
    }
    return input;
}

function reportFollowupResult(task, result, extra = {}) {
    chrome.runtime.sendMessage({
        action: 'followup_task_result',
        campaignId: task && task.campaignId,
        contactId: task && task.contactId,
        dispatchToken: task && task.dispatchToken,
        result,
        message: task && task.message,
        ...extra
    }).catch(() => {});
}

async function executeFollowupAction(request) {
    if (isExecuting) return;
    isExecuting = true;
    const task = request && request.task;
    try {
        if (!task || !task.phone || !String(task.message || '').trim()) {
            reportFollowupResult(task, 'needs_review', { error: 'invalid_followup_task' });
            return;
        }

        navigateToWhatsAppChat(task.phone);
        await delay(1300);
        const loaded = await waitFor(() => {
            const input = findChatInput();
            if (input) return { type: 'input', el: input };
            if (findErrorDialog()) return { type: 'error' };
            if (isWhatsAppLoginRequired()) return { type: 'login' };
            return null;
        }, 30000);

        if (!loaded) {
            reportFollowupResult(task, isWhatsAppLoginRequired() ? 'login_required' : 'error', { error: 'chat_load_timeout' });
            return;
        }
        if (loaded.type === 'login') {
            reportFollowupResult(task, 'login_required');
            return;
        }
        if (loaded.type === 'error') {
            const errorButton = findErrorDialog();
            if (errorButton) clickElement(errorButton);
            reportFollowupResult(task, 'needs_review', { error: 'invalid_or_unavailable_contact' });
            return;
        }

        await delay(900);
        let conversationMessages = collectConversationMessages();
        let replyState = detectReplyAfterCampaignMessage(conversationMessages, task.lastMessage);
        if (replyState === 'replied') {
            reportFollowupResult(task, 'replied');
            return;
        }
        if (replyState === 'unknown') {
            reportFollowupResult(task, 'needs_review', { error: 'reply_state_uncertain' });
            return;
        }
        if (wasPendingFollowupAlreadySent(conversationMessages, task.lastMessage, task.message)) {
            reportFollowupResult(task, 'sent', { recovered: true });
            return;
        }

        // Faz uma segunda leitura imediatamente antes de escrever, reduzindo a
        // janela em que uma resposta poderia chegar entre a checagem e o envio.
        await delay(350);
        conversationMessages = collectConversationMessages();
        replyState = detectReplyAfterCampaignMessage(conversationMessages, task.lastMessage);
        if (replyState === 'replied') {
            reportFollowupResult(task, 'replied');
            return;
        }
        if (replyState === 'unknown') {
            reportFollowupResult(task, 'needs_review', { error: 'reply_state_uncertain' });
            return;
        }
        if (wasPendingFollowupAlreadySent(conversationMessages, task.lastMessage, task.message)) {
            reportFollowupResult(task, 'sent', { recovered: true });
            return;
        }

        const input = await placeTextInChat(String(task.message), task.phone);
        if (!input) {
            reportFollowupResult(task, 'error', { error: 'message_input_unavailable' });
            return;
        }

        const sendButton = await waitFor(() => findVisibleSendButton(), 5000);
        if (sendButton) {
            clickElement(sendButton);
        } else {
            input.focus();
            input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter', keyCode: 13, code: 'Enter' }));
            input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: 'Enter', keyCode: 13, code: 'Enter' }));
        }

        const expected = normalizeConversationText(task.message);
        const confirmed = await waitFor(() => {
            const messages = collectConversationMessages();
            const latest = messages[messages.length - 1];
            const text = normalizeConversationText(latest && latest.text);
            const inputCleared = !normalizeConversationText(findChatInput() && findChatInput().textContent);
            return latest && inputCleared && latest.direction === 'out' && (!expected || text === expected || text.includes(expected)) ? latest : null;
        }, 8000);
        if (!confirmed) {
            reportFollowupResult(task, 'error', { error: 'send_not_confirmed' });
            return;
        }
        reportFollowupResult(task, 'sent');
    } catch (error) {
        console.error('GeoLead: erro no follow-up:', error);
        reportFollowupResult(task, 'error', { error: error && error.message ? error.message : 'followup_exception' });
    } finally {
        isExecuting = false;
    }
}
