// maps_content.js

let shouldStop = false;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'START_EXTRACTION') {
        shouldStop = false;
        startExtraction(request.filterNoWebsite, request.requirePhone, request.requireEmail, request.requireSocialMedia);
        sendResponse({ status: 'started' });
    } else if (request.action === 'STOP_EXTRACTION') {
        shouldStop = true;
        sendResponse({ status: 'stopped' });
    }
});

async function startExtraction(filterNoWebsite = false, requirePhone = false, requireEmail = false, requireSocialMedia = false) {
    sendLog("Iniciando extração do Google Maps...");
    
    // 1. Encontrar o container de resultados
    let feed = await waitForSelector('div[role="feed"]', 3000);
    if (!feed) feed = await waitForSelector('div[aria-label^="Resultados para"]', 2000);
    if (!feed) feed = await waitForSelector('div[aria-label^="Results for"]', 2000);
    
    if (!feed) {
        // Fallback: procura um link e sobe até achar o container que tem barra de rolagem
        const sampleLink = document.querySelector('a[href*="/maps/place/"]');
        if (sampleLink) {
            let p = sampleLink.parentElement;
            while (p && p !== document.body) {
                if (p.scrollHeight > p.clientHeight && p.clientHeight > 200) {
                    feed = p;
                    break;
                }
                p = p.parentElement;
            }
        }
    }

    if (!feed) {
        sendLog("Erro: Não foi possível encontrar a lista de resultados. Certifique-se de que a busca carregou.");
        sendFinish({ error: 'Feed not found' });
        return;
    }

    sendLog("Lista encontrada. Iniciando extração profunda e ininterrupta...");

    const extractedUrls = new Set();
    const results = [];
    let attempts = 0;
    const distance = 800;
    
    while (attempts < 15 && !shouldStop) {
        // Encontra links visíveis atualmente (lidando com a virtualização do DOM)
        const currentLinks = Array.from(document.querySelectorAll('a[href*="/maps/place/"]')).map(a => a.href);
        let foundNew = false;
        
        for (const linkUrl of currentLinks) {
            if (shouldStop) break;
            
            if (!extractedUrls.has(linkUrl)) {
                foundNew = true;
                extractedUrls.add(linkUrl);
                
                sendLog(`Coletando local ${extractedUrls.size}...`);
                
                try {
                    const linkElement = document.querySelector(`a[href="${linkUrl}"]`);
                    if (linkElement) {
                        linkElement.click();
                        
                        // Esperar o botão voltar (confirma que o painel de detalhes abriu)
                        await waitForSelector('button[aria-label="Voltar"], button[aria-label="Back"]', 4000, true);
                        
                        // Pegar o h1 correto (que não seja o "Results" da lista principal)
                        const h1s = Array.from(document.querySelectorAll('h1'));
                        const heading = h1s.find(h => h.innerText.trim() !== 'Results' && h.innerText.trim() !== 'Resultados') || h1s[h1s.length - 1];
                        const nome = heading ? heading.innerText.trim() : 'Sem Nome';
                        
                        // Esperar o painel carregar os dados
                        await new Promise(r => setTimeout(r, 1000));
                        
                        if (filterNoWebsite) {
                            // Procura o botão de website apenas usando atributos bem específicos do painel
                            const hasWebsite = document.querySelector('a[data-item-id="authority"], a[aria-label="Website"], a[aria-label="Site"]');
                            if (hasWebsite) {
                                sendLog(`⏭️ Pulando ${nome} (Possui Site)`);
                                await goBackToList();
                                continue;
                            }
                        }
                        
                        let telefone = 'Não encontrado';
                        const phoneBtnTooltip = document.querySelector('button[data-tooltip="Copiar número de telefone"]');
                        if (phoneBtnTooltip) {
                            const textNode = phoneBtnTooltip.querySelector('.fontBodyMedium') || phoneBtnTooltip;
                            if (textNode) telefone = textNode.innerText.trim();
                        } else {
                            const buttons = Array.from(document.querySelectorAll('button'));
                            for(const btn of buttons) {
                                const ariaLabel = btn.getAttribute('aria-label');
                                if (ariaLabel && (ariaLabel.toLowerCase().includes('telefone:') || ariaLabel.toLowerCase().includes('phone:'))) {
                                     telefone = ariaLabel.replace(/telefone:/i, '').replace(/phone:/i, '').trim();
                                     break;
                                }
                            }
                        }
                        
                        if (requirePhone && telefone === 'Não encontrado') {
                            sendLog(`⏭️ Pulando ${nome} (Sem Telefone)`);
                            await goBackToList();
                            continue;
                        }
                        
                        let email = 'Não encontrado';
                        const emailLink = document.querySelector('a[href^="mailto:"]');
                        if (emailLink) {
                            email = emailLink.href.replace('mailto:', '').trim();
                        }
                        
                        if (requireEmail && email === 'Não encontrado') {
                            sendLog(`⏭️ Pulando ${nome} (Sem E-mail)`);
                            await goBackToList();
                            continue;
                        }
                        
                        const socialDomains = ['instagram.com', 'facebook.com', 'linkedin.com', 'twitter.com', 'x.com', 'tiktok.com', 'youtube.com'];
                        const socialLinks = [];
                        const allLinks = document.querySelectorAll('a[href]');
                        allLinks.forEach(a => {
                            const href = a.href.toLowerCase();
                            if (socialDomains.some(domain => href.includes(domain))) {
                                socialLinks.push(a.href);
                            }
                        });
                        
                        if (requireSocialMedia && socialLinks.length === 0) {
                            sendLog(`⏭️ Pulando ${nome} (Sem Redes Sociais)`);
                            await goBackToList();
                            continue;
                        }
                        
                        results.push({ nome, telefone, email, social: socialLinks.join(', ') });
                        sendLog(`✅ ${nome} - ${telefone}`);
                        
                        await goBackToList();
                    }
                } catch (err) {
                    sendLog(`❌ Erro no local ${extractedUrls.size}: ${err.message}`);
                    await goBackToList();
                }
            }
        }
        
        if (foundNew) {
            attempts = 0;
        } else {
            attempts++;
            sendLog(`Rolando para buscar mais... (Tentativa ${attempts}/15)`);
        }
        
        // Desce a barra de rolagem e espera a página carregar mais itens
        feed.scrollBy(0, distance);
        await new Promise(r => setTimeout(r, 1200));
        
        if (feed.innerHTML.includes("Você chegou ao final da lista") || feed.innerHTML.includes("You've reached the end of the list")) {
            sendLog("Final da lista detectado pelo Google.");
            break;
        }
    }
    
    if (shouldStop) {
        sendLog(`Extração interrompida pelo usuário. Retornando ${results.length} contatos coletados até agora.`);
    } else {
        sendLog(`Extração 100% concluída! Retornando ${results.length} contatos válidos (de ${extractedUrls.size} processados).`);
    }
    
    sendFinish({ success: true, data: results });
}

async function goBackToList() {
    // IMPORTANTE: Nunca usar window.history.back() no Google Maps, pois ele pode descarregar a página e matar o script!
    const backBtn = document.querySelector('button[aria-label="Voltar"], button[aria-label="Back"]');
    if (backBtn) {
        backBtn.click();
        await new Promise(r => setTimeout(r, 1000));
    }
    // Se não achar o botão voltar, assume que o detalhe não abriu e já estamos na lista.
}

async function waitForSelector(selector, timeoutMs, ignoreError=false) {
    return new Promise((resolve) => {
        const start = Date.now();
        const interval = setInterval(() => {
            const el = document.querySelector(selector);
            if (el) {
                clearInterval(interval);
                resolve(el);
            } else if (Date.now() - start > timeoutMs) {
                clearInterval(interval);
                resolve(null);
            }
        }, 500);
    });
}

function sendLog(message) {
    chrome.runtime.sendMessage({ type: 'EXTRACTION_LOG', message });
}

function sendFinish(payload) {
    chrome.runtime.sendMessage({ type: 'EXTRACTION_FINISHED', payload });
}
