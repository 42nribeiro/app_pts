export const API_BASE_URL = '';
export const OBJETIVOS = ['STRENGTH', 'MOBILITY', 'BALANCE', 'ENDURANCE', 'COORDINATION', 'POWER', 'AGILITY', 'PROPRIOCEPTION', 'POSTURE'];
export const isIOS = typeof navigator !== 'undefined' ? /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream : false;
export const state = {
    planos: [],
    MASTER_EXERCISE_DATA: {},
    isFiltering: false,
    currentExerciseInputTarget: null,
    fullModalExerciseList: [],
    clipboardPlanoData: null,
    activeCharts: {},
    allFetchedEvalSeriesData: null,
    allFetchedExerciseProgressData: null,
    contadorPlano: 0,
    exercicioCounter: 0,
};
