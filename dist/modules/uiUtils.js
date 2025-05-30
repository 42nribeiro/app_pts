import * as DOM from './domElements';
import { state } from './config';
export function showLoadingIndicator(show) {
    if (DOM.loadingIndicator)
        DOM.loadingIndicator.style.display = show ? 'flex' : 'none';
}
export function hexToRgba(hex, alpha) {
    if (!hex || !hex.startsWith('#'))
        return null;
    const rVal = parseInt(hex.slice(1, 3), 16);
    const gVal = parseInt(hex.slice(3, 5), 16);
    const bVal = parseInt(hex.slice(5, 7), 16);
    return `rgba(${rVal},${gVal},${bVal},${alpha})`;
}
export function getCalendarColorStyle(colorId) {
    if (!colorId)
        return null;
    const colors = {
        '1': '#a4bdfc', '2': '#7ae7bf', '3': '#dbadff', '4': '#ff887c',
        '5': '#fbd75b', '6': '#ffb878', '7': '#46d6db', '8': '#e1e1e1',
        '9': '#5484ed', '10': '#51b749', '11': '#dc2127'
    };
    return colors[colorId] ? hexToRgba(colors[colorId], 0.12) : null;
}
let alertTimeoutId = null;
export function showCustomAlert(message, isError = false, duration = 3000) {
    if (!DOM.alertDiv || !DOM.alertMessage || !DOM.alertOverlay) {
        alert(message);
        return;
    }
    if (alertTimeoutId)
        clearTimeout(alertTimeoutId);
    DOM.alertMessage.innerHTML = message;
    DOM.alertDiv.className = 'custom-alert';
    DOM.alertDiv.classList.add(isError ? 'error' : 'success');
    DOM.alertOverlay.style.display = 'block';
    DOM.alertDiv.style.display = 'block';
    void DOM.alertDiv.offsetWidth;
    DOM.alertOverlay.classList.add('show');
    DOM.alertDiv.classList.add('show');
    alertTimeoutId = window.setTimeout(hideCustomAlert, duration);
}
export function hideCustomAlert() {
    if (alertTimeoutId) {
        clearTimeout(alertTimeoutId);
        alertTimeoutId = null;
    }
    if (DOM.alertDiv && DOM.alertDiv.classList.contains('show')) {
        DOM.alertDiv.classList.remove('show');
        const transitionDuration = 250;
        setTimeout(() => {
            if (DOM.alertDiv)
                DOM.alertDiv.style.display = 'none';
            if (DOM.alertOverlay) {
                DOM.alertOverlay.classList.remove('show');
                DOM.alertOverlay.style.display = 'none';
            }
        }, transitionDuration);
    }
    else if (DOM.alertOverlay && DOM.alertOverlay.classList.contains('show')) {
        DOM.alertOverlay.classList.remove('show');
        DOM.alertOverlay.style.display = 'none';
    }
}
export function setupAlerts() {
    if (DOM.alertOverlay) {
        DOM.alertOverlay.addEventListener('click', (e) => {
            if (e.target === DOM.alertOverlay) {
                if (DOM.exerciseModal && DOM.exerciseModal.style.display !== 'none') {
                }
                else {
                    hideCustomAlert();
                }
            }
        });
    }
    const okButton = DOM.alertDiv?.querySelector('#custom-alert-ok-btn');
    if (okButton) {
        okButton.addEventListener('click', hideCustomAlert);
    }
}
export function handleBackendError(error, context = "General API Call") {
    console.error(`Backend Error (${context}):`, error);
    let message = "Ocorreu um erro inesperado.";
    if (error && typeof error === 'object') {
        if (error.status === 0 || error.message?.toLowerCase().includes('failed to fetch')) {
            message = "Falha na conexão com o servidor. Verifique sua internet e se o servidor está online.";
        }
        else if (error.data && error.data.mensagem) {
            message = error.data.mensagem;
        }
        else if (error.message) {
            message = error.message;
        }
        else if (error.erro) {
            message = error.erro;
        }
    }
    else if (typeof error === 'string') {
        message = error;
    }
    showCustomAlert(message, true, 5000);
    if (DOM.trainingPlansContainer)
        DOM.trainingPlansContainer.innerHTML = `<p class="text-center text-muted p-3">${message}</p>`;
    resetHeaderStats();
    showLoadingIndicator(false);
    enableActionButtons();
    state.isFiltering = false;
}
export function resetHeaderStats() {
    const setVal = (element, value) => {
        if (element)
            element.value = value;
    };
    setVal(DOM.treinosConcluidosInput, '0');
    setVal(DOM.numeroTreinosInput, '0');
    setVal(DOM.filtroHorasInput, '--');
    setVal(DOM.filtroNivelInput, '--');
}
export function disableActionButtons() {
    if (DOM.buscarPlanosBtn)
        DOM.buscarPlanosBtn.disabled = true;
    if (DOM.calcularMetricasBtn)
        DOM.calcularMetricasBtn.disabled = true;
    if (DOM.estatisticasBtn)
        DOM.estatisticasBtn.disabled = true;
}
export function enableActionButtons() {
    if (DOM.buscarPlanosBtn)
        DOM.buscarPlanosBtn.disabled = false;
    if (DOM.calcularMetricasBtn)
        DOM.calcularMetricasBtn.disabled = false;
    if (DOM.estatisticasBtn)
        DOM.estatisticasBtn.disabled = false;
}
export function formatAvaliacaoKey(key) {
    const map = {
        peso: "Peso", altura: "Altura", massaMuscular: "M. Muscular", massaGorda: "M. Gorda",
        gorduraVisceral: "G. Visceral", idadeBiologica: "Idade Biológica", metabolismoBasal: "Metab. Basal",
        massaOssea: "M. Óssea", h2o: "H2O (%)", pressaoArterial: "P. Arterial",
        perimetroAbdominal: "Per. Abdominal", observacoes: "Obs. Avaliação"
    };
    return map[key] || key.charAt(0).toUpperCase() + key.slice(1);
}
export function toggleFullscreen() {
    const docElement = document.documentElement;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIOS) {
        const body = document.body;
        body.classList.toggle('ios-fullscreen');
    }
    else {
        if (!document.fullscreenElement) {
            docElement.requestFullscreen().catch(e => {
                showCustomAlert("Falha ao entrar em tela cheia: " + (e.message || e), true);
            });
        }
        else {
            if (document.exitFullscreen)
                document.exitFullscreen();
        }
    }
    setTimeout(() => window.dispatchEvent(new Event('resize')), 150);
}
export function setupKeyboardScrollHandler() {
    document.body.addEventListener('focusin', (e) => {
        const target = e.target;
        if (!(target.matches('input[type="text"], input[type="email"], input[type="search"], input[type="tel"], input[type="url"], textarea') || target.matches('input[type="number"]') || target.matches('input[type="password"]')))
            return;
        const isModalSearch = target.matches('#modal-search-input');
        const modalElement = target.closest('#exercise-modal');
        if (isModalSearch && modalElement) {
            setTimeout(() => {
                if (document.activeElement === target && modalElement.style.display !== 'none' && typeof target.scrollIntoView === 'function') {
                    target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                }
            }, 300);
        }
        else {
            const isReadOnlyOrDisabled = target.readOnly || target.disabled || target.closest('.item-readonly') || target.closest('.plan-readonly');
            const isInFilterContainer = target.closest('#filter-container');
            const isInOtherModalButNotSearch = modalElement && !isModalSearch;
            if (!(isReadOnlyOrDisabled || isInFilterContainer || isInOtherModalButNotSearch)) {
                setTimeout(() => {
                    if (document.activeElement === target && typeof target.scrollIntoView === 'function') {
                        target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
                    }
                }, 300);
            }
        }
    });
}
