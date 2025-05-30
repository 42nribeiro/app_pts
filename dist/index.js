import * as DOM from './modules/domElements';
import { setupAlerts, toggleFullscreen, setupKeyboardScrollHandler, handleBackendError } from './modules/uiUtils';
import { filtrarPlanos, executarCalculoMetricas, toggleFilterVisibility, displayClienteSuggestions, hideClienteSuggestions } from './modules/filterHandlers';
import * as planManager from './modules/planManager';
import * as modalManager from './modules/modalManager';
import * as chartManager from './modules/chartManager';
import { fetchApi } from './modules/api';
window.app = {
    planManager,
    modalManager,
    chartManager,
    filterHandlers: {
        toggleFilterVisibility
    },
    uiUtils: {
        toggleFullscreen
    }
};
document.addEventListener('DOMContentLoaded', () => {
    setupAlerts();
    if (DOM.dateRangeFilterInput) {
        flatpickr(DOM.dateRangeFilterInput, { mode: "range", dateFormat: "d/m/Y", locale: "pt" });
    }
    if (DOM.appIcon)
        DOM.appIcon.addEventListener('click', toggleFullscreen);
    if (DOM.toggleFilterButton)
        DOM.toggleFilterButton.addEventListener('click', toggleFilterVisibility);
    if (DOM.buscarPlanosBtn)
        DOM.buscarPlanosBtn.addEventListener('click', filtrarPlanos);
    if (DOM.calcularMetricasBtn)
        DOM.calcularMetricasBtn.addEventListener('click', executarCalculoMetricas);
    if (DOM.estatisticasBtn)
        DOM.estatisticasBtn.addEventListener('click', modalManager.abrirModalEstatisticas);
    let clienteSuggestionTimeout;
    if (DOM.nomeFiltroInput && DOM.clienteSuggestionsDropdown) {
        DOM.nomeFiltroInput.addEventListener('input', () => {
            clearTimeout(clienteSuggestionTimeout);
            const inputText = DOM.nomeFiltroInput.value.trim();
            if (inputText.length < 2) {
                hideClienteSuggestions();
                return;
            }
            clienteSuggestionTimeout = window.setTimeout(async () => {
                const corVal = DOM.corSelect?.value ?? '';
                const personalTrainerVal = DOM.personalTrainerSelect?.value ?? '';
                const params = new URLSearchParams({ inputText, corFiltro: corVal, ptFiltro: personalTrainerVal });
                try {
                    const suggestionsArray = await fetchApi(`/api/suggestions/client?${params.toString()}`, {}, 'getClientSuggestions');
                    displayClienteSuggestions(suggestionsArray || [], inputText);
                }
                catch (error) {
                    console.error("Erro ao buscar sugestões de cliente:", error);
                    hideClienteSuggestions();
                }
            }, 300);
        });
        document.addEventListener('click', function (event) {
            const target = event.target;
            if (DOM.nomeFiltroInput && !DOM.nomeFiltroInput.contains(target) &&
                DOM.clienteSuggestionsDropdown && !DOM.clienteSuggestionsDropdown.contains(target)) {
                hideClienteSuggestions();
            }
        });
    }
    const overlaysToCloseModals = {
        'avaliacao-modal-overlay': modalManager.fecharModalAvaliacao,
        'estatisticas-modal-overlay': modalManager.fecharModalEstatisticas,
    };
    for (const overlayId in overlaysToCloseModals) {
        const overlay = document.getElementById(overlayId);
        if (overlay) {
            overlay.addEventListener('click', (e) => { if (e.target === overlay) {
                overlaysToCloseModals[overlayId]();
            } });
        }
    }
    if (DOM.alertOverlay) {
        DOM.alertOverlay.addEventListener('click', e => {
            if (e.target === DOM.alertOverlay) {
                if (DOM.exerciseModal && DOM.exerciseModal.style.display !== 'none') {
                    modalManager.hideExerciseModal();
                }
            }
        });
    }
    if (DOM.alertDiv) {
        const okButton = DOM.alertDiv.querySelector('#custom-alert-ok-btn');
        if (okButton)
            okButton.addEventListener('click', () => import('./modules/uiUtils').then(ui => ui.hideCustomAlert()));
    }
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            if (DOM.exerciseModal && DOM.exerciseModal.style.display !== 'none') {
                if (document.activeElement === DOM.modalSearchInput && DOM.modalSearchInput.value !== '')
                    return;
                e.preventDefault();
                modalManager.hideExerciseModal();
            }
            else if (DOM.avaliacaoModal && DOM.avaliacaoModal.style.display !== 'none') {
                e.preventDefault();
                modalManager.fecharModalAvaliacao();
            }
            else if (DOM.estatisticasModal && DOM.estatisticasModal.style.display !== 'none') {
                e.preventDefault();
                modalManager.fecharModalEstatisticas();
            }
            else if (DOM.alertDiv && DOM.alertDiv.style.display !== 'none' && DOM.alertDiv.classList.contains('show')) {
                e.preventDefault();
                import('./modules/uiUtils').then(ui => ui.hideCustomAlert());
            }
        }
        if (e.key === 'Enter' && DOM.exerciseModal && DOM.exerciseModal.style.display !== 'none' && document.activeElement === DOM.modalSearchInput) {
            e.preventDefault();
            const searchTerm = DOM.modalSearchInput.value.trim();
            if (!searchTerm && DOM.modalListContainer) {
                const firstItem = DOM.modalListContainer.querySelector('.suggestion-item');
                if (firstItem)
                    firstItem.click();
                return;
            }
            if (!searchTerm)
                return;
            const modalItems = DOM.modalListContainer.querySelectorAll('.suggestion-item, .add-new-suggestion');
            if (modalItems.length > 0) {
                const addNewSuggestionButton = DOM.modalListContainer.querySelector('.add-new-suggestion');
                if (addNewSuggestionButton && (modalItems.length === 1 || addNewSuggestionButton === modalItems[0])) {
                    addNewSuggestionButton.click();
                }
                else {
                    const firstSuggestion = DOM.modalListContainer.querySelector('.suggestion-item');
                    if (firstSuggestion)
                        firstSuggestion.click();
                }
            }
        }
    });
    if (DOM.exerciseModalCloseButton)
        DOM.exerciseModalCloseButton.addEventListener('click', modalManager.hideExerciseModal);
    setupKeyboardScrollHandler();
    if (typeof Chart !== 'undefined' && typeof ChartDataLabels !== 'undefined') {
        Chart.register(ChartDataLabels);
        Chart.defaults.font.family = 'Roboto, "Helvetica Neue", Arial, sans-serif';
        Chart.defaults.font.size = 11;
        Chart.defaults.color = '#333';
        Chart.defaults.plugins.legend.display = false;
        Chart.defaults.plugins.datalabels.display = false;
        Chart.defaults.plugins.datalabels.borderRadius = 3;
        Chart.defaults.plugins.datalabels.font = { weight: 'bold', size: 9 };
    }
    (async () => {
        console.log("DOM fully loaded. Starting initial data fetch...");
        try {
            await filtrarPlanos();
        }
        catch (initialError) {
            console.error("Erro no carregamento inicial:", initialError);
            handleBackendError(initialError, "Initial Page Load");
        }
    })();
});
