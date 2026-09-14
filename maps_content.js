// GeoLead Maps Extractor 2.5.0
// Varredura contínua do feed virtualizado do Google Maps.

let shouldStop = false;
let isPaused = false;
let extractionRunning = false;

const HARD_LEAD_LIMIT = 500;
const HARD_PROFILE_LIMIT = 1200;
const MAX_IDLE_SWEEPS = 35;
const SOCIAL_DOMAINS = [
    'instagram.com', 'facebook.com', 'linkedin.com', 'twitter.com',
    'x.com', 'tiktok.com', 'youtube.com', 'threads.net', 'pinterest.com'
];

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'START_EXTRACTION') {
        if (extractionRunning) {
            sendResponse({ status: 'already_running' });
            return;
        }

        shouldStop = false;
        isPaused = false;
        extractionRunning = true;
        startExtraction({
            filterNoWebsite: Boolean(request.filterNoWebsite),
            requirePhone: Boolean(request.requirePhone),
            requireEmail: Boolean(request.requireEmail),
            requireSocialMedia: Boolean(request.requireSocialMedia),
            enrichWebsite: Boolean(request.enrichWebsite),
            maxResults: normalizeLimit(request.maxResults)
        }).finally(() => {
            extractionRunning = false;
        });
        sendResponse({ status: 'started' });
    } else if (request.action === 'STOP_EXTRACTION') {
        shouldStop = true;
        isPaused = false;
        sendResponse({ status: 'stopped' });
    } else if (request.action === 'PAUSE_EXTRACTION') {
        isPaused = true;
        sendLog('⏸️ Extração pausada. Os contatos coletados continuam seguros.');
        sendResponse({ status: 'paused' });
    } else if (request.action === 'RESUME_EXTRACTION') {
        isPaused = false;
        sendLog('▶️ Extração retomada.');
        sendResponse({ status: 'resumed' });
    }
});

function normalizeLimit(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return Math.min(Math.max(Math.round(parsed), 1), HARD_LEAD_LIMIT);
}

async function startExtraction(filters) {
    const targetLabel = filters.maxResults > 0 ? `${filters.maxResults} leads` : `o máximo disponível (até ${HARD_LEAD_LIMIT})`;
    sendLog(`Iniciando varredura contínua. Meta: ${targetLabel}.`);

    let feed = await waitFor(findResultsFeed, 8000);
    if (!feed) {
        sendLog('❌ Não encontrei a lista de resultados. Abra uma busca com vários locais no Google Maps e tente novamente.');
        sendFinish({ error: 'Feed not found' });
        return;
    }

    const queuedKeys = new Set();
    const processedKeys = new Set();
    const queue = [];
    const results = [];
    const resultIndex = new Map();
    let idleSweeps = 0;
    let lastDiscoveryCount = 0;
    let finishReason = 'end_of_list';

    sendLog('Lista encontrada. Descobrindo e processando perfis enquanto o Maps carrega resultados...');
    sendSnapshot({ results, queuedKeys, processedKeys, filters, stage: 'discovering', currentLead: 'Mapeando os primeiros resultados' });

    while (!shouldStop) {
        await waitWhilePaused();
        if (shouldStop) break;

        if (reachedLeadTarget(results, filters.maxResults)) {
            finishReason = 'target_reached';
            break;
        }
        if (processedKeys.size >= HARD_PROFILE_LIMIT) {
            finishReason = 'profile_safety_limit';
            break;
        }

        feed = findResultsFeed() || await waitFor(findResultsFeed, 3500);
        if (!feed) {
            idleSweeps++;
            if (idleSweeps >= 5) {
                finishReason = 'feed_lost';
                break;
            }
            await delay(900);
            continue;
        }

        const discoveredNow = discoverVisiblePlaces(feed, queuedKeys, queue);
        if (discoveredNow > 0) {
            idleSweeps = 0;
            lastDiscoveryCount = queuedKeys.size;
            sendSnapshot({
                results, queuedKeys, processedKeys, filters,
                stage: 'discovering',
                currentLead: `${discoveredNow} perfis detectados`
            });
        }

        const nextPlace = queue.shift();
        if (nextPlace) {
            if (processedKeys.has(nextPlace.key)) continue;
            processedKeys.add(nextPlace.key);

            sendLog(`Analisando perfil ${processedKeys.size} · ${nextPlace.fallbackName || 'identificando nome'}...`);
            sendSnapshot({
                results, queuedKeys, processedKeys, filters,
                stage: 'analyzing',
                currentLead: nextPlace.fallbackName || 'Abrindo perfil no Google Maps'
            });

            const outcome = await extractPlace(nextPlace, filters);
            if (outcome.row) {
                const filteredReason = getFilteredReason(outcome.row, filters);
                if (filteredReason) {
                    sendLog(`⏭️ ${outcome.row.nome} · ${filteredReason}`);
                } else {
                    const merged = upsertLead(results, resultIndex, outcome.row);
                    const phoneLabel = hasValue(merged.row.telefone) ? merged.row.telefone : 'sem telefone';
                    sendLog(`${merged.isNew ? '✅' : '♻️'} ${merged.row.nome} · ${phoneLabel}`);
                    sendSnapshot({
                        results, queuedKeys, processedKeys, filters,
                        stage: merged.isNew ? 'collecting' : 'deduplicating',
                        currentLead: merged.isNew ? merged.row.nome : `${merged.row.nome} mesclado sem duplicar`,
                        row: merged.row
                    });
                }
            } else {
                sendLog(`⚠️ Perfil ${processedKeys.size} não pôde ser lido${outcome.reason ? `: ${outcome.reason}` : ''}.`);
            }

            await returnToResults();
            continue;
        }

        if (hasEndOfListMarker(feed)) {
            finishReason = 'end_of_list';
            break;
        }

        idleSweeps++;
        if (idleSweeps === 1 || idleSweeps % 5 === 0) {
            sendLog(`Varrendo mais resultados · ${queuedKeys.size} descobertos · ${results.length} leads salvos.`);
        }

        sendSnapshot({
            results, queuedKeys, processedKeys, filters,
            stage: 'loading_more',
            currentLead: `Carregando mais resultados · varredura ${idleSweeps}/${MAX_IDLE_SWEEPS}`
        });

        const loadedNew = await loadMoreResults(feed, queuedKeys);
        if (loadedNew || queuedKeys.size > lastDiscoveryCount) {
            idleSweeps = 0;
            lastDiscoveryCount = queuedKeys.size;
        }

        if (idleSweeps >= MAX_IDLE_SWEEPS) {
            finishReason = 'no_more_results';
            break;
        }
    }

    const stopped = shouldStop;
    if (stopped) {
        finishReason = 'user_stopped';
        sendLog(`Extração encerrada pelo usuário. ${results.length} leads preservados.`);
    } else if (finishReason === 'target_reached') {
        sendLog(`Meta alcançada: ${results.length} leads válidos coletados.`);
    } else if (finishReason === 'profile_safety_limit') {
        sendLog(`Limite de segurança atingido após ${processedKeys.size} perfis analisados.`);
    } else {
        sendLog(`Varredura concluída: ${results.length} leads válidos de ${processedKeys.size} perfis analisados.`);
    }

    const finalTarget = filters.maxResults || null;
    const finalPercent = finalTarget ? Math.min(100, Math.round((results.length / finalTarget) * 100)) : 100;
    sendProgress({
        processed: processedKeys.size,
        collected: results.length,
        discovered: queuedKeys.size,
        target: finalTarget,
        percent: finalPercent,
        indeterminate: false,
        stage: stopped ? 'stopped' : 'completed',
        currentLead: stopped ? 'Extração encerrada' : 'Varredura concluída',
        finishReason
    });
    sendFinish({ success: true, data: results, finishReason, processed: processedKeys.size });
}

function reachedLeadTarget(results, maxResults) {
    const effectiveLimit = maxResults > 0 ? maxResults : HARD_LEAD_LIMIT;
    return results.length >= effectiveLimit;
}

function findResultsFeed() {
    const selectors = [
        'div[role="feed"]',
        'div[aria-label^="Resultados para"]',
        'div[aria-label^="Results for"]'
    ];
    const candidates = selectors.flatMap(selector => Array.from(document.querySelectorAll(selector)));
    const usable = candidates.filter(element => element.isConnected && isVisible(element) && element.clientHeight > 180);
    if (usable.length) return usable.sort((a, b) => b.scrollHeight - a.scrollHeight)[0];

    const sampleLink = Array.from(document.querySelectorAll('a[href*="/maps/place/"]')).find(isVisible);
    if (!sampleLink) return null;
    let parent = sampleLink.parentElement;
    while (parent && parent !== document.body) {
        if (parent.clientHeight > 200 && parent.scrollHeight > parent.clientHeight + 50) return parent;
        parent = parent.parentElement;
    }
    return null;
}

function discoverVisiblePlaces(feed, queuedKeys, queue) {
    const links = Array.from(feed.querySelectorAll('a[href*="/maps/place/"]'));
    let added = 0;

    links.forEach(link => {
        const href = link.href;
        const key = getPlaceKey(href);
        if (!href || !key || queuedKeys.has(key)) return;
        queuedKeys.add(key);
        queue.push({ key, href, fallbackName: getListingName(link) });
        added++;
    });

    return added;
}

function getPlaceKey(href) {
    try {
        const decoded = decodeURIComponent(href);
        const featureMatch = decoded.match(/!1s([^!]+)/);
        if (featureMatch) return `feature:${featureMatch[1]}`;
        const url = new URL(href);
        const cid = url.searchParams.get('cid');
        if (cid) return `cid:${cid}`;
        return url.pathname.replace(/\/$/, '').toLowerCase();
    } catch (_) {
        return String(href).split('?')[0].split('#')[0].toLowerCase();
    }
}

function getListingName(link) {
    const direct = cleanText(link.getAttribute('aria-label'));
    if (isBusinessName(direct)) return direct;

    const card = link.closest('div[role="article"], .Nv2PK') || link.parentElement;
    if (card) {
        const selectors = ['.qBF1Pd', '.fontHeadlineSmall', '[role="heading"]'];
        for (const selector of selectors) {
            const value = cleanText(card.querySelector(selector)?.textContent);
            if (isBusinessName(value)) return value;
        }
    }
    return getNameFromMapsUrl(link.href);
}

async function extractPlace(place, filters) {
    try {
        const link = findCurrentPlaceLink(place.key) || Array.from(document.querySelectorAll('a[href*="/maps/place/"]')).find(item => item.href === place.href);
        if (!link) return { row: null, reason: 'resultado saiu da área visível' };

        const beforeUrl = location.href;
        const beforeSnapshot = getVisiblePlaceSnapshot();
        safeClick(link);
        await delay(250);
        const matchedSnapshot = await waitFor(() => {
            const candidate = getVisiblePlaceSnapshot();
            return isExpectedPlaceSnapshot(place, candidate, beforeSnapshot, beforeUrl, location.href) ? candidate : null;
        }, 12000, 180);
        if (!matchedSnapshot) return { row: null, reason: `painel aberto não correspondeu a “${place.fallbackName || 'este resultado'}”` };

        const snapshot = await waitForStablePlaceSnapshot(place, matchedSnapshot);
        const root = snapshot.root;
        const nome = snapshot.name || place.fallbackName || getNameFromMapsUrl(place.href) || `Lead ${Date.now()}`;
        const telefone = extractPhone(root);
        let email = extractEmail(root);
        const website = extractWebsite(root);
        let socialLinks = extractSocialLinks(root);
        const endereco = extractAddress(root);
        const categoria = extractCategory(root, nome);

        const needsEmail = Boolean(filters && filters.requireEmail && !email);
        const needsSocial = Boolean(filters && filters.requireSocialMedia && socialLinks.length === 0);
        if (filters && filters.enrichWebsite && !filters.filterNoWebsite && website && (needsEmail || needsSocial)) {
            const fields = [needsEmail ? 'e-mail' : '', needsSocial ? 'redes sociais' : ''].filter(Boolean).join(' e ');
            sendLog('🌐 ' + nome + ' · procurando ' + fields + ' no site público...');
            const enriched = await requestWebsiteEnrichment(website);
            if (!email && enriched.email) email = enriched.email;
            socialLinks = Array.from(new Set(socialLinks.concat(enriched.social || [])));
        }

        return {
            row: {
                nome,
                telefone: telefone || 'Não encontrado',
                email: email || 'Não encontrado',
                website,
                semSite: !website,
                social: socialLinks.join(', '),
                endereco,
                categoria,
                mapsUrl: place.href,
                placeKey: place.key,
                extraidoEm: Date.now()
            }
        };
    } catch (error) {
        console.error('GeoLead Maps: erro ao extrair perfil', error);
        return { row: null, reason: error.message || 'erro inesperado' };
    }
}

function normalizeComparableName(value) {
    return cleanText(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, ' ')
        .trim()
        .toLowerCase();
}

function namesLikelySame(first, second) {
    const a = normalizeComparableName(first);
    const b = normalizeComparableName(second);
    if (!a || !b) return false;
    if (a === b) return true;
    if (Math.min(a.length, b.length) >= 5 && (a.includes(b) || b.includes(a))) return true;

    const ignored = new Set(['a', 'o', 'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'clinica', 'odontologia', 'odontologica', 'dentista', 'dentistas', 'dr', 'dra']);
    const tokensA = new Set(a.split(' ').filter(token => token.length > 1 && !ignored.has(token)));
    const tokensB = new Set(b.split(' ').filter(token => token.length > 1 && !ignored.has(token)));
    if (!tokensA.size || !tokensB.size) return false;
    const intersection = [...tokensA].filter(token => tokensB.has(token)).length;
    return intersection >= 1 && intersection / Math.min(tokensA.size, tokensB.size) >= 0.6;
}

function isExpectedPlaceSnapshot(place, candidate, beforeSnapshot, beforeUrl, currentUrl) {
    if (!candidate || !isBusinessName(candidate.name)) return false;
    const expectedName = place.fallbackName || getNameFromMapsUrl(place.href);
    const nameMatches = namesLikelySame(candidate.name, expectedName);
    const panelChanged = !beforeSnapshot || candidate.heading !== beforeSnapshot.heading || candidate.signature !== beforeSnapshot.signature;
    const routeChanged = currentUrl !== beforeUrl;
    const currentKey = currentUrl.includes('/maps/place/') ? getPlaceKey(currentUrl) : '';
    const routeMatches = currentKey === place.key;

    if (expectedName) return nameMatches && panelChanged && (routeChanged || routeMatches);
    return routeMatches && panelChanged;
}

async function waitForStablePlaceSnapshot(place, initialSnapshot) {
    let latest = initialSnapshot;
    let previousSignature = '';
    let stableChecks = 0;
    const startedAt = Date.now();

    while (Date.now() - startedAt < 3200 && !shouldStop) {
        await delay(220);
        const candidate = getVisiblePlaceSnapshot();
        const expectedName = place.fallbackName || getNameFromMapsUrl(place.href);
        if (!candidate || (expectedName && !namesLikelySame(candidate.name, expectedName))) continue;

        latest = candidate;
        if (candidate.signature === previousSignature) stableChecks++;
        else stableChecks = 0;
        previousSignature = candidate.signature;

        if (Date.now() - startedAt >= 900 && stableChecks >= 3) break;
    }
    return latest;
}

function findCurrentPlaceLink(key) {
    return Array.from(document.querySelectorAll('a[href*="/maps/place/"]')).find(link => getPlaceKey(link.href) === key);
}

function getVisiblePlaceSnapshot() {
    const headings = Array.from(document.querySelectorAll('h1.DUwDvf, div[role="main"] h1.DUwDvf, div[role="main"] h1[role="heading"]'))
        .filter(element => element.isConnected && isVisible(element));

    for (const heading of headings) {
        const headingText = cleanText(heading.textContent);
        if (!isBusinessName(headingText)) continue;
        const root = findDetailRoot(heading);
        if (!root) continue;
        return { name: headingText, root, heading, signature: getDetailSignature(root, headingText) };
    }
    return null;
}

function getDetailSignature(root, name) {
    const itemIds = Array.from(root.querySelectorAll('[data-item-id]'))
        .slice(0, 12)
        .map(element => `${element.getAttribute('data-item-id') || ''}:${cleanText(element.textContent).slice(0, 80)}`)
        .join('|');
    return `${normalizeComparableName(name)}|${itemIds}`;
}

function findDetailRoot(heading) {
    const roleMain = heading.closest('div[role="main"]');
    if (roleMain && isVisible(roleMain)) return roleMain;

    let current = heading.parentElement;
    while (current && current !== document.body) {
        const dataItems = current.querySelectorAll('[data-item-id]').length;
        const actionButtons = current.querySelectorAll('button[aria-label], a[href]').length;
        if (dataItems >= 2 && actionButtons >= 3 && current.clientHeight > 180) return current;
        current = current.parentElement;
    }
    return null;
}

function extractPhone(root) {
    const selectors = [
        '[data-item-id^="phone:tel:"]',
        'a[href^="tel:"]',
        'button[aria-label*="telefone" i]',
        'button[aria-label*="phone" i]',
        'button[data-tooltip*="telefone" i]',
        'button[data-tooltip*="phone" i]'
    ];
    const candidates = Array.from(root.querySelectorAll(selectors.join(',')));

    for (const element of candidates) {
        const sources = [
            (element.getAttribute('data-item-id') || '').replace(/^phone:tel:/i, ''),
            (element.getAttribute('href') || '').replace(/^tel:/i, ''),
            element.querySelector('.fontBodyMedium')?.textContent,
            element.getAttribute('aria-label'),
            element.getAttribute('data-tooltip'),
            element.textContent
        ];
        for (const source of sources) {
            const phone = extractPhoneNumber(source);
            if (phone) return phone;
        }
    }
    return '';
}

function extractPhoneNumber(value) {
    const text = cleanText(value);
    if (!text) return '';
    const matches = text.match(/\+?\s*\(?\d[\d\s().-]{7,}\d/g) || [];
    for (const match of matches) {
        const digits = match.replace(/\D/g, '');
        if (digits.length >= 10 && digits.length <= 15) return cleanText(match);
    }
    return '';
}

function extractEmail(root) {
    const preferredSources = [];
    Array.from(root.querySelectorAll('a[href^="mailto:"]')).forEach(link => preferredSources.push(link.getAttribute('href')));
    Array.from(root.querySelectorAll(
        '[data-item-id*="email" i], [aria-label*="e-mail" i], [aria-label*="email" i], [data-tooltip*="e-mail" i], [data-tooltip*="email" i]'
    )).forEach(element => {
        preferredSources.push(element.getAttribute('aria-label'));
        preferredSources.push(element.getAttribute('data-tooltip'));
        preferredSources.push(element.textContent);
    });
    preferredSources.push(root.textContent);

    for (const source of preferredSources) {
        const matches = String(source || '').match(/[a-z0-9.!#$%&'*+/=?^_~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/gi) || [];
        for (const match of matches) {
            const email = normalizeEmailAddress(match);
            if (email) return email;
        }
    }
    return '';
}

function normalizeEmailAddress(rawEmail) {
    let email = String(rawEmail || '').replace(/^mailto:/i, '').split('?')[0].trim().toLowerCase();
    try {
        email = decodeURIComponent(email);
    } catch (_) {}
    email = email.replace(/^[<("'[\s]+|[>)"',;:\]\s]+$/g, '');
    if (email.length > 254 || !/^[a-z0-9.!#$%&'*+/=?^_~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(email)) return '';
    const parts = email.split('@');
    const rejectedTopLevels = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'css', 'js', 'woff', 'woff2']);
    if (parts[0].length > 64 || rejectedTopLevels.has(parts[1].split('.').pop())) return '';
    if (/^(?:no-?reply|donotreply)$/i.test(parts[0])) return '';
    return email;
}

function extractWebsite(root) {
    const link = root.querySelector('a[data-item-id="authority"], a[aria-label^="Site" i], a[aria-label^="Website" i]');
    if (!link) return '';
    return getExternalUrl(link.href);
}

function extractSocialLinks(root) {
    const unique = new Set();
    Array.from(root.querySelectorAll('a[href], [data-href]')).forEach(link => {
        const external = getExternalUrl(link.href || link.getAttribute('data-href'));
        if (!external) return;
        const normalized = normalizeSocialLink(external);
        if (normalized) unique.add(normalized);
    });
    return Array.from(unique);
}

function normalizeSocialLink(rawUrl) {
    try {
        const url = new URL(rawUrl);
        const host = url.hostname.replace(/^www\./, '').toLowerCase();
        if (!SOCIAL_DOMAINS.some(domain => host === domain || host.endsWith('.' + domain))) return '';
        const path = url.pathname.replace(/\/+$/, '') || '/';
        if (path === '/') return '';
        const lowerPath = path.toLowerCase();
        const rejected = ['/share', '/sharer', '/dialog', '/intent', '/search', '/watch', '/shorts', '/embed', '/explore', '/accounts', '/reel', '/stories', '/video/'];
        if (rejected.some(fragment => lowerPath === fragment || lowerPath.startsWith(fragment + '/') || lowerPath.includes(fragment))) return '';
        url.hash = '';
        ['hl', 'utm_source', 'utm_medium', 'utm_campaign', 'gclid', 'fbclid', 'igshid'].forEach(param => url.searchParams.delete(param));
        return url.toString().replace(/\/$/, '');
    } catch (_) {
        return '';
    }
}

function requestWebsiteEnrichment(website) {
    return new Promise(resolve => {
        let completed = false;
        const finish = data => {
            if (completed) return;
            completed = true;
            clearTimeout(timeout);
            resolve(data || { email: '', social: [], pagesChecked: 0 });
        };
        const timeout = setTimeout(() => finish(null), 13000);
        chrome.runtime.sendMessage({ action: 'enrich_public_contacts', website }, response => {
            if (chrome.runtime.lastError || !response || response.status !== 'ok') {
                finish(null);
                return;
            }
            finish(response.data);
        });
    });
}

function extractAddress(root) {
    const button = root.querySelector('button[data-item-id="address"], button[aria-label^="Endereço" i], button[aria-label^="Address" i]');
    if (!button) return '';
    const text = cleanText(button.querySelector('.fontBodyMedium')?.textContent || button.textContent);
    return text || stripLabel(button.getAttribute('aria-label'), ['endereço', 'address', 'copiar endereço', 'copy address']);
}

function extractCategory(root, businessName) {
    const candidates = [
        root.querySelector('button[jsaction*="category"]'),
        root.querySelector('.DkEaL'),
        root.querySelector('div.fontBodyMedium button')
    ];
    for (const element of candidates) {
        const text = cleanText(element?.textContent);
        if (text && text !== businessName && text.length < 100) return text;
    }
    return '';
}

function getExternalUrl(href) {
    if (!href) return '';
    try {
        const url = new URL(href, location.href);
        if (url.hostname.includes('google.') || url.hostname === 'google.com') {
            const redirected = url.searchParams.get('q') || url.searchParams.get('url');
            if (redirected) return decodeURIComponent(redirected);
        }
        if (url.protocol === 'http:' || url.protocol === 'https:') return url.href;
    } catch (_) {}
    return '';
}

function getFilteredReason(row, filters) {
    if (filters.filterNoWebsite && hasValue(row.website)) return 'possui site';
    if (filters.requirePhone && !hasValue(row.telefone)) return 'sem telefone';
    if (filters.requireEmail && !hasValue(row.email)) return 'sem e-mail';
    if (filters.requireSocialMedia && !hasValue(row.social)) return 'sem redes sociais';
    return '';
}

function upsertLead(results, resultIndex, row) {
    const phoneKey = normalizePhone(row.telefone);
    const identityKey = phoneKey ? `phone:${phoneKey}` : `place:${row.placeKey}`;
    const existingIndex = resultIndex.get(identityKey);
    if (existingIndex === undefined) {
        resultIndex.set(identityKey, results.length);
        results.push(row);
        return { isNew: true, row };
    }

    const merged = mergeLead(results[existingIndex], row);
    results[existingIndex] = merged;
    return { isNew: false, row: merged };
}

function mergeLead(base, incoming) {
    const result = { ...base };
    ['nome', 'telefone', 'email', 'website', 'endereco', 'categoria', 'mapsUrl'].forEach(field => {
        if (!hasValue(result[field]) && hasValue(incoming[field])) result[field] = incoming[field];
    });
    const socials = new Set(
        [result.social, incoming.social]
            .filter(Boolean)
            .flatMap(value => String(value).split(',').map(item => item.trim()).filter(Boolean))
    );
    result.social = Array.from(socials).join(', ');
    result.semSite = !hasValue(result.website);
    result.extraidoEm = Math.min(result.extraidoEm || Date.now(), incoming.extraidoEm || Date.now());
    return result;
}

async function returnToResults() {
    const backButton = Array.from(document.querySelectorAll('button[aria-label="Voltar"], button[aria-label="Back"]')).find(isVisible);
    if (backButton) safeClick(backButton);
    await waitFor(findResultsFeed, 6000);
    await delay(300);
}

async function loadMoreResults(feed, queuedKeys) {
    const beforeScrollTop = feed.scrollTop;
    const beforeScrollHeight = feed.scrollHeight;
    const lastLink = Array.from(feed.querySelectorAll('a[href*="/maps/place/"]')).pop();
    if (lastLink) lastLink.scrollIntoView({ behavior: 'auto', block: 'end' });

    const distance = Math.max(Math.floor(feed.clientHeight * 0.88), 900);
    feed.scrollBy({ top: distance, behavior: 'auto' });
    feed.dispatchEvent(new WheelEvent('wheel', { deltaY: distance, bubbles: true, cancelable: true }));

    const newLink = await waitFor(() => {
        const currentFeed = findResultsFeed() || feed;
        const links = Array.from(currentFeed.querySelectorAll('a[href*="/maps/place/"]'));
        return links.some(link => !queuedKeys.has(getPlaceKey(link.href))) ? true : null;
    }, 2300, 180);

    if (newLink) return true;
    const currentFeed = findResultsFeed() || feed;
    return currentFeed.scrollTop !== beforeScrollTop || currentFeed.scrollHeight > beforeScrollHeight;
}

function hasEndOfListMarker(feed) {
    const text = cleanText(feed.textContent).toLowerCase();
    return text.includes('você chegou ao final da lista') ||
        text.includes('you\'ve reached the end of the list') ||
        text.includes('fim dos resultados') ||
        text.includes('end of results');
}

function sendSnapshot({ results, queuedKeys, processedKeys, filters, stage, currentLead, row = null }) {
    const target = filters.maxResults || null;
    const percent = target ? Math.min(99, Math.round((results.length / target) * 100)) : null;
    sendProgress({
        processed: processedKeys.size,
        collected: results.length,
        discovered: queuedKeys.size,
        target,
        percent,
        indeterminate: !target,
        stage,
        currentLead,
        row
    });
}

async function waitWhilePaused() {
    while (isPaused && !shouldStop) await delay(350);
}

function waitFor(getter, timeoutMs = 5000, intervalMs = 150) {
    return new Promise(resolve => {
        const start = Date.now();
        const tick = () => {
            const value = getter();
            if (value) return resolve(value);
            if (Date.now() - start >= timeoutMs) return resolve(null);
            setTimeout(tick, intervalMs);
        };
        tick();
    });
}

function safeClick(element) {
    element.scrollIntoView({ behavior: 'auto', block: 'center' });
    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
    element.click();
}

function isVisible(element) {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
}

function isBusinessName(value) {
    const name = cleanText(value);
    if (!name || name.length < 2) return false;
    const ignored = ['results', 'resultados', 'google maps', 'menu', 'ações'];
    return !ignored.includes(name.toLowerCase());
}

function getNameFromMapsUrl(href) {
    try {
        const match = new URL(href).pathname.match(/\/maps\/place\/([^/]+)/i);
        if (!match) return '';
        return cleanText(decodeURIComponent(match[1]).replace(/\+/g, ' '));
    } catch (_) {
        return '';
    }
}

function stripLabel(value, labels) {
    let result = cleanText(value);
    labels.forEach(label => {
        result = result.replace(new RegExp(`^${escapeRegex(label)}\\s*[:,-]?\\s*`, 'i'), '');
    });
    return cleanText(result);
}

function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function looksLikePhone(value) {
    return Boolean(extractPhoneNumber(value));
}

function normalizePhone(value) {
    return hasValue(value) ? String(value).replace(/\D/g, '') : '';
}

function hasValue(value) {
    const text = cleanText(value);
    return Boolean(text && !['não encontrado', 'not found', 'sem nome'].includes(text.toLowerCase()));
}

function cleanText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function sendLog(message) {
    chrome.runtime.sendMessage({ type: 'EXTRACTION_LOG', message });
}

function sendProgress(payload) {
    chrome.runtime.sendMessage({ type: 'EXTRACTION_PROGRESS', payload });
}

function sendFinish(payload) {
    chrome.runtime.sendMessage({ type: 'EXTRACTION_FINISHED', payload });
}
