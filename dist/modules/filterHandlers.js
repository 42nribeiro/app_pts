import * as DOM from './domElements';
import { fetchApi } from './api';
import { state } from './config';
import { enableActionButtons, disableActionButtons, handleBackendError, resetHeaderStats } from './uiUtils';
import { mostrarPlanos } from './planManager';
export function toggleFilterVisibility() {
    if (!DOM.filterContainer || !DOM.toggleFilterButton) {
        console.warn("Filter container or toggle button not found for toggleFilterVisibility.");
        return;
    }
    hideClienteSuggestions();
    const isCurrentlyCollapsed = DOM.filterContainer.classList.contains('collapsed');
    DOM.filterContainer.style.overflow = 'hidden';
    DOM.filterContainer.style.transition = 'max-height 0.3s ease-out, opacity 0.3s ease-out, padding-top 0.3s ease-out, padding-bottom 0.3s ease-out, border-top-width 0.3s ease-out';
    if (isCurrentlyCollapsed) {
        DOM.filterContainer.classList.remove('collapsed');
        const finalPaddingTop = '9px';
        const finalPaddingBottom = '5px';
        const originalPaddingTop = DOM.filterContainer.style.paddingTop;
        const originalPaddingBottom = DOM.filterContainer.style.paddingBottom;
        DOM.filterContainer.style.paddingTop = finalPaddingTop;
        DOM.filterContainer.style.paddingBottom = finalPaddingBottom;
        const scrollHeight = DOM.filterContainer.scrollHeight + 'px';
        DOM.filterContainer.style.paddingTop = originalPaddingTop;
        DOM.filterContainer.style.paddingBottom = originalPaddingBottom;
        DOM.filterContainer.style.maxHeight = '0px';
        DOM.filterContainer.style.opacity = '0';
        DOM.filterContainer.style.borderTopWidth = '0px';
        requestAnimationFrame(() => {
            DOM.filterContainer.style.maxHeight = scrollHeight;
            DOM.filterContainer.style.opacity = '1';
            DOM.filterContainer.style.paddingTop = finalPaddingTop;
            DOM.filterContainer.style.paddingBottom = finalPaddingBottom;
            DOM.filterContainer.style.borderTopWidth = '1px';
        });
        DOM.toggleFilterButton.innerHTML = '<i class="fas fa-times"></i>';
        const onTransitionEnd = () => {
            if (!DOM.filterContainer.classList.contains('collapsed')) {
                DOM.filterContainer.style.maxHeight = 'none';
                DOM.filterContainer.style.overflow = 'visible';
            }
            DOM.filterContainer.removeEventListener('transitionend', onTransitionEnd);
        };
        DOM.filterContainer.addEventListener('transitionend', onTransitionEnd);
    }
    else {
        DOM.filterContainer.style.maxHeight = DOM.filterContainer.scrollHeight + 'px';
        requestAnimationFrame(() => {
            DOM.filterContainer.style.maxHeight = '0px';
            DOM.filterContainer.style.opacity = '0';
            DOM.filterContainer.style.paddingTop = '0px';
            DOM.filterContainer.style.paddingBottom = '0px';
            DOM.filterContainer.style.borderTopWidth = '0px';
        });
        DOM.toggleFilterButton.innerHTML = '<i class="fas fa-filter"></i>';
        const onTransitionEnd = () => {
            if (DOM.filterContainer.style.maxHeight === '0px' || DOM.filterContainer.style.opacity === '0') {
                DOM.filterContainer.classList.add('collapsed');
            }
            DOM.filterContainer.removeEventListener('transitionend', onTransitionEnd);
        };
        DOM.filterContainer.addEventListener('transitionend', onTransitionEnd);
    }
}
export async function filtrarPlanos() {
    if (state.isFiltering)
        return;
    state.isFiltering = true;
    disableActionButtons();
    try {
        const nomeFiltroVal = DOM.nomeFiltroInput.value.trim().toLowerCase() || 'pro';
        const personalTrainerVal = DOM.personalTrainerSelect.value;
        const corVal = DOM.corSelect.value;
        let dataInicioStr = '', dataFimStr = '';
        const datePickerInstance = DOM.dateRangeFilterInput?._flatpickr;
        if (datePickerInstance && datePickerInstance.selectedDates.length > 0) {
            dataInicioStr = flatpickr.formatDate(datePickerInstance.selectedDates[0], "d/m/Y");
            dataFimStr = datePickerInstance.selectedDates.length > 1
                ? flatpickr.formatDate(datePickerInstance.selectedDates[1], "d/m/Y")
                : dataInicioStr;
        }
        const params = new URLSearchParams();
        params.append('filtroNomeEvento', nomeFiltroVal);
        if (dataInicioStr)
            params.append('dataInicioStr', dataInicioStr);
        if (dataFimStr)
            params.append('dataFimStr', dataFimStr);
        if (personalTrainerVal)
            params.append('personalTrainer', personalTrainerVal);
        if (corVal)
            params.append('corEventoFiltro', corVal);
        const responseData = await fetchApi(`/api/planos?${params.toString()}`, {}, 'filtrarPlanos');
        mostrarPlanos(responseData);
    }
    catch (error) {
        handleBackendError(error, 'filtrarPlanos');
    }
    finally {
        state.isFiltering = false;
        enableActionButtons();
    }
}
export async function executarCalculoMetricas() {
    if (state.isFiltering)
        return;
    state.isFiltering = true;
    disableActionButtons();
    let periodoSelecionadoStr = "Período Não Especificado";
    const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    try {
        const nomeFiltroVal = DOM.nomeFiltroInput.value.trim().toLowerCase() || 'pro';
        const personalTrainerVal = DOM.personalTrainerSelect.value;
        const corVal = DOM.corSelect.value;
        let dataInicioStr = '', dataFimStr = '';
        const datePickerInstance = DOM.dateRangeFilterInput?._flatpickr;
        if (datePickerInstance && datePickerInstance.selectedDates.length > 0) {
            const dataInicioObj = datePickerInstance.selectedDates[0];
            dataInicioStr = flatpickr.formatDate(dataInicioObj, "d/m/Y");
            if (datePickerInstance.selectedDates.length > 1) {
                const dataFimObj = datePickerInstance.selectedDates[1];
                dataFimStr = flatpickr.formatDate(dataFimObj, "d/m/Y");
                const mesInicioNome = meses[dataInicioObj.getMonth()], anoInicio = dataInicioObj.getFullYear();
                const mesFimNome = meses[dataFimObj.getMonth()], anoFim = dataFimObj.getFullYear();
                periodoSelecionadoStr = mesInicioNome === mesFimNome && anoInicio === anoFim ? `${mesInicioNome} de ${anoInicio}` :
                    anoInicio === anoFim ? `${mesInicioNome} a ${mesFimNome} de ${anoInicio}` :
                        `${mesInicioNome}/${anoInicio} a ${mesFimNome}/${anoFim}`;
            }
            else {
                dataFimStr = dataInicioStr;
                periodoSelecionadoStr = `${meses[dataInicioObj.getMonth()]} de ${dataInicioObj.getFullYear()}`;
            }
        }
        else {
            const hoje = new Date();
            periodoSelecionadoStr = `Mês Atual (${meses[hoje.getMonth()]} de ${hoje.getFullYear()})`;
        }
        if (DOM.trainingPlansContainer)
            DOM.trainingPlansContainer.innerHTML = '';
        const params = new URLSearchParams();
        params.append('filtroNomeEvento', nomeFiltroVal);
        if (dataInicioStr)
            params.append('dataInicioStr', dataInicioStr);
        if (dataFimStr)
            params.append('dataFimStr', dataFimStr);
        if (personalTrainerVal)
            params.append('personalTrainer', personalTrainerVal);
        if (corVal)
            params.append('corEventoFiltro', corVal);
        const responseData = await fetchApi(`/api/metricas?${params.toString()}`, {}, 'executarCalculoMetricas');
        if (responseData && responseData.erro === null) {
            if (DOM.numeroTreinosInput)
                DOM.numeroTreinosInput.value = String(responseData.totalEventos || 0);
            if (DOM.treinosConcluidosInput)
                DOM.treinosConcluidosInput.value = String(responseData.eventosConcluidos || 0);
            if (DOM.filtroNivelInput)
                DOM.filtroNivelInput.value = String(responseData.nivel?.toFixed(2) || '--');
            if (DOM.filtroHorasInput)
                DOM.filtroHorasInput.value = String(responseData.totalHoras?.toFixed(2) || '--');
            if (DOM.trainingPlansContainer) {
                let detailsHtml = `<div class="p-3"><h4>Resumo Métricas (${periodoSelecionadoStr})</h4>`;
                if (responseData.detalhesNivel && responseData.detalhesNivel.length > 0) {
                    detailsHtml += '<h5 class="mt-3">Detalhes do Nível:</h5><ul class="list-group">';
                    responseData.detalhesNivel.forEach((item) => {
                        detailsHtml += `<li class="list-group-item d-flex justify-content-between align-items-center small">
                            <span>${item.titulo} (${item.tipoPagamento || item.regra}, ${item.mesAlocado})</span>
                            <span class="badge badge-primary badge-pill">${item.valor?.toFixed(2)}</span>
                        </li>`;
                    });
                    detailsHtml += '</ul>';
                }
                if (responseData.dadosClientePorRef && Object.keys(responseData.dadosClientePorRef).length > 0) {
                    detailsHtml += '<h5 class="mt-3">Contagem Cliente por M.Ref:</h5><ul class="list-group">';
                    Object.values(responseData.dadosClientePorRef).forEach((item) => {
                        detailsHtml += `<li class="list-group-item d-flex justify-content-between align-items-center small">
                            <span>${item.nomeCliente} (M.Ref: ${item.mRef})</span>
                            <span class="badge badge-info badge-pill">${item.count}</span>
                        </li>`;
                    });
                    detailsHtml += '</ul>';
                }
                if (!(responseData.detalhesNivel && responseData.detalhesNivel.length > 0) && !(responseData.dadosClientePorRef && Object.keys(responseData.dadosClientePorRef).length > 0)) {
                    detailsHtml += '<p class="text-muted">Nenhum detalhe adicional de métricas para exibir.</p>';
                }
                detailsHtml += '</div>';
                DOM.trainingPlansContainer.innerHTML = detailsHtml;
            }
        }
        else {
            resetHeaderStats();
        }
    }
    catch (error) {
        handleBackendError(error, 'executarCalculoMetricas');
    }
    finally {
        state.isFiltering = false;
        enableActionButtons();
    }
}
export function displayClienteSuggestions(suggestions, inputText) {
    if (!DOM.clienteSuggestionsDropdown)
        return;
    DOM.clienteSuggestionsDropdown.innerHTML = '';
    if (suggestions && suggestions.length > 0) {
        suggestions.forEach(suggestion => {
            const item = document.createElement('a');
            item.classList.add('dropdown-item');
            item.href = '#';
            const regex = new RegExp(`(${inputText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
            item.innerHTML = suggestion.replace(regex, '<strong>$1</strong>');
            item.addEventListener('click', (e) => {
                e.preventDefault();
                if (DOM.nomeFiltroInput)
                    DOM.nomeFiltroInput.value = suggestion;
                hideClienteSuggestions();
            });
            DOM.clienteSuggestionsDropdown.appendChild(item);
        });
        DOM.clienteSuggestionsDropdown.style.display = 'block';
    }
    else {
        hideClienteSuggestions();
    }
}
export function hideClienteSuggestions() {
    if (DOM.clienteSuggestionsDropdown)
        DOM.clienteSuggestionsDropdown.style.display = 'none';
}
