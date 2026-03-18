const API_URL = 'https://gestione-eventi-backend.onrender.com';
let currentUser = null;
let currentToken = null;
let currentView = 'login';
let selectedEventForCheckin = null;
document.addEventListener('DOMContentLoaded', () => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (savedToken && savedUser) {
        currentToken = savedToken;
        currentUser = JSON.parse(savedUser);
        initApp();
    } else {
        renderView('login');
    }
    document.getElementById('nav-dashboard').addEventListener('click', (e) => { e.preventDefault(); renderView('dashboard'); });
    document.getElementById('nav-stats').addEventListener('click', (e) => { e.preventDefault(); renderView('stats'); });
    document.getElementById('nav-logout').addEventListener('click', (e) => { e.preventDefault(); logout(); });
});
function initApp() {
    document.getElementById('navbar').style.display = 'block';
    document.getElementById('user-welcome').innerHTML = `Ciao, <b>${currentUser.Nome}</b> (${currentUser.Ruolo})`;
    if (currentUser.Ruolo === 'Organizzatore') {
        document.getElementById('nav-stats').style.display = 'block';
    } else {
        document.getElementById('nav-stats').style.display = 'none';
    }
    renderView('dashboard');
}
async function fetchAPI(endpoint, method = 'GET', body = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (currentToken) {
        headers['Authorization'] = `Bearer ${currentToken}`;
    }
    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);
    try {
        const response = await fetch(`${API_URL}/${endpoint}`, options);
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Si è verificato un errore');
        }
        return data;
    } catch (error) {
        showToast(error.message, 'error');
        if (error.message.toLowerCase().includes('token scaduto') || error.message.toLowerCase().includes('token non valido')) {
            logout();
        }
        throw error;
    }
}
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-check-circle' : 'fa-circle-exclamation'}"></i> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
function formatDate(dateStr) {
    const opts = { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateStr).toLocaleDateString('it-IT', opts);
}
function renderView(viewName) {
    const container = document.getElementById('app-container');
    container.innerHTML = '';
    currentView = viewName;
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    if (viewName === 'login') {
        document.getElementById('navbar').style.display = 'none';
        const tpl = document.getElementById('tpl-login').content.cloneNode(true);
        container.appendChild(tpl);
        bindLoginEvents();
        return;
    }
    if (viewName === 'dashboard') {
        document.getElementById('nav-dashboard').classList.add('active');
        if (currentUser.Ruolo === 'Organizzatore') {
            const tpl = document.getElementById('tpl-dashboard-organizzatore').content.cloneNode(true);
            container.appendChild(tpl);
            bindDashboardOrgEvents();
            loadEventiOrg();
        } else {
            const tpl = document.getElementById('tpl-dashboard-dipendente').content.cloneNode(true);
            container.appendChild(tpl);
            loadEventiDip();
            loadIscrizioniDip();
        }
        return;
    }
    if (viewName === 'stats' && currentUser.Ruolo === 'Organizzatore') {
        document.getElementById('nav-stats').classList.add('active');
        const tpl = document.getElementById('tpl-statistiche').content.cloneNode(true);
        container.appendChild(tpl);
        bindStatsEvents();
        loadStatistiche();
        return;
    }
}
function bindLoginEvents() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const forms = document.querySelectorAll('.auth-form');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            tabBtns.forEach(b => b.classList.remove('active'));
            forms.forEach(f => f.style.display = 'none');
            e.target.classList.add('active');
            document.getElementById(e.target.dataset.target).style.display = 'block';
        });
    });
    document.getElementById('form-login').addEventListener('submit', async (e) => {
        e.preventDefault();
        const Email = document.getElementById('login-email').value;
        const Password = document.getElementById('login-password').value;
        try {
            const res = await fetchAPI('utenti/login.php', 'POST', { Email, Password });
            currentToken = res.token;
            currentUser = res.user;
            localStorage.setItem('token', currentToken);
            localStorage.setItem('user', JSON.stringify(currentUser));
            showToast('Login effettuato con successo!');
            initApp();
        } catch(err) {}
    });
    document.getElementById('form-register').addEventListener('submit', async (e) => {
        e.preventDefault();
        const body = {
            Nome: document.getElementById('reg-nome').value,
            Cognome: document.getElementById('reg-cognome').value,
            Email: document.getElementById('reg-email').value,
            Password: document.getElementById('reg-password').value,
            Ruolo: document.getElementById('reg-ruolo').value
        };
        try {
            await fetchAPI('utenti/register.php', 'POST', body);
            showToast('Registrazione completata. Ora puoi accedere!');
            document.querySelector('.tab-btn[data-target="form-login"]').click();
        } catch(err) {}
    });
}
function logout() {
    currentToken = null;
    currentUser = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    renderView('login');
}
async function loadEventiDip() {
    const list = document.getElementById('lista-eventi-d');
    try {
        const eventi = await fetchAPI('eventi.php', 'GET');
        list.innerHTML = '';
        if(eventi.length === 0) return list.innerHTML = '<p class="text-muted">Nessun evento disponibile al momento.</p>';
        eventi.forEach(ev => {
            const div = document.createElement('div');
            div.className = 'list-item fade-in';
            const dateStr = formatDate(ev.Data);
            const isPast = new Date(ev.Data) <= new Date();
            div.innerHTML = `
                <div class="list-item-main">
                    <div class="item-title">${ev.Titolo} ${isPast ? '<span class="badge badge-warning">Scaduto</span>' : ''}</div>
                    <div class="item-meta"><i class="fa-regular fa-calendar"></i> ${dateStr}</div>
                    <div class="item-desc">${ev.Descrizione}</div>
                </div>
                <div class="list-item-actions">
                    ${!isPast ? `<button class="btn btn-secondary btn-small" onclick="iscriviti('${ev.EventoID}')">Iscriviti</button>` : ''}
                </div>
            `;
            list.appendChild(div);
        });
    } catch(err) {}
}
async function loadIscrizioniDip() {
    const list = document.getElementById('lista-iscrizioni');
    try {
        const iscrizioni = await fetchAPI('iscrizioni.php', 'GET');
        list.innerHTML = '';
        if(iscrizioni.length === 0) return list.innerHTML = '<p class="text-muted">Non sei iscritto a nessun evento.</p>';
        iscrizioni.forEach(isc => {
            if(!isc.Eventi) return;
            const div = document.createElement('div');
            div.className = 'list-item fade-in';
            const ev = isc.Eventi;
            const dateStr = formatDate(ev.Data);
            const isScaduto = new Date(ev.Data) <= new Date();
            div.innerHTML = `
                <div class="list-item-main">
                    <div class="item-title">${ev.Titolo}</div>
                    <div class="item-meta"><i class="fa-regular fa-calendar"></i> ${dateStr}</div>
                    ${isc.CheckinEffettuato ? '<span class="badge badge-success mt-2"><i class="fa-solid fa-check"></i> Check-in Effettuato!</span>' : '<span class="badge mt-2">In attesa evento</span>'}
                </div>
                <div class="list-item-actions">
                    ${!isScaduto && !isc.CheckinEffettuato ? `<button class="btn btn-danger btn-small" onclick="annullaIscrizione('${isc.IscrizioneID}')">Annulla</button>` : ''}
                </div>
            `;
            list.appendChild(div);
        });
    } catch(err) {}
}
window.iscriviti = async (eventoId) => {
    try {
        await fetchAPI('iscrizioni.php', 'POST', { EventoID: eventoId });
        showToast('Iscrizione effettuata con successo!');
        loadIscrizioniDip();
    } catch(e) {}
}
window.annullaIscrizione = async (iscrizioneId) => {
    if(!confirm("Vuoi davvero annullare l'iscrizione?")) return;
    try {
        await fetchAPI('iscrizioni.php', 'DELETE', { IscrizioneID: iscrizioneId });
        showToast('Iscrizione annullata!');
        loadIscrizioniDip();
    } catch(e) {}
}
function bindDashboardOrgEvents() {
    const modal = document.getElementById('modal-evento');
    const form = document.getElementById('form-evento');
    document.getElementById('btn-nuovo-evento').addEventListener('click', () => {
        form.reset();
        document.getElementById('ev-id').value = '';
        document.getElementById('modal-title').innerText = 'Crea Nuovo Evento';
        modal.style.display = 'flex';
    });
    document.getElementById('btn-close-modal').addEventListener('click', () => modal.style.display = 'none');
    document.getElementById('btn-cancel-evento').addEventListener('click', () => modal.style.display = 'none');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('ev-id').value;
        const body = {
            Titolo: document.getElementById('ev-titolo').value,
            Data: document.getElementById('ev-data').value,
            Descrizione: document.getElementById('ev-desc').value
        };
        try {
            if (id) {
                body.EventoID = id;
                await fetchAPI('eventi.php', 'PUT', body);
                showToast('Evento modificato!');
            } else {
                body.Data += ':00';
                await fetchAPI('eventi.php', 'POST', body);
                showToast('Evento creato!');
            }
            modal.style.display = 'none';
            loadEventiOrg();
        } catch(err) {}
    });
}
function dateTimeLocal(dateStr) {
    if(!dateStr) return '';
    const d = new Date(dateStr);
    const tzoffset = (new Date()).getTimezoneOffset() * 60000;
    const localISOTime = (new Date(d - tzoffset)).toISOString().slice(0,16);
    return localISOTime;
}
async function loadEventiOrg() {
    const list = document.getElementById('lista-eventi-org');
    try {
        const eventi = await fetchAPI('eventi.php', 'GET');
        list.innerHTML = '';
        if(eventi.length === 0) return list.innerHTML = '<p class="text-muted">Nessun evento presente.</p>';
        eventi.forEach(ev => {
            const div = document.createElement('div');
            div.className = 'list-item fade-in';
            div.innerHTML = `
                <div class="list-item-main">
                    <div class="item-title">${ev.Titolo}</div>
                    <div class="item-meta"><i class="fa-regular fa-calendar"></i> ${formatDate(ev.Data)}</div>
                </div>
                <div class="list-item-actions">
                    <button class="btn btn-secondary btn-icon" title="Gestisci Checkin" onclick="openCheckinPanel('${ev.EventoID}', '${ev.Titolo.replace(/'/g, "\\'")}')"><i class="fa-solid fa-clipboard-user"></i></button>
                    <button class="btn btn-secondary btn-icon" title="Modifica" onclick='editEvento(${JSON.stringify(ev)})'><i class="fa-solid fa-pen"></i></button>
                    <button class="btn btn-secondary btn-icon" title="Elimina" onclick="deleteEvento('${ev.EventoID}')"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            `;
            list.appendChild(div);
        });
    } catch(err) {}
}
window.editEvento = (ev) => {
    document.getElementById('ev-id').value = ev.EventoID;
    document.getElementById('ev-titolo').value = ev.Titolo;
    document.getElementById('ev-data').value = dateTimeLocal(ev.Data);
    document.getElementById('ev-desc').value = ev.Descrizione;
    document.getElementById('modal-title').innerText = 'Modifica Evento';
    document.getElementById('modal-evento').style.display = 'flex';
}
window.deleteEvento = async (id) => {
    if(!confirm('Sei sicuro di voler eliminare questo evento e tutte le sue iscrizioni?')) return;
    try {
        await fetchAPI('eventi.php', 'DELETE', { EventoID: id });
        showToast('Evento eliminato');
        if (selectedEventForCheckin === id) {
            document.getElementById('panel-checkin').style.display = 'none';
        }
        loadEventiOrg();
    } catch(err) {}
}
window.openCheckinPanel = async (eventoId, titolo) => {
    selectedEventForCheckin = eventoId;
    document.getElementById('panel-checkin').style.display = 'block';
    document.getElementById('checkin-titolo-evento').innerText = titolo;
    loadCheckinIscritti(eventoId);
}
async function loadCheckinIscritti(eventoId) {
    const list = document.getElementById('lista-partecipanti-checkin');
    list.innerHTML = '<div class="loader">Caricamento partecipanti...</div>';
    try {
        const iscritti = await fetchAPI(`iscrizioni.php?EventoID=${eventoId}`, 'GET');
        let effettuati = 0;
        if (iscritti.length === 0) {
             document.getElementById('checkin-stats-counter').innerHTML = 'Nessun iscritto a questo evento.';
             list.innerHTML = '';
             return;
        }
        list.innerHTML = '';
        iscritti.forEach(isc => {
            if(isc.CheckinEffettuato) effettuati++;
            const u = isc.Utenti;
            const div = document.createElement('div');
            div.className = 'list-item fade-in';
            div.innerHTML = `
                <div class="list-item-main">
                    <div class="item-title">${u.Nome} ${u.Cognome}</div>
                    <div class="item-meta"><i class="fa-regular fa-envelope"></i> ${u.Email}</div>
                </div>
                <div class="list-item-actions">
                    ${isc.CheckinEffettuato
                        ? `<span class="badge badge-success"><i class="fa-solid fa-check"></i> Check-in OK (${formatDate(isc.OraCheckin).split(', ')[1]})</span>`
                        : `<button class="btn btn-primary btn-small" onclick="registraCheckin('${isc.IscrizioneID}', '${eventoId}')">Fai Check-in</button>`}
                </div>
            `;
            list.appendChild(div);
        });
        document.getElementById('checkin-stats-counter').innerHTML = `
            <strong>Statistiche Check-in:</strong> ${effettuati} su ${iscritti.length} presenti
            <div class="progress-bar-container">
                <div class="progress-bar" style="width: ${(effettuati/iscritti.length)*100}%"></div>
            </div>
        `;
    } catch(err) {
        list.innerHTML = '<p class="text-danger">Errore nel caricamento.</p>';
    }
}
window.registraCheckin = async (iscrizioneId, eventoId) => {
    try {
        await fetchAPI('checkin.php', 'POST', { IscrizioneID: iscrizioneId });
        showToast('Check-in registrato!');
        loadCheckinIscritti(eventoId);
    } catch(err) {}
}
function bindStatsEvents() {
    document.getElementById('form-filtri').addEventListener('submit', (e) => {
        e.preventDefault();
        loadStatistiche();
    });
    document.getElementById('btn-reset-filtri').addEventListener('click', () => {
        document.getElementById('filtro-dal').value = '';
        document.getElementById('filtro-al').value = '';
        loadStatistiche();
    });
}
async function loadStatistiche() {
    const tableBody = document.getElementById('tabella-statistiche');
    const chart = document.getElementById('chart-container');
    const dal = document.getElementById('filtro-dal').value;
    const al = document.getElementById('filtro-al').value;
    let url = 'statistiche.php';
    const params = [];
    if(dal) params.push(`dal=${dal}`);
    if(al) params.push(`al=${al}`);
    if(params.length > 0) url += '?' + params.join('&');
    tableBody.innerHTML = '<tr><td colspan="5" class="text-center">Caricamento statistiche...</td></tr>';
    chart.innerHTML = '';
    try {
        const stats = await fetchAPI(url, 'GET');
        tableBody.innerHTML = '';
        if (stats.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" class="text-center">Nessun evento passato trovato per questo periodo.</td></tr>';
            return;
        }
        let chartHTML = '<h3 style="margin-bottom: 1.5rem; color: var(--primary);"><i class="fa-solid fa-chart-column"></i> Grafico Partecipazione</h3><div style="display:flex; flex-direction:column; gap: 1.5rem;">';
        stats.forEach(s => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${s.Titolo}</strong></td>
                <td>${formatDate(s.Data).split(',')[0]}</td>
                <td class="text-center">${s.Iscritti}</td>
                <td class="text-center">${s.CheckinEffettuati}</td>
                <td>
                    <div style="display:flex; justify-content:space-between; margin-bottom: 4px; font-weight: 500;">
                        <span>${s.PercentualePartecipazione}%</span>
                    </div>
                    <div class="progress-bar-container" style="background:#E5E7EB;">
                        <div class="progress-bar" style="width: ${s.PercentualePartecipazione}%; background: ${s.PercentualePartecipazione >= 75 ? 'var(--secondary)' : 'var(--primary)'};"></div>
                    </div>
                </td>
            `;
            tableBody.appendChild(tr);
            chartHTML += `
                <div style="font-size: 1rem;">
                    <div style="display:flex; justify-content:space-between; margin-bottom: 6px;">
                        <span style="font-weight: 500; color: var(--text-main);">${s.Titolo}</span>
                        <span style="font-weight: 700; color: var(--primary);">${s.PercentualePartecipazione}%</span>
                    </div>
                    <div class="progress-bar-container" style="height: 14px; background: #E5E7EB;">
                        <div class="progress-bar" style="width: ${s.PercentualePartecipazione}%; background: ${s.PercentualePartecipazione >= 75 ? 'var(--secondary)' : 'var(--primary)'}; border-radius: 999px;"></div>
                    </div>
                </div>
            `;
        });
        chartHTML += '</div>';
        chart.innerHTML = chartHTML;
    } catch(err) {
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Errore caricamento statistiche.</td></tr>';
    }
}