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

    async function dataURItoFile(dataURI, fileName, mimeType) {
        // Usar fetch é 100% seguro contra corrupção de bytes (evita imagem 'distorcida')
        const res = await fetch(dataURI);
        const blob = await res.blob();
        return new File([blob], fileName, { type: mimeType });
    }

    async function sendAttachment(attachData, messageText) {
        if (attachData.type && attachData.type.startsWith('audio/')) {
            console.log(`Lumo [MAIN]: Usando fluxo de CLIPE para áudio (${attachData.type})...`);
            
            const file = await dataURItoFile(
                attachData.data,
                attachData.name || 'audio_gravado.mp3',
                attachData.type
            );
            
            const attachBtn = findAttachButton();
            if (!attachBtn) {
                console.error("Lumo [MAIN]: Botão de anexo não encontrado");
                return false;
            }
            
            clickElement(attachBtn);
            await delay(500); // Espera abrir o menu
            
            const fileInputs = document.querySelectorAll('input[type="file"]');
            let docInput = null;
            
            for (const input of fileInputs) {
                const accept = input.getAttribute('accept') || '';
                // Acha o input genérico de documentos (accept="*") ou um que aceite audio
                if (accept === '*' || accept.includes('*') || accept.includes('audio')) {
                    docInput = input;
                }
            }
            
            if (!docInput && fileInputs.length > 0) docInput = fileInputs[0];
            
            if (docInput) {
                const dt = new DataTransfer();
                dt.items.add(file);
                docInput.files = dt.files;
                docInput.dispatchEvent(new Event('change', { bubbles: true }));
                
                // Espera a janela de preview
                await delay(1500);
            } else {
                return false;
            }
        } else {
            console.log(`Lumo [MAIN]: Usando fluxo de COLAR (PASTE) para anexo (${attachData.type}) e mensagem...`);

            const file = await dataURItoFile(
                attachData.data,
                attachData.name || 'anexo.png',
                attachData.type || 'image/png'
            );

            const chatInput = findChatInput();
            if (!chatInput) {
                console.error("Lumo [MAIN]: Chat input não encontrado");
                return false;
            }

            console.log("Lumo [MAIN]: Colando anexo e mensagem no input...");
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
        const sendBtn = await waitFor(() => {
            // Prioridade 1: Ícones de envio
            const icons = document.querySelectorAll('span[data-icon*="send"], span[data-testid*="send"]');
            for (let i = icons.length - 1; i >= 0; i--) {
                const parent = icons[i].closest('button, div[role="button"]');
                if (parent && isVisible(parent)) {
                    const isChatFooter = parent.closest('footer');
                    if (!isChatFooter) return parent; // Achei o botão de enviar do modal!
                }
            }
            
            // Prioridade 2: Busca por texto aria-label ou title
            const allBtns = document.querySelectorAll('button, div[role="button"]');
            for (let i = allBtns.length - 1; i >= 0; i--) {
                const btn = allBtns[i];
                if (!isVisible(btn)) continue;
                if (btn.closest('footer')) continue; // ignora o footer normal do chat
                
                const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
                const title = (btn.getAttribute('title') || '').toLowerCase();
                if (aria.includes('enviar') || aria.includes('send') || title.includes('enviar') || title.includes('send')) {
                    return btn;
                }
            }
            return null;
        }, 10000);

        if (sendBtn) {
            console.log("Lumo [MAIN]: Imagem montada. Clicando em enviar na janela de preview!");
            await delay(800); // Tempo para o React puxar o texto e montar a legenda inteira
            clickElement(sendBtn);
            await delay(1000); // Tempo para o envio ser registrado
            
            // Fallback: Dispara o Enter também na janela de preview só para garantir
            const activeEl = document.activeElement;
            if (activeEl) {
                activeEl.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter', keyCode: 13, code: 'Enter' }));
            }
            return true;
        }

        console.warn("Lumo [MAIN]: Botão enviar não encontrado no preview (trava).");
        console.warn("Lumo [MAIN]: Botão enviar não encontrado no preview (trava).");
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

    console.log("Lumo [MAIN]: Script injetado com sucesso. Usando fluxo nativo (Clipe).");
})();
