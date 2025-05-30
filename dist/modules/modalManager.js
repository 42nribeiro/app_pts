import * as DOM from './domElements';
import { state } from './config';
import { showCustomAlert, handleBackendError as globalHandleBackendError, enableActionButtons, disableActionButtons } from './uiUtils';
import { fetchApi } from './api';
import { adicionarExercicioComDados as planManagerAdicionarExercicioComDados, salvarPlano as planManagerSalvarPlano } from './planManager';
export const adicionarExercicioComDados = planManagerAdicionarExercicioComDados;
export const salvarPlano = planManagerSalvarPlano;
export function handleExerciseFocus(buttonElement) {
    const inputElement = buttonElement.previousElementSibling;
    if (!inputElement || inputElement.closest('.plan-readonly') || inputElement.closest('.item-readonly'))
        return;
    showExerciseModal(inputElement);
}
export function showExerciseModal(targetInputElement) {
    if (typeof state.MASTER_EXERCISE_DATA === 'undefined') {
        showCustomAlert("Lista de exercícios mestre não carregada.", true);
        return;
    }
    state.currentExerciseInputTarget = targetInputElement;
    state.fullModalExerciseList = [];
    const exerciseContainer = targetInputElement.closest('.exercise-container');
    const grupoMuscularSelect = exerciseContainer?.querySelector('.grupoMuscular');
    const selectedMuscleGroup = grupoMuscularSelect?.value;
    if (!selectedMuscleGroup) {
        showCustomAlert("Por favor, selecione um Grupo Muscular primeiro.", false, 2500);
        state.currentExerciseInputTarget = null;
        return;
    }
    state.fullModalExerciseList = state.MASTER_EXERCISE_DATA[selectedMuscleGroup] || [];
    targetInputElement.dataset.exerciseList = JSON.stringify(state.fullModalExerciseList);
    if (DOM.modalSearchInput)
        DOM.modalSearchInput.value = '';
    populateModalList(state.fullModalExerciseList, '');
    if (DOM.modalSearchInput) {
        DOM.modalSearchInput.oninput = () => {
            if (!DOM.modalSearchInput)
                return;
            const searchTerm = DOM.modalSearchInput.value.toLowerCase();
            const filteredList = state.fullModalExerciseList.filter(ex => ex.toLowerCase().includes(searchTerm));
            populateModalList(filteredList, DOM.modalSearchInput.value);
        };
    }
    if (DOM.alertOverlay) {
        DOM.alertOverlay.style.display = 'block';
        DOM.alertOverlay.classList.add('show');
    }
    if (DOM.exerciseModal) {
        DOM.exerciseModal.style.display = 'flex';
        setTimeout(() => DOM.modalSearchInput?.focus(), 50);
    }
}
export function hideExerciseModal() {
    if (DOM.alertOverlay) {
        DOM.alertOverlay.classList.remove('show');
        if (!DOM.alertDiv?.classList.contains('show')) {
            setTimeout(() => { if (DOM.alertOverlay)
                DOM.alertOverlay.style.display = 'none'; }, 250);
        }
    }
    if (DOM.exerciseModal)
        DOM.exerciseModal.style.display = 'none';
    if (DOM.modalListContainer)
        DOM.modalListContainer.innerHTML = '';
    state.currentExerciseInputTarget = null;
    state.fullModalExerciseList = [];
    if (DOM.modalSearchInput)
        DOM.modalSearchInput.oninput = null;
}
export function populateModalList(list, searchTerm = '') {
    if (!DOM.modalListContainer)
        return;
    DOM.modalListContainer.innerHTML = '';
    const searchTermLower = searchTerm.toLowerCase();
    const trimmedSearchTerm = searchTerm.trim();
    if (list.length === 0 && trimmedSearchTerm.length > 0) {
        const addItemDiv = document.createElement('div');
        addItemDiv.className = 'add-new-suggestion';
        addItemDiv.innerHTML = `<i class="fas fa-plus-circle"></i> Adicionar '<strong>${trimmedSearchTerm}</strong>' como novo exercício`;
        addItemDiv.onclick = () => { addNewExerciseToList(trimmedSearchTerm); };
        DOM.modalListContainer.appendChild(addItemDiv);
    }
    else if (list.length === 0) {
        DOM.modalListContainer.innerHTML = '<div style="padding:10px;text-align:center;color:#6c757d;">Nenhum exercício encontrado.</div>';
    }
    list.forEach(exercise => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'suggestion-item';
        if (searchTermLower.length > 0) {
            const matchIndex = exercise.toLowerCase().indexOf(searchTermLower);
            if (matchIndex > -1) {
                itemDiv.innerHTML = exercise.substring(0, matchIndex) +
                    '<strong>' + exercise.substring(matchIndex, matchIndex + searchTermLower.length) + '</strong>' +
                    exercise.substring(matchIndex + searchTermLower.length);
            }
            else {
                itemDiv.textContent = exercise;
            }
        }
        else {
            itemDiv.textContent = exercise;
        }
        itemDiv.onclick = () => { selectExerciseFromModal(exercise); };
        DOM.modalListContainer.appendChild(itemDiv);
    });
}
export function selectExerciseFromModal(selectedExerciseText) {
    if (state.currentExerciseInputTarget) {
        state.currentExerciseInputTarget.value = selectedExerciseText.trim();
    }
    hideExerciseModal();
}
export async function addNewExerciseToList(newExerciseName) {
    if (!state.currentExerciseInputTarget)
        return;
    const trimmedName = newExerciseName.trim();
    if (!trimmedName) {
        showCustomAlert("Nome do exercício não pode ser vazio.", true);
        return;
    }
    const exerciseContainer = state.currentExerciseInputTarget.closest('.exercise-container');
    const grupoMuscularSelect = exerciseContainer?.querySelector('.grupoMuscular');
    const selectedMuscleGroup = grupoMuscularSelect?.value;
    if (!selectedMuscleGroup) {
        showCustomAlert("Grupo Muscular não selecionado.", true);
        return;
    }
    if (typeof state.MASTER_EXERCISE_DATA === 'undefined') {
        showCustomAlert("Lista de exercícios mestre não carregada.", true);
        return;
    }
    const lowerTrimmedName = trimmedName.toLowerCase();
    if (state.MASTER_EXERCISE_DATA[selectedMuscleGroup]?.some(ex => ex.toLowerCase() === lowerTrimmedName)) {
        showCustomAlert(`Exercício '${trimmedName}' já existe em ${selectedMuscleGroup}. Selecionando existente.`, false, 2000);
        selectExerciseFromModal(trimmedName);
        return;
    }
    if (!state.MASTER_EXERCISE_DATA[selectedMuscleGroup])
        state.MASTER_EXERCISE_DATA[selectedMuscleGroup] = [];
    state.MASTER_EXERCISE_DATA[selectedMuscleGroup].push(trimmedName);
    state.MASTER_EXERCISE_DATA[selectedMuscleGroup].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    state.fullModalExerciseList = state.MASTER_EXERCISE_DATA[selectedMuscleGroup];
    if (DOM.modalSearchInput) {
        const currentSearchTerm = DOM.modalSearchInput.value.toLowerCase();
        const filteredList = state.fullModalExerciseList.filter(ex => ex.toLowerCase().includes(currentSearchTerm));
        populateModalList(filteredList, DOM.modalSearchInput.value);
    }
    if (state.currentExerciseInputTarget)
        state.currentExerciseInputTarget.dataset.exerciseList = JSON.stringify(state.MASTER_EXERCISE_DATA[selectedMuscleGroup]);
    selectExerciseFromModal(trimmedName);
    showCustomAlert(`Exercício '${trimmedName}' adicionado a ${selectedMuscleGroup}! Salvando no servidor...`, false, 2000);
    try {
        const response = await fetchApi('/api/master-exercises', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ exerciseName: trimmedName, muscleGroup: selectedMuscleGroup })
        }, 'addNewExerciseToList');
        if (response && response.success) {
            console.log(`[addNewExerciseToList] Saved '${trimmedName}' for ${selectedMuscleGroup} on server.`);
        }
        else {
            throw new Error(response?.error || "Falha ao salvar novo exercício no servidor.");
        }
    }
    catch (error) {
        globalHandleBackendError(error, '/api/master-exercises POST (addNewExerciseToList)');
        showCustomAlert(`Falha ao salvar '${trimmedName}' no servidor. Atualize a página para obter a lista mais recente.`, true, 4000);
    }
}
export function abrirModalAvaliacao(idHTML) {
    const plano = state.planos.find(pl => pl.contadorPlano === idHTML);
    if (!plano) {
        showCustomAlert("Plano não encontrado para registrar avaliação.", true);
        return;
    }
    if (DOM.avaliacaoForm)
        DOM.avaliacaoForm.reset();
    if (DOM.avaliacaoPlanUuidInput)
        DOM.avaliacaoPlanUuidInput.value = plano.planUuid;
    if (DOM.avaliacaoContadorPlanoInput)
        DOM.avaliacaoContadorPlanoInput.value = String(idHTML);
    if (plano.avaliacao) {
        const aval = plano.avaliacao;
        if (DOM.avalPesoInput)
            DOM.avalPesoInput.value = String(aval.peso ?? '');
        if (DOM.avalAlturaInput)
            DOM.avalAlturaInput.value = String(aval.altura ?? '');
        if (DOM.avalMassaMuscularInput)
            DOM.avalMassaMuscularInput.value = String(aval.massaMuscular ?? '');
        if (DOM.avalMassaGordaInput)
            DOM.avalMassaGordaInput.value = String(aval.massaGorda ?? '');
        if (DOM.avalGorduraVisceralInput)
            DOM.avalGorduraVisceralInput.value = String(aval.gorduraVisceral ?? '');
        if (DOM.avalIdadeBiologicaInput)
            DOM.avalIdadeBiologicaInput.value = String(aval.idadeBiologica ?? '');
        if (DOM.avalMetabolismoBasalInput)
            DOM.avalMetabolismoBasalInput.value = String(aval.metabolismoBasal ?? '');
        if (DOM.avalMassaOsseaInput)
            DOM.avalMassaOsseaInput.value = String(aval.massaOssea ?? '');
        if (DOM.avalH2OInput)
            DOM.avalH2OInput.value = String(aval.h2o ?? '');
        if (DOM.avalPressaoArterialInput)
            DOM.avalPressaoArterialInput.value = aval.pressaoArterial || '';
        if (DOM.avalPerimetroAbdominalInput)
            DOM.avalPerimetroAbdominalInput.value = String(aval.perimetroAbdominal ?? '');
        if (DOM.avalObservacoesInput)
            DOM.avalObservacoesInput.value = aval.observacoes || '';
    }
    if (DOM.avaliacaoModalOverlay)
        DOM.avaliacaoModalOverlay.style.display = 'block';
    if (DOM.avaliacaoModal)
        DOM.avaliacaoModal.style.display = 'flex';
    setTimeout(() => {
        if (DOM.avaliacaoModal)
            DOM.avaliacaoModal.classList.add('show');
        if (DOM.avaliacaoModalOverlay)
            DOM.avaliacaoModalOverlay.classList.add('show');
        DOM.avalPesoInput?.focus();
    }, 50);
}
export function fecharModalAvaliacao() {
    if (DOM.avaliacaoModal)
        DOM.avaliacaoModal.classList.remove('show');
    if (DOM.avaliacaoModalOverlay)
        DOM.avaliacaoModalOverlay.classList.remove('show');
    setTimeout(() => {
        if (DOM.avaliacaoModal)
            DOM.avaliacaoModal.style.display = 'none';
        if (DOM.avaliacaoModalOverlay)
            DOM.avaliacaoModalOverlay.style.display = 'none';
    }, 250);
}
export function salvarAvaliacao() {
    if (!DOM.avaliacaoContadorPlanoInput || !DOM.avaliacaoPlanUuidInput) {
        showCustomAlert("Erro: Elementos do formulário de avaliação não encontrados.", true);
        return;
    }
    const idHTML = parseInt(DOM.avaliacaoContadorPlanoInput.value, 10);
    const planUuidVal = DOM.avaliacaoPlanUuidInput.value;
    const plano = state.planos.find(pl => pl.contadorPlano === idHTML && pl.planUuid === planUuidVal);
    if (!plano) {
        showCustomAlert("Erro: Plano não encontrado para salvar avaliação.", true);
        return;
    }
    const getNumOrNull = (el, isFloat = false) => {
        const val = el?.value.trim();
        if (val === '' || val === undefined || val === null)
            return null;
        const num = isFloat ? parseFloat(val) : parseInt(val, 10);
        return isNaN(num) ? null : num;
    };
    const getStringOrNull = (el) => el?.value.trim() || null;
    plano.avaliacao = {
        peso: getNumOrNull(DOM.avalPesoInput, true),
        altura: getNumOrNull(DOM.avalAlturaInput),
        massaMuscular: getNumOrNull(DOM.avalMassaMuscularInput, true),
        massaGorda: getNumOrNull(DOM.avalMassaGordaInput, true),
        gorduraVisceral: getNumOrNull(DOM.avalGorduraVisceralInput),
        idadeBiologica: getNumOrNull(DOM.avalIdadeBiologicaInput),
        metabolismoBasal: getNumOrNull(DOM.avalMetabolismoBasalInput),
        massaOssea: getNumOrNull(DOM.avalMassaOsseaInput, true),
        h2o: getNumOrNull(DOM.avalH2OInput, true),
        pressaoArterial: getStringOrNull(DOM.avalPressaoArterialInput),
        perimetroAbdominal: getNumOrNull(DOM.avalPerimetroAbdominalInput, true),
        observacoes: getStringOrNull(DOM.avalObservacoesInput)
    };
    salvarPlano(idHTML);
    fecharModalAvaliacao();
    showCustomAlert("Dados de avaliação incluídos no plano. O plano foi salvo.", false, 4000);
}
export async function abrirModalEstatisticas() {
    const nomeFiltroVal = DOM.nomeFiltroInput.value.trim();
    if (!nomeFiltroVal) {
        showCustomAlert("Por favor, insira um nome de cliente no filtro para buscar estatísticas.", true);
        return;
    }
    disableActionButtons();
    try {
        let dataInicioStr = '', dataFimStr = '';
        const datePickerInstance = DOM.dateRangeFilterInput?._flatpickr;
        if (datePickerInstance && datePickerInstance.selectedDates.length > 0) {
            dataInicioStr = flatpickr.formatDate(datePickerInstance.selectedDates[0], "d/m/Y");
            dataFimStr = datePickerInstance.selectedDates.length > 1
                ? flatpickr.formatDate(datePickerInstance.selectedDates[1], "d/m/Y")
                : dataInicioStr;
        }
        const personalTrainerVal = DOM.personalTrainerSelect.value;
        const corVal = DOM.corSelect.value;
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
        const data = await fetchApi(`/api/stats/cliente?${params.toString()}`, {}, 'abrirModalEstatisticas');
        const chartManager = await import('./chartManager');
        chartManager.mostrarResultadosEstatisticas(data);
    }
    catch (error) {
        globalHandleBackendError(error, '/api/stats/cliente GET (abrirModalEstatisticas)');
        if (DOM.estatisticasModal)
            DOM.estatisticasModal.style.display = 'none';
        if (DOM.estatisticasModalOverlay)
            DOM.estatisticasModalOverlay.style.display = 'none';
    }
    finally {
        enableActionButtons();
    }
}
export function fecharModalEstatisticas() {
    if (DOM.estatisticasModal)
        DOM.estatisticasModal.classList.remove('show');
    if (DOM.estatisticasModalOverlay)
        DOM.estatisticasModalOverlay.classList.remove('show');
    setTimeout(() => {
        if (DOM.estatisticasModal)
            DOM.estatisticasModal.style.display = 'none';
        if (DOM.estatisticasModalOverlay)
            DOM.estatisticasModalOverlay.style.display = 'none';
    }, 250);
    Object.values(state.activeCharts).forEach(chart => {
        if (chart && typeof chart.destroy === 'function')
            chart.destroy();
    });
    for (const key in state.activeCharts) {
        delete state.activeCharts[key];
    }
}
