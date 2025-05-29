
// modules/domElements.ts
export const loadingIndicator = document.getElementById('loading-indicator') as HTMLElement;
export const filterContainer = document.getElementById('filter-container') as HTMLElement;
export const toggleFilterButton = document.getElementById('toggleFilter') as HTMLButtonElement;
export const trainingPlansContainer = document.getElementById('training-plans') as HTMLElement;
export const nomeFiltroInput = document.getElementById('nomeFiltro') as HTMLInputElement;
export const clienteSuggestionsDropdown = document.getElementById('clienteSuggestionsDropdown') as HTMLElement;
export const dateRangeFilterInput = document.getElementById('dateRangeFilter') as HTMLInputElement;
export const corSelect = document.getElementById('cor') as HTMLSelectElement;
export const personalTrainerSelect = document.getElementById('personalTrainer') as HTMLSelectElement;
// Ensure the ID 'buscarPlanosBtn' matches the button in your HTML for filtering plans.
export const buscarPlanosBtn = document.getElementById('buscarPlanosBtn') as HTMLButtonElement; 
export const calcularMetricasBtn = document.getElementById('calcularMetricasBtn') as HTMLButtonElement;
export const estatisticasBtn = document.getElementById('estatisticasBtn') as HTMLButtonElement;

export const alertOverlay = document.getElementById('custom-alert-overlay') as HTMLElement;
export const alertDiv = document.getElementById('custom-alert') as HTMLElement;
export const alertMessage = document.getElementById('custom-alert-message') as HTMLElement;

// Exercise Modal
export const exerciseModal = document.getElementById('exercise-modal') as HTMLElement;
export const modalSearchInput = document.getElementById('modal-search-input') as HTMLInputElement;
export const modalListContainer = document.getElementById('modal-exercise-list') as HTMLElement;
export const exerciseModalCloseButton = exerciseModal?.querySelector('.modal-close-btn') as HTMLButtonElement;


// Avaliação Modal
export const avaliacaoModal = document.getElementById('avaliacao-modal') as HTMLElement;
export const avaliacaoModalOverlay = document.getElementById('avaliacao-modal-overlay') as HTMLElement;
export const avaliacaoForm = document.getElementById('avaliacao-form') as HTMLFormElement;
export const avaliacaoPlanUuidInput = document.getElementById('avaliacao-planUuid') as HTMLInputElement;
export const avaliacaoContadorPlanoInput = document.getElementById('avaliacao-contadorPlano') as HTMLInputElement;
export const avalPesoInput = document.getElementById('aval-peso') as HTMLInputElement;
export const avalAlturaInput = document.getElementById('aval-altura') as HTMLInputElement;
export const avalMassaMuscularInput = document.getElementById('aval-massa-muscular') as HTMLInputElement;
export const avalMassaGordaInput = document.getElementById('aval-massa-gorda') as HTMLInputElement;
export const avalGorduraVisceralInput = document.getElementById('aval-gordura-visceral') as HTMLInputElement;
export const avalIdadeBiologicaInput = document.getElementById('aval-idade-biologica') as HTMLInputElement;
export const avalMetabolismoBasalInput = document.getElementById('aval-metabolismo-basal') as HTMLInputElement;
export const avalMassaOsseaInput = document.getElementById('aval-massa-ossea') as HTMLInputElement;
export const avalH2OInput = document.getElementById('aval-h2o') as HTMLInputElement;
export const avalPressaoArterialInput = document.getElementById('aval-pressao-arterial') as HTMLInputElement;
export const avalPerimetroAbdominalInput = document.getElementById('aval-perimetro-abdominal') as HTMLInputElement;
export const avalObservacoesInput = document.getElementById('aval-observacoes') as HTMLTextAreaElement;


// Estatísticas Modal
export const estatisticasModal = document.getElementById('estatisticas-modal') as HTMLElement;
export const estatisticasModalOverlay = document.getElementById('estatisticas-modal-overlay') as HTMLElement;
export const estatisticasBodyContent = document.getElementById('estatisticas-body-content') as HTMLElement;
export const estatisticasTitulo = document.getElementById('estatisticas-titulo') as HTMLElement;
export const estatisticasClientePeriodo = document.getElementById('estatisticas-cliente-periodo') as HTMLElement;
export const estatisticasSemDados = document.getElementById('estatisticas-sem-dados') as HTMLElement;
export const estatisticasGraficosContainer = document.getElementById('estatisticas-graficos-container') as HTMLElement;
export const selectEvalMetric = document.getElementById('select-eval-metric') as HTMLSelectElement;
export const evalMainChartContainer = document.getElementById('eval-main-chart-container') as HTMLElement;
export const evalAllChartsContainer = document.getElementById('eval-all-charts-container') as HTMLElement;
export const estatisticasWorkoutAnalysisContainer = document.getElementById('estatisticas-workout-analysis-container') as HTMLElement;
export const exerciseMainProgressChartContainer = document.getElementById('exercise-main-progress-chart-container') as HTMLElement;
export const selectMuscleGroupProgress = document.getElementById('select-muscle-group-progress') as HTMLSelectElement;
export const exerciseLoadChartsByGroup = document.getElementById('exercise-load-charts-by-group') as HTMLElement;
export const estatisticasPlanosDetalhes = document.getElementById('estatisticas-planos-detalhes') as HTMLElement;
export const exportOptionsContainer = document.getElementById('export-options-container') as HTMLElement;
export const toggleXAxisLabelsCheckbox = document.getElementById('toggleXAxisLabels') as HTMLInputElement;


// General App Elements
export const appIcon = document.getElementById('appIcon') as HTMLImageElement;
export const numeroTreinosInput = document.getElementById('numeroTreinos') as HTMLInputElement;
export const treinosConcluidosInput = document.getElementById('treinosConcluidos') as HTMLInputElement;
export const filtroNivelInput = document.getElementById('filtroNivel') as HTMLInputElement;
export const filtroHorasInput = document.getElementById('filtroHoras') as HTMLInputElement;
