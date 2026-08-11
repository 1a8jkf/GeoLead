// content.js — roda no mundo ISOLATED do Chrome

(function injectMainWorldScript() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('injected.js');
    script.onload = function() { this.remove(); };
    (document.head || document.documentElement).appendChild(script);
})();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'execute_send') {
        sendResponse({ status: 'received' });
        executeSendAction(request);
    }
    if (request.action === 'ping') {
        sendResponse({ status: 'alive' });
    }
    return true;
});

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

async function executeSendAction(request) {
    if (isExecuting) return;
    isExecuting = true;

    try {
        const task = request.task;
        const hasAttachment = request && request.attachment && request.attachment.data;
        const hasAudio = request && request.audio && request.audio.data;
        const hasText = task && task.message && task.message.trim().length > 0;

        // Navega para o chat
        if (task && task.phone) {
            const link = document.createElement('a');
            // SEMPRE manda o texto na URL. Ao colar a imagem, o WhatsApp puxa esse texto pra legenda automaticamente.
            link.href = `https://web.whatsapp.com/send/?phone=${task.phone}&text=${encodeURIComponent(task.message || '')}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
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
            chrome.runtime.sendMessage({ action: 'task_error' });
            isExecuting = false;
            return;
        }

        const chatInput = result.el;

        // Aguarda mínimo para o WhatsApp estabilizar o chat
        await delay(500);

        // Se tem mensagem de texto, espera o WhatsApp colocar na caixa de texto
        if (hasText) {
            await waitFor(() => {
                const el = findChatInput();
                return el && el.textContent.trim().length > 0;
            }, 5000);
            await delay(300); // tempinho extra para estabilizar o React
        }

        if (hasAttachment) {
            // Anexo principal (+ texto se houver) via PASTE
            const success = await sendAttachment(request.attachment, hasText ? task.message : '');
            if (!success) {
                console.warn("Lumo: Falha ao enviar anexo.");
                chrome.runtime.sendMessage({ action: 'task_error' });
                isExecuting = false;
                return;
            }
            
            // Se além do anexo principal houver um áudio gravado
            if (hasAudio) {
                await delay(1500); // Tempo para o chat voltar da tela de preview do anexo
                const audioSuccess = await sendAttachment(request.audio, '');
                if (!audioSuccess) {
                    console.warn("Lumo: Falha ao enviar áudio gravado.");
                }
            }
        } else if (hasAudio) {
            // Sem anexo principal, mas tem áudio
            const success = await sendAttachment(request.audio, '');
            if (!success) {
                console.warn("Lumo: Falha ao enviar áudio.");
                chrome.runtime.sendMessage({ action: 'task_error' });
                isExecuting = false;
                return;
            }
        } else if (hasText) {
            // Só texto: clica no botão de enviar ou pressiona Enter
            await delay(500); // Deixa o WhatsApp preencher o texto da URL
            
            // Aguarda o botão de enviar aparecer
            const sendBtn = await waitFor(() => findVisibleSendButton(), 5000);
            if (sendBtn) {
                clickElement(sendBtn);
            } else {
                console.warn("Lumo: Botão de enviar não encontrado, tentando Enter...");
                chatInput.focus();
                chatInput.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter', keyCode: 13, code: 'Enter' }));
                chatInput.dispatchEvent(new KeyboardEvent('keypress', { bubbles: true, cancelable: true, key: 'Enter', keyCode: 13, code: 'Enter' }));
                chatInput.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: 'Enter', keyCode: 13, code: 'Enter' }));
            }
            await delay(500);
        }

        chrome.runtime.sendMessage({ action: 'task_completed' });

    } catch (err) {
        console.error("Lumo: Erro:", err);
        chrome.runtime.sendMessage({ action: 'task_error' });
    }

    isExecuting = false;
}
