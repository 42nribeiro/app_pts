
// modules/config.ts
import { Plan, MasterExercises, Exercise, ClientStats, ChartInstance } from './interfaces';

export const API_BASE_URL = ''; // Backend on the same origin. Change to 'http://localhost:3000' if different for dev.

export const OBJETIVOS = ['STRENGTH', 'MOBILITY', 'BALANCE', 'ENDURANCE', 'COORDINATION', 'POWER', 'AGILITY', 'PROPRIOCEPTION', 'POSTURE'];

export const isIOS = typeof navigator !== 'undefined' ? /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream : false;

// Global state variables
interface GlobalState {
    planos: Plan[];
    MASTER_EXERCISE_DATA: MasterExercises;
    isFiltering: boolean; // Used to prevent concurrent major operations
    currentExerciseInputTarget: HTMLInputElement | null;
    fullModalExerciseList: string[];
    clipboardPlanoData: { exercises: Exercise[] } | null;
    activeCharts: { [key: string]: ChartInstance }; // Use ChartInstance from interfaces
    allFetchedEvalSeriesData: ClientStats['avaliacoesSeries'] | null;
    allFetchedExerciseProgressData: ClientStats['workoutAnalysis']['exerciseWeightProgress'] | null;
    contadorPlano: number; // Tracks the last assigned frontend ID for new plans
    exercicioCounter: number; // Tracks new exercise items for unique IDs if needed locally
}

export const state: GlobalState = {
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


// Global type declarations for libraries loaded via <script> tags
// These are often better in a dedicated `globals.d.ts` or at the top of `index.tsx` if not too extensive.
declare global {
  var flatpickr: any; // Consider using `@types/flatpickr` for better typing
  var Sortable: any;  // Consider using `@types/sortablejs`
  var Chart: any;     // Use the Chart interface from `interfaces.ts` if possible, or install `@types/chart.js`
  var html2canvas: any;
  var jspdf: any;
  var ChartDataLabels: any;

  interface Window {
    MSStream?: any; // For IE11
    app?: any; // For exposing functions globally for onclick handlers
  }
}

// This export makes sure the file is treated as a module by TypeScript.
export {};
