// ============================================================================
// TITAN GYM & AI NUTRITION - Lógica Principal de la Aplicación
// ============================================================================

const STORAGE_KEY = 'TITAN_GYM_APP_DATA_V1';

// Estado Global
let appData = {
  settings: {
    kcalGoal: 2400,
    proteinGoal: 160,
    carbsGoal: 260,
    fatGoal: 70,
    waterGoalMl: 2500,
    geminiApiKey: '',
    tdeeProfile: { sex: 'M', age: 25, weight: 75, height: 175, activity: '1.55', goal: '300' }
  },
  exercises: [],
  routines: [],
  workouts: [],       // Historial de entrenamientos terminados
  activeWorkout: null, // Sesión en curso (se guarda en vivo para no perderse si se bloquea el cel)
  prs: {},            // { [exerciseId]: { maxWeight, max1RM, date, repsAtMax } }
  foods: [],          // Base de datos local + personalizados
  nutritionByDate: {}, // { 'YYYY-MM-DD': { waterGlasses: 0, items: [ { id, slot, name, grams, kcal, protein, carbs, fat, time } ] } }
  bodyLogs: []        // [ { id, date, weight, bodyFat, waist, chest, arms, legs, notes, photo } ]
};

// Variables de control en memoria
let currentTab = 'home';
let currentMuscleFilter = 'Todos';
let currentNutritionDate = getTodayISO();
let liveWorkoutInterval = null;
let restTimerInterval = null;
let restTimerRemaining = 0;
let html5QrScanner = null;
let currentPhotoBase64 = null;
let aiDetectedItems = [];
let aiPortionScale = 1.0;
let deferredPwaPrompt = null;

// ============================================================================
// UTILIDADES DE FECHA, SONIDO Y NOTIFICACIONES
// ============================================================================

function getTodayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatReadableDate(isoStr) {
  if (!isoStr) return '';
  const [y, m, d] = isoStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatSeconds(sec) {
  const s = Math.max(0, Math.floor(sec));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

function showToast(msg, color = '#10b981') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.style.borderLeftColor = color;
  el.innerHTML = msg;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.25s';
    setTimeout(() => el.remove(), 260);
  }, 3200);
}

// Sonido sintetizado Web Audio API (no requiere archivos externos y funciona sin internet)
function playSound(type = 'beep') {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'timer_end') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.16);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
      osc.start();
      osc.stop(ctx.currentTime + 0.55);
    } else if (type === 'pr') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.12);
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.24);
      osc.frequency.setValueAtTime(1046.5, ctx.currentTime + 0.36);
      gain.gain.setValueAtTime(0.28, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
      osc.start();
      osc.stop(ctx.currentTime + 0.7);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    }
    if (navigator.vibrate) {
      navigator.vibrate(type === 'pr' ? [120, 60, 180] : [180, 80, 180]);
    }
  } catch (e) {
    // Ignorar si el navegador bloquea audio antes de interacción
  }
}

// ============================================================================
// CARGA Y GUARDADO DE DATOS EN DISPOSITIVO
// ============================================================================

function loadAppData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      appData = {
        ...appData,
        ...parsed,
        settings: { ...appData.settings, ...(parsed.settings || {}) }
      };
    }
  } catch (e) {
    console.error('Error cargando datos locales:', e);
  }

  // Asegurar base de datos inicial si está vacía
  if (!appData.exercises || appData.exercises.length === 0) {
    appData.exercises = JSON.parse(JSON.stringify(DEFAULT_EXERCISES));
  }
  if (!appData.routines || appData.routines.length === 0) {
    appData.routines = JSON.parse(JSON.stringify(DEFAULT_ROUTINES));
  }
  if (!appData.foods || appData.foods.length === 0) {
    appData.foods = JSON.parse(JSON.stringify(DEFAULT_FOODS));
  }
  saveAppData();
}

function saveAppData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
  } catch (e) {
    showToast('⚠️ Memoria local casi llena. Exporta un backup en Ajustes.', '#f59e0b');
  }
}

// ============================================================================
// INICIALIZACIÓN Y NAVEGACIÓN
// ============================================================================

window.addEventListener('DOMContentLoaded', () => {
  loadAppData();

  // Fecha en el header
  const headerDate = document.getElementById('header-date-label');
  if (headerDate) {
    headerDate.textContent = new Date().toLocaleDateString('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long'
    });
  }

  // Selector de fecha en Nutrición
  const nutPicker = document.getElementById('nutrition-date-picker');
  if (nutPicker) nutPicker.value = currentNutritionDate;

  // Inicializar vistas
  initSettingsInputs();
  renderAllViews();

  // Si había un entrenamiento activo, reanudar el reloj
  if (appData.activeWorkout) {
    startLiveWorkoutClock();
  }

  // Registrar Service Worker para PWA offline
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});

// Capturar evento de instalación en celular (PWA)
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPwaPrompt = e;
  const btn = document.getElementById('btn-install-pwa');
  if (btn) btn.style.display = 'inline-flex';
});

async function installPWA() {
  if (!deferredPwaPrompt) {
    showToast('📱 En iPhone/Android: abre el menú del navegador y toca "Agregar a pantalla de inicio".');
    return;
  }
  deferredPwaPrompt.prompt();
  const { outcome } = await deferredPwaPrompt.userChoice;
  if (outcome === 'accepted') {
    document.getElementById('btn-install-pwa').style.display = 'none';
    showToast('🎉 ¡App instalada en tu pantalla de inicio!');
  }
  deferredPwaPrompt = null;
}

function switchTab(tabName) {
  currentTab = tabName;
  document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const targetView = document.getElementById(`view-${tabName}`);
  const targetNav = document.getElementById(`nav-${tabName}`);
  if (targetView) targetView.classList.add('active');
  if (targetNav) targetNav.classList.add('active');

  if (tabName !== 'nutrition') {
    stopBarcodeScanner();
  }

  renderAllViews();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderAllViews() {
  renderHomeDashboard();
  renderWorkoutView();
  renderNutritionView();
  renderProgressView();
  updateAIKeyStatusBadge();
}

// ============================================================================
// 1. DASHBOARD / INICIO
// ============================================================================

function getDayNutrition(dateStr) {
  if (!appData.nutritionByDate[dateStr]) {
    appData.nutritionByDate[dateStr] = { waterGlasses: 0, items: [] };
  }
  return appData.nutritionByDate[dateStr];
}

function calculateDayTotals(dateStr) {
  const day = getDayNutrition(dateStr);
  return day.items.reduce(
    (acc, item) => {
      acc.kcal += Number(item.kcal) || 0;
      acc.protein += Number(item.protein) || 0;
      acc.carbs += Number(item.carbs) || 0;
      acc.fat += Number(item.fat) || 0;
      return acc;
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

function renderHomeDashboard() {
  const today = getTodayISO();
  const totals = calculateDayTotals(today);
  const g = appData.settings;

  // Banner de entreno en curso
  const banner = document.getElementById('home-live-workout-banner');
  if (appData.activeWorkout) {
    banner.style.display = 'flex';
    document.getElementById('home-live-workout-name').textContent = appData.activeWorkout.name;
  } else {
    banner.style.display = 'none';
  }

  // Anillo de calorías
  document.getElementById('home-kcal-consumed').textContent = Math.round(totals.kcal);
  document.getElementById('home-kcal-goal').textContent = g.kcalGoal;
  const pctKcal = Math.min(1, totals.kcal / Math.max(1, g.kcalGoal));
  const circumference = 289;
  const offset = circumference - pctKcal * circumference;
  const ring = document.getElementById('home-kcal-ring');
  if (ring) {
    ring.style.strokeDashoffset = offset;
    ring.style.stroke = totals.kcal > g.kcalGoal * 1.08 ? '#f59e0b' : '#10b981';
  }

  // Barras de macros
  document.getElementById('home-macro-p-txt').textContent = `${Math.round(totals.protein)} / ${g.proteinGoal}g`;
  document.getElementById('home-macro-c-txt').textContent = `${Math.round(totals.carbs)} / ${g.carbsGoal}g`;
  document.getElementById('home-macro-f-txt').textContent = `${Math.round(totals.fat)} / ${g.fatGoal}g`;

  document.getElementById('home-macro-p-bar').style.width = `${Math.min(100, (totals.protein / Math.max(1, g.proteinGoal)) * 100)}%`;
  document.getElementById('home-macro-c-bar').style.width = `${Math.min(100, (totals.carbs / Math.max(1, g.carbsGoal)) * 100)}%`;
  document.getElementById('home-macro-f-bar').style.width = `${Math.min(100, (totals.fat / Math.max(1, g.fatGoal)) * 100)}%`;

  // Estadísticas rápidas
  document.getElementById('home-stat-workouts').textContent = appData.workouts.length;
  const oneWeekAgo = Date.now() - 7 * 86400000;
  const weekCount = appData.workouts.filter(w => w.timestamp >= oneWeekAgo).length;
  document.getElementById('home-stat-week').textContent = `Últimos 7 días: ${weekCount}`;

  const latestBody = appData.bodyLogs.length > 0 ? appData.bodyLogs[0] : null;
  document.getElementById('home-stat-weight').textContent = latestBody ? `${latestBody.weight} kg` : '-- kg';
  document.getElementById('home-stat-prs').textContent = `🏆 ${Object.keys(appData.prs).length} ejercicios con PR`;

  // Vasos de agua (10 vasos de 250ml = 2500ml)
  const dayData = getDayNutrition(today);
  const totalGlasses = Math.max(8, Math.round((g.waterGoalMl || 2500) / 250));
  const waterMl = (dayData.waterGlasses || 0) * 250;
  document.getElementById('home-water-label').textContent = `${waterMl} / ${g.waterGoalMl || 2500} ml`;

  const cupsContainer = document.getElementById('home-water-cups');
  cupsContainer.innerHTML = '';
  for (let i = 1; i <= totalGlasses; i++) {
    const cup = document.createElement('div');
    cup.className = `water-cup ${i <= (dayData.waterGlasses || 0) ? 'filled' : ''}`;
    cup.innerHTML = '💧';
    cup.onclick = () => {
      dayData.waterGlasses = dayData.waterGlasses === i ? i - 1 : i;
      saveAppData();
      renderHomeDashboard();
    };
    cupsContainer.appendChild(cup);
  }

  // Rutinas rápidas en Inicio
  const homeRoutinesEl = document.getElementById('home-routines-list');
  homeRoutinesEl.innerHTML = appData.routines.slice(0, 3).map(rt => `
    <div class="card" style="padding:13px; margin-bottom:10px; border-left: 4px solid ${rt.color || '#10b981'};">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-weight:800; font-size:14.5px;">${escapeHtml(rt.name)}</div>
          <div style="font-size:11.5px; color:var(--text-muted);">${rt.exercises.length} ejercicios • ${escapeHtml(rt.tag || 'Personalizada')}</div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="startLiveWorkout('${rt.id}')">▶️ Entrenar</button>
      </div>
    </div>
  `).join('');

  // Récords personales recientes
  const prsEl = document.getElementById('home-prs-list');
  const prEntries = Object.entries(appData.prs);
  if (prEntries.length === 0) {
    prsEl.innerHTML = `<div style="font-size:12.5px; color:var(--text-muted); text-align:center; padding:10px;">Completa tu primer entrenamiento para registrar tus Récords Personales (PRs) automáticamente.</div>`;
  } else {
    prsEl.innerHTML = prEntries.slice(0, 6).map(([exId, pr]) => {
      const ex = getExerciseById(exId);
      return `
        <div class="meal-item">
          <div>
            <div class="meal-item-title">${escapeHtml(ex ? ex.name : exId)}</div>
            <div class="meal-item-sub">1RM Est: <strong>${Math.round(pr.max1RM)} kg</strong> • Fecha: ${formatReadableDate(pr.date)}</div>
          </div>
          <span class="badge badge-gold">🏆 ${pr.maxWeight}kg × ${pr.repsAtMax}</span>
        </div>
      `;
    }).join('');
  }
}

// ============================================================================
// 2. ENTRENAMIENTO, RUTINAS, EJERCICIOS Y TEMPORIZADOR
// ============================================================================

function getExerciseById(exId) {
  return appData.exercises.find(e => e.id === exId);
}

// Busca la última vez que se realizó un ejercicio para mostrar "Anterior: 80kg x 10"
function getPreviousSetsForExercise(exerciseId) {
  for (const w of appData.workouts) {
    const found = w.exercises.find(e => e.exerciseId === exerciseId);
    if (found && found.sets && found.sets.length > 0) {
      return found.sets;
    }
  }
  return [];
}

function switchWorkoutSubtab(sub) {
  ['routines', 'exercises', 'history'].forEach(k => {
    document.getElementById(`workout-sub-${k}`).style.display = k === sub ? 'block' : 'none';
    document.getElementById(`wtab-${k}`).classList.toggle('active', k === sub);
  });
}

function renderWorkoutView() {
  const liveContainer = document.getElementById('live-workout-container');
  const hubContainer = document.getElementById('workout-hub-container');

  if (appData.activeWorkout) {
    liveContainer.style.display = 'block';
    hubContainer.style.display = 'none';
    renderLiveWorkoutSession();
  } else {
    liveContainer.style.display = 'none';
    hubContainer.style.display = 'block';
    renderRoutinesList();
    renderExerciseLibrary();
    renderWorkoutHistory();
  }
}

function renderRoutinesList() {
  const container = document.getElementById('routines-full-list');
  if (!container) return;

  container.innerHTML = appData.routines.map(rt => {
    const exNames = rt.exercises
      .map(item => getExerciseById(item.exerciseId)?.name || 'Ejercicio')
      .slice(0, 4)
      .join(', ');
    return `
      <div class="card" style="border-left: 4px solid ${rt.color || '#10b981'};">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
          <div>
            <span class="badge" style="margin-bottom:4px;">${escapeHtml(rt.tag || 'Rutina')}</span>
            <div style="font-size:16px; font-weight:800;">${escapeHtml(rt.name)}</div>
          </div>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-ghost btn-sm" onclick="openRoutineModal('${rt.id}')">✏️</button>
            <button class="btn btn-ghost btn-sm" onclick="deleteRoutine('${rt.id}')">🗑️</button>
          </div>
        </div>
        <div style="font-size:12px; color:var(--text-muted); margin-bottom:12px;">
          <strong>${rt.exercises.length} ejercicios:</strong> ${escapeHtml(exNames)}${rt.exercises.length > 4 ? '...' : ''}
        </div>
        <button class="btn btn-primary btn-block" onclick="startLiveWorkout('${rt.id}')">
          ▶️ Iniciar Esta Rutina
        </button>
      </div>
    `;
  }).join('');
}

function renderExerciseLibrary() {
  const muscles = ['Todos', 'Pecho', 'Espalda', 'Piernas', 'Hombros', 'Bíceps', 'Tríceps', 'Core'];
  const pillsEl = document.getElementById('muscle-filter-pills');
  if (pillsEl) {
    pillsEl.innerHTML = muscles.map(m => `
      <button class="pill-btn ${currentMuscleFilter === m ? 'active' : ''}" onclick="setMuscleFilter('${m}')">${m}</button>
    `).join('');
  }

  const query = (document.getElementById('exercise-search-input')?.value || '').toLowerCase().trim();
  const listEl = document.getElementById('exercise-library-list');
  if (!listEl) return;

  const filtered = appData.exercises.filter(ex => {
    const matchMuscle = currentMuscleFilter === 'Todos' || ex.muscle === currentMuscleFilter;
    const matchText = !query || ex.name.toLowerCase().includes(query) || (ex.equipment || '').toLowerCase().includes(query);
    return matchMuscle && matchText;
  });

  listEl.innerHTML = filtered.map(ex => {
    const pr = appData.prs[ex.id];
    return `
      <div class="card" style="padding:12px; margin-bottom:10px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div>
            <div style="font-weight:800; font-size:14.5px;">${escapeHtml(ex.name)}</div>
            <div style="font-size:11.5px; color:var(--text-muted); margin-top:2px;">
              <span class="badge badge-accent">${escapeHtml(ex.muscle)}</span>
              <span class="badge">${escapeHtml(ex.equipment || 'Libre')}</span>
              ${pr ? `<span class="badge badge-gold">🏆 PR: ${pr.maxWeight}kg × ${pr.repsAtMax}</span>` : ''}
            </div>
            ${ex.notes ? `<div style="font-size:11.5px; color:var(--text-muted); margin-top:6px;">💡 ${escapeHtml(ex.notes)}</div>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function setMuscleFilter(m) {
  currentMuscleFilter = m;
  renderExerciseLibrary();
}

function renderWorkoutHistory() {
  const container = document.getElementById('workout-history-list');
  if (!container) return;

  if (appData.workouts.length === 0) {
    container.innerHTML = `
      <div class="card" style="text-align:center; padding:24px; color:var(--text-muted);">
        Aún no tienes entrenamientos guardados. ¡Inicia una rutina para registrar tus series!
      </div>
    `;
    return;
  }

  container.innerHTML = appData.workouts.map(w => {
    const exSummary = w.exercises.map(e => {
      const exObj = getExerciseById(e.exerciseId);
      const bestSet = e.sets.reduce((best, s) => (Number(s.weight) > Number(best.weight || 0) ? s : best), {});
      return `<div style="display:flex; justify-content:space-between; font-size:12.5px; padding:3px 0;">
        <span>${e.sets.length}× ${escapeHtml(exObj ? exObj.name : 'Ejercicio')}</span>
        <span style="color:var(--text-muted);">Mejor: ${bestSet.weight || 0}kg × ${bestSet.reps || 0}</span>
      </div>`;
    }).join('');

    return `
      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
          <div>
            <div style="font-size:15.5px; font-weight:800;">${escapeHtml(w.name)}</div>
            <div style="font-size:11.5px; color:var(--text-muted);">📅 ${formatReadableDate(w.date)} • ⏱️ ${formatSeconds(w.durationSec)}</div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="deleteWorkoutHistory('${w.id}')">🗑️</button>
        </div>
        <div style="display:flex; gap:8px; margin-bottom:10px;">
          <span class="badge badge-accent">📦 Vol: ${Math.round(w.totalVolume)} kg</span>
          <span class="badge badge-blue">✅ ${w.totalSets} series</span>
          ${w.prsCount > 0 ? `<span class="badge badge-gold">🏆 ${w.prsCount} PRs</span>` : ''}
        </div>
        <div style="border-top:1px solid var(--border); padding-top:8px;">
          ${exSummary}
        </div>
      </div>
    `;
  }).join('');
}

function deleteWorkoutHistory(wId) {
  if (!confirm('¿Eliminar este entrenamiento del historial?')) return;
  appData.workouts = appData.workouts.filter(w => w.id !== wId);
  saveAppData();
  renderAllViews();
  showToast('Entrenamiento eliminado.');
}

// ============================================================================
// ENTRENAMIENTO EN VIVO (LIVE WORKOUT ENGINE)
// ============================================================================

function startLiveWorkout(routineId) {
  if (appData.activeWorkout) {
    switchTab('workout');
    return;
  }

  let workoutName = 'Entrenamiento Libre';
  let workoutExercises = [];

  if (routineId) {
    const rt = appData.routines.find(r => r.id === routineId);
    if (rt) {
      workoutName = rt.name;
      workoutExercises = rt.exercises.map(item => {
        const prevSets = getPreviousSetsForExercise(item.exerciseId);
        const count = Number(item.targetSets) || 3;
        const sets = [];
        for (let i = 0; i < count; i++) {
          const prev = prevSets[i] || prevSets[prevSets.length - 1] || null;
          sets.push({
            type: '1',
            weight: prev ? prev.weight : '',
            reps: prev ? prev.reps : (parseInt(item.targetReps) || 10),
            prevText: prev ? `${prev.weight}kg × ${prev.reps}` : (item.targetReps || '8-12'),
            completed: false,
            isPR: false
          });
        }
        return {
          exerciseId: item.exerciseId,
          restSeconds: item.restSeconds || 90,
          sets
        };
      });
    }
  }

  appData.activeWorkout = {
    id: 'wk_' + Date.now(),
    name: workoutName,
    startTime: Date.now(),
    prsCount: 0,
    exercises: workoutExercises
  };

  saveAppData();
  startLiveWorkoutClock();
  switchTab('workout');
  showToast(`🏋️ ¡Iniciado: ${workoutName}!`);
}

function startLiveWorkoutClock() {
  if (liveWorkoutInterval) clearInterval(liveWorkoutInterval);
  liveWorkoutInterval = setInterval(() => {
    if (!appData.activeWorkout) {
      clearInterval(liveWorkoutInterval);
      return;
    }
    const elapsedSec = Math.floor((Date.now() - appData.activeWorkout.startTime) / 1000);
    const clockEl = document.getElementById('live-workout-clock');
    const homeClockEl = document.getElementById('home-live-workout-timer');
    if (clockEl) clockEl.textContent = formatSeconds(elapsedSec);
    if (homeClockEl) homeClockEl.textContent = `Tiempo activo: ${formatSeconds(elapsedSec)}`;
  }, 1000);
}

function renderLiveWorkoutSession() {
  const wk = appData.activeWorkout;
  if (!wk) return;

  const titleInput = document.getElementById('live-workout-title-input');
  if (titleInput && document.activeElement !== titleInput) {
    titleInput.value = wk.name;
    titleInput.onchange = (e) => {
      wk.name = e.target.value || 'Entrenamiento';
      saveAppData();
    };
  }

  // Calcular volumen y series completadas
  let totalVolume = 0;
  let completedSets = 0;
  wk.exercises.forEach(ex => {
    ex.sets.forEach(s => {
      if (s.completed) {
        completedSets++;
        totalVolume += (Number(s.weight) || 0) * (Number(s.reps) || 0);
      }
    });
  });

  document.getElementById('live-workout-volume').textContent = `${Math.round(totalVolume)} kg`;
  document.getElementById('live-workout-sets').textContent = completedSets;
  document.getElementById('live-workout-prs').textContent = `${wk.prsCount || 0} 🏆`;

  const listEl = document.getElementById('live-exercises-list');
  if (wk.exercises.length === 0) {
    listEl.innerHTML = `
      <div class="card" style="text-align:center; padding:22px; color:var(--text-muted);">
        Todavía no hay ejercicios en esta sesión. Toca <strong>"➕ Agregar Ejercicio"</strong> abajo para comenzar.
      </div>
    `;
    return;
  }

  listEl.innerHTML = wk.exercises.map((exItem, exIdx) => {
    const exInfo = getExerciseById(exItem.exerciseId) || { name: 'Ejercicio', muscle: 'General' };
    const pr = appData.prs[exItem.exerciseId];

    const rowsHtml = exItem.sets.map((s, setIdx) => {
      const est1RM = s.weight && s.reps ? Math.round(Number(s.weight) * (1 + Number(s.reps) / 30)) : 0;
      const typeLabel = s.type === '1' ? (setIdx + 1) : s.type;
      return `
        <tr class="set-row ${s.completed ? 'completed' : ''}">
          <td>
            <button class="set-type-btn type-${s.type}" onclick="cycleSetType(${exIdx}, ${setIdx})" title="Cambiar tipo: Normal, W (Calentamiento), D (Drop Set), F (Fallo)">
              ${typeLabel}
            </button>
          </td>
          <td>
            <div class="prev-set-text">${escapeHtml(s.prevText || '--')}</div>
            ${est1RM > 0 ? `<div style="font-size:9.5px; color:var(--text-dim);">1RM ~${est1RM}kg</div>` : ''}
          </td>
          <td>
            <input type="number" step="0.5" class="set-input" value="${s.weight}" placeholder="kg"
              oninput="updateLiveSetValue(${exIdx}, ${setIdx}, 'weight', this.value)" />
          </td>
          <td>
            <input type="number" class="set-input" value="${s.reps}" placeholder="reps"
              oninput="updateLiveSetValue(${exIdx}, ${setIdx}, 'reps', this.value)" />
          </td>
          <td>
            <button class="set-check-btn" onclick="toggleCompleteSet(${exIdx}, ${setIdx})">
              ${s.completed ? (s.isPR ? '🏆' : '✓') : '✓'}
            </button>
          </td>
          <td>
            <button class="btn btn-ghost btn-sm" style="padding:4px 6px;" onclick="removeSetFromLiveExercise(${exIdx}, ${setIdx})">✕</button>
          </td>
        </tr>
      `;
    }).join('');

    return `
      <div class="workout-exercise-card">
        <div class="exercise-head">
          <div>
            <div class="exercise-name">${escapeHtml(exInfo.name)}</div>
            <div style="font-size:11.5px; color:var(--text-muted); margin-top:2px;">
              <span class="badge badge-accent">${escapeHtml(exInfo.muscle)}</span>
              <span class="badge" style="cursor:pointer;" onclick="changeExerciseRestTime(${exIdx})">⏱️ Descanso: ${exItem.restSeconds || 90}s</span>
              ${pr ? `<span class="badge badge-gold">Mejor: ${pr.maxWeight}kg × ${pr.repsAtMax}</span>` : ''}
            </div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="removeExerciseFromLiveWorkout(${exIdx})">🗑️</button>
        </div>

        <table class="sets-table">
          <thead>
            <tr>
              <th>Serie</th>
              <th>Anterior / 1RM</th>
              <th>Peso (kg)</th>
              <th>Reps</th>
              <th>Listo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div style="display:flex; gap:8px; margin-top:8px;">
          <button class="btn btn-secondary btn-sm btn-block" onclick="addSetToLiveExercise(${exIdx})">
            ➕ Agregar Serie
          </button>
          <button class="btn btn-ghost btn-sm" onclick="openPlateCalcModal(${exItem.sets[exItem.sets.length - 1]?.weight || 60})" title="Calcular discos para este peso">
            💿 Discos
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function cycleSetType(exIdx, setIdx) {
  const order = ['1', 'W', 'D', 'F'];
  const set = appData.activeWorkout.exercises[exIdx].sets[setIdx];
  const next = order[(order.indexOf(set.type) + 1) % order.length];
  set.type = next;
  saveAppData();
  renderLiveWorkoutSession();
}

function updateLiveSetValue(exIdx, setIdx, field, val) {
  const set = appData.activeWorkout.exercises[exIdx].sets[setIdx];
  set[field] = val;
  saveAppData();
}

function toggleCompleteSet(exIdx, setIdx) {
  const wk = appData.activeWorkout;
  const exItem = wk.exercises[exIdx];
  const set = exItem.sets[setIdx];

  set.completed = !set.completed;

  if (set.completed) {
    const w = Number(set.weight) || 0;
    const r = Number(set.reps) || 0;
    const est1RM = w * (1 + r / 30);
    const currentPR = appData.prs[exItem.exerciseId];

    // Verificar si es Récord Personal (excluyendo series de calentamiento 'W')
    if (set.type !== 'W' && w > 0 && r > 0) {
      if (!currentPR || est1RM > currentPR.max1RM || w > currentPR.maxWeight) {
        set.isPR = true;
        wk.prsCount = (wk.prsCount || 0) + 1;
        appData.prs[exItem.exerciseId] = {
          maxWeight: Math.max(w, currentPR ? currentPR.maxWeight : 0),
          max1RM: Math.max(est1RM, currentPR ? currentPR.max1RM : 0),
          repsAtMax: r,
          date: getTodayISO()
        };
        const exName = getExerciseById(exItem.exerciseId)?.name || 'Ejercicio';
        playSound('pr');
        showToast(`🏆 ¡NUEVO PR en ${exName}! (${w}kg × ${r} reps)`, '#fbbf24');
      } else {
        playSound('beep');
      }
    } else {
      playSound('beep');
    }

    // Iniciar temporizador de descanso automático
    startRestTimer(exItem.restSeconds || 90);
  } else {
    if (set.isPR) {
      set.isPR = false;
      wk.prsCount = Math.max(0, (wk.prsCount || 1) - 1);
    }
  }

  saveAppData();
  renderLiveWorkoutSession();
}

function addSetToLiveExercise(exIdx) {
  const exItem = appData.activeWorkout.exercises[exIdx];
  const lastSet = exItem.sets[exItem.sets.length - 1] || { weight: '', reps: 10, prevText: '--' };
  exItem.sets.push({
    type: '1',
    weight: lastSet.weight,
    reps: lastSet.reps,
    prevText: lastSet.prevText,
    completed: false,
    isPR: false
  });
  saveAppData();
  renderLiveWorkoutSession();
}

function removeSetFromLiveExercise(exIdx, setIdx) {
  const exItem = appData.activeWorkout.exercises[exIdx];
  exItem.sets.splice(setIdx, 1);
  saveAppData();
  renderLiveWorkoutSession();
}

function removeExerciseFromLiveWorkout(exIdx) {
  appData.activeWorkout.exercises.splice(exIdx, 1);
  saveAppData();
  renderLiveWorkoutSession();
}

function changeExerciseRestTime(exIdx) {
  const exItem = appData.activeWorkout.exercises[exIdx];
  const val = prompt('Segundos de descanso automático entre series para este ejercicio:', exItem.restSeconds || 90);
  if (val !== null && !isNaN(Number(val))) {
    exItem.restSeconds = Math.max(15, Number(val));
    saveAppData();
    renderLiveWorkoutSession();
  }
}

function finishLiveWorkout() {
  const wk = appData.activeWorkout;
  if (!wk) return;

  // Filtrar series completadas (o si ninguna fue marcada pero puso datos, ofrecer marcarlas)
  let totalSets = 0;
  let totalVolume = 0;

  const cleanedExercises = wk.exercises.map(ex => {
    const validSets = ex.sets.filter(s => s.completed || (Number(s.weight) > 0 && Number(s.reps) > 0));
    validSets.forEach(s => {
      totalSets++;
      totalVolume += (Number(s.weight) || 0) * (Number(s.reps) || 0);
    });
    return {
      exerciseId: ex.exerciseId,
      sets: validSets.map(s => ({
        type: s.type,
        weight: Number(s.weight) || 0,
        reps: Number(s.reps) || 0,
        isPR: !!s.isPR
      }))
    };
  }).filter(e => e.sets.length > 0);

  if (cleanedExercises.length === 0) {
    if (!confirm('No has registrado ninguna serie con peso/repeticiones. ¿Deseas descartar este entrenamiento?')) {
      return;
    }
    appData.activeWorkout = null;
    stopRestTimer();
    saveAppData();
    renderAllViews();
    return;
  }

  const durationSec = Math.floor((Date.now() - wk.startTime) / 1000);
  appData.workouts.unshift({
    id: wk.id,
    name: wk.name,
    date: getTodayISO(),
    timestamp: Date.now(),
    durationSec,
    totalVolume,
    totalSets,
    prsCount: wk.prsCount || 0,
    exercises: cleanedExercises
  });

  appData.activeWorkout = null;
  stopRestTimer();
  saveAppData();
  playSound('pr');
  showToast(`🎉 ¡Entrenamiento guardado! Volumen: ${Math.round(totalVolume)} kg`);
  renderAllViews();
}

function cancelLiveWorkout() {
  if (!confirm('¿Seguro que deseas cancelar y descartar el entrenamiento en curso?')) return;
  appData.activeWorkout = null;
  stopRestTimer();
  saveAppData();
  renderAllViews();
  showToast('Entrenamiento descartado.', '#ef4444');
}

// ============================================================================
// TEMPORIZADOR DE DESCANSO FLOTANTE
// ============================================================================

function startRestTimer(seconds) {
  if (restTimerInterval) clearInterval(restTimerInterval);
  restTimerRemaining = seconds;
  const bar = document.getElementById('rest-timer-bar');
  const disp = document.getElementById('rest-timer-display');
  if (bar) bar.classList.add('active');
  if (disp) disp.textContent = formatSeconds(restTimerRemaining);

  restTimerInterval = setInterval(() => {
    restTimerRemaining--;
    if (disp) disp.textContent = formatSeconds(restTimerRemaining);
    if (restTimerRemaining <= 0) {
      clearInterval(restTimerInterval);
      if (bar) bar.classList.remove('active');
      playSound('timer_end');
      showToast('⏱️ ¡Tiempo de descanso terminado! A darle a la siguiente serie 💪');
    }
  }, 1000);
}

function adjustRestTimer(deltaSec) {
  restTimerRemaining = Math.max(5, restTimerRemaining + deltaSec);
  const disp = document.getElementById('rest-timer-display');
  if (disp) disp.textContent = formatSeconds(restTimerRemaining);
}

function stopRestTimer() {
  if (restTimerInterval) clearInterval(restTimerInterval);
  const bar = document.getElementById('rest-timer-bar');
  if (bar) bar.classList.remove('active');
}

// ============================================================================
// MODALES DE EJERCICIOS, RUTINAS Y CALCULADORA DE DISCOS
// ============================================================================

function openModal(title, htmlContent) {
  document.getElementById('generic-modal-title').textContent = title;
  document.getElementById('generic-modal-body').innerHTML = htmlContent;
  document.getElementById('generic-modal-backdrop').classList.add('open');
}

function closeModal() {
  document.getElementById('generic-modal-backdrop').classList.remove('open');
}

function openAddExerciseToWorkoutModal() {
  const optionsHtml = appData.exercises.map(ex => `
    <div class="meal-item" style="cursor:pointer;" onclick="confirmAddExerciseToLive('${ex.id}')">
      <div>
        <div class="meal-item-title">${escapeHtml(ex.name)}</div>
        <div class="meal-item-sub">${escapeHtml(ex.muscle)} • ${escapeHtml(ex.equipment || 'Libre')}</div>
      </div>
      <span class="btn btn-primary btn-sm">➕</span>
    </div>
  `).join('');

  openModal('Agregar Ejercicio a la Sesión', `
    <input type="text" class="form-control" placeholder="🔍 Filtrar ejercicio..." style="margin-bottom:10px;"
      oninput="filterModalExercises(this.value)" />
    <div id="modal-ex-picker-list" style="max-height:55vh; overflow-y:auto;">
      ${optionsHtml}
    </div>
  `);
}

function filterModalExercises(q) {
  const query = q.toLowerCase().trim();
  const list = document.getElementById('modal-ex-picker-list');
  if (!list) return;
  list.innerHTML = appData.exercises
    .filter(ex => ex.name.toLowerCase().includes(query) || ex.muscle.toLowerCase().includes(query))
    .map(ex => `
      <div class="meal-item" style="cursor:pointer;" onclick="confirmAddExerciseToLive('${ex.id}')">
        <div>
          <div class="meal-item-title">${escapeHtml(ex.name)}</div>
          <div class="meal-item-sub">${escapeHtml(ex.muscle)} • ${escapeHtml(ex.equipment || 'Libre')}</div>
        </div>
        <span class="btn btn-primary btn-sm">➕</span>
      </div>
    `).join('');
}

function confirmAddExerciseToLive(exId) {
  if (!appData.activeWorkout) return;
  const prevSets = getPreviousSetsForExercise(exId);
  const prev = prevSets[0] || null;
  appData.activeWorkout.exercises.push({
    exerciseId: exId,
    restSeconds: 90,
    sets: [
      {
        type: '1',
        weight: prev ? prev.weight : '',
        reps: prev ? prev.reps : 10,
        prevText: prev ? `${prev.weight}kg × ${prev.reps}` : '8-12',
        completed: false,
        isPR: false
      },
      {
        type: '1',
        weight: prev ? prev.weight : '',
        reps: prev ? prev.reps : 10,
        prevText: prev ? `${prev.weight}kg × ${prev.reps}` : '8-12',
        completed: false,
        isPR: false
      },
      {
        type: '1',
        weight: prev ? prev.weight : '',
        reps: prev ? prev.reps : 10,
        prevText: prev ? `${prev.weight}kg × ${prev.reps}` : '8-12',
        completed: false,
        isPR: false
      }
    ]
  });
  saveAppData();
  closeModal();
  renderLiveWorkoutSession();
}

function openNewExerciseModal() {
  openModal('Crear Nuevo Ejercicio', `
    <div class="form-group">
      <label class="form-label">Nombre del Ejercicio</label>
      <input type="text" id="new-ex-name" class="form-control" placeholder="Ej: Press Pendular en Máquina" />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Grupo Muscular</label>
        <select id="new-ex-muscle" class="form-control">
          <option value="Pecho">Pecho</option>
          <option value="Espalda">Espalda</option>
          <option value="Piernas">Piernas</option>
          <option value="Hombros">Hombros</option>
          <option value="Bíceps">Bíceps</option>
          <option value="Tríceps">Tríceps</option>
          <option value="Core">Core</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Equipo</label>
        <select id="new-ex-equip" class="form-control">
          <option value="Barra">Barra</option>
          <option value="Mancuernas">Mancuernas</option>
          <option value="Máquina">Máquina</option>
          <option value="Polea">Polea</option>
          <option value="Peso Corporal">Peso Corporal</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Notas / Técnica (opcional)</label>
      <input type="text" id="new-ex-notes" class="form-control" placeholder="Ej: Asiento en nivel 4, pausa abajo" />
    </div>
    <button class="btn btn-primary btn-block" onclick="saveNewExercise()">💾 Guardar Ejercicio</button>
  `);
}

function saveNewExercise() {
  const name = document.getElementById('new-ex-name').value.trim();
  if (!name) {
    showToast('Escribe el nombre del ejercicio.', '#ef4444');
    return;
  }
  const muscle = document.getElementById('new-ex-muscle').value;
  const equipment = document.getElementById('new-ex-equip').value;
  const notes = document.getElementById('new-ex-notes').value.trim();

  appData.exercises.unshift({
    id: 'ex_custom_' + Date.now(),
    name,
    muscle,
    equipment,
    notes
  });
  saveAppData();
  closeModal();
  renderExerciseLibrary();
  showToast('✅ Ejercicio agregado a tu biblioteca.');
}

// Crear o Editar Rutina Personalizada
let tempRoutineExercises = [];
let editingRoutineId = null;

function openRoutineModal(routineId = null) {
  editingRoutineId = routineId;
  const existing = routineId ? appData.routines.find(r => r.id === routineId) : null;
  tempRoutineExercises = existing
    ? JSON.parse(JSON.stringify(existing.exercises))
    : [{ exerciseId: appData.exercises[0].id, targetSets: 3, targetReps: '8-10', restSeconds: 90 }];

  const exOptions = appData.exercises.map(e => `<option value="${e.id}">${escapeHtml(e.name)} (${e.muscle})</option>`).join('');

  openModal(existing ? 'Editar Rutina' : 'Crear Nueva Rutina', `
    <div class="form-group">
      <label class="form-label">Nombre de la Rutina</label>
      <input type="text" id="rt-modal-name" class="form-control" value="${existing ? escapeHtml(existing.name) : ''}" placeholder="Ej: Día de Pecho y Espalda (Arnold Split)" />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Etiqueta / Enfoque</label>
        <input type="text" id="rt-modal-tag" class="form-control" value="${existing ? escapeHtml(existing.tag || '') : 'Hipertrofia'}" />
      </div>
      <div class="form-group">
        <label class="form-label">Color</label>
        <input type="color" id="rt-modal-color" class="form-control" style="height:40px; padding:4px;" value="${existing ? (existing.color || '#10b981') : '#10b981'}" />
      </div>
    </div>

    <div class="form-label" style="margin-top:6px;">Ejercicios de la Rutina:</div>
    <div id="rt-modal-exercises-list" style="margin-bottom:10px;"></div>

    <div style="display:flex; gap:8px; margin-bottom:14px;">
      <select id="rt-modal-add-select" class="form-control">${exOptions}</select>
      <button class="btn btn-secondary" onclick="addExerciseToRoutineDraft()">➕ Añadir</button>
    </div>

    <button class="btn btn-primary btn-block" onclick="saveRoutineFromModal()">💾 Guardar Rutina</button>
  `);

  renderRoutineDraftExercises();
}

function renderRoutineDraftExercises() {
  const container = document.getElementById('rt-modal-exercises-list');
  if (!container) return;
  container.innerHTML = tempRoutineExercises.map((item, idx) => {
    const ex = getExerciseById(item.exerciseId);
    return `
      <div style="background:var(--bg-input); border:1px solid var(--border); border-radius:10px; padding:8px 10px; margin-bottom:6px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <strong style="font-size:13px;">${idx + 1}. ${escapeHtml(ex ? ex.name : 'Ejercicio')}</strong>
          <button class="btn btn-ghost btn-sm" style="padding:2px 6px;" onclick="tempRoutineExercises.splice(${idx},1); renderRoutineDraftExercises();">✕</button>
        </div>
        <div class="form-row" style="grid-template-columns: repeat(3, 1fr); gap:6px;">
          <div>
            <span style="font-size:10px; color:var(--text-muted);">Series</span>
            <input type="number" class="form-control" style="padding:5px;" value="${item.targetSets}"
              oninput="tempRoutineExercises[${idx}].targetSets = Number(this.value)||3" />
          </div>
          <div>
            <span style="font-size:10px; color:var(--text-muted);">Reps Meta</span>
            <input type="text" class="form-control" style="padding:5px;" value="${item.targetReps}"
              oninput="tempRoutineExercises[${idx}].targetReps = this.value" />
          </div>
          <div>
            <span style="font-size:10px; color:var(--text-muted);">Descanso (s)</span>
            <input type="number" class="form-control" style="padding:5px;" value="${item.restSeconds || 90}"
              oninput="tempRoutineExercises[${idx}].restSeconds = Number(this.value)||90" />
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function addExerciseToRoutineDraft() {
  const sel = document.getElementById('rt-modal-add-select');
  if (!sel) return;
  tempRoutineExercises.push({
    exerciseId: sel.value,
    targetSets: 3,
    targetReps: '8-12',
    restSeconds: 90
  });
  renderRoutineDraftExercises();
}

function saveRoutineFromModal() {
  const name = document.getElementById('rt-modal-name').value.trim();
  if (!name) {
    showToast('Ponle un nombre a tu rutina.', '#ef4444');
    return;
  }
  const tag = document.getElementById('rt-modal-tag').value.trim();
  const color = document.getElementById('rt-modal-color').value;

  if (editingRoutineId) {
    const idx = appData.routines.findIndex(r => r.id === editingRoutineId);
    if (idx >= 0) {
      appData.routines[idx] = { id: editingRoutineId, name, tag, color, exercises: tempRoutineExercises };
    }
  } else {
    appData.routines.unshift({
      id: 'rt_custom_' + Date.now(),
      name,
      tag,
      color,
      exercises: tempRoutineExercises
    });
  }

  saveAppData();
  closeModal();
  renderAllViews();
  showToast('✅ Rutina guardada correctamente.');
}

function deleteRoutine(rtId) {
  if (!confirm('¿Seguro que quieres eliminar esta rutina?')) return;
  appData.routines = appData.routines.filter(r => r.id !== rtId);
  saveAppData();
  renderAllViews();
}

// Calculadora Visual de Discos para Barra Olímpica
function openPlateCalcModal(initialWeight = 100) {
  openModal('💿 Calculadora de Discos (Barra)', `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Peso Total Objetivo (kg)</label>
        <input type="number" id="plate-total-weight" class="form-control" value="${initialWeight}" step="2.5" oninput="updatePlateCalcVisual()" />
      </div>
      <div class="form-group">
        <label class="form-label">Peso de la Barra (kg)</label>
        <select id="plate-bar-weight" class="form-control" onchange="updatePlateCalcVisual()">
          <option value="20" selected>20 kg (Olímpica Estándar)</option>
          <option value="15">15 kg (Olímpica Femenina)</option>
          <option value="10">10 kg (Barra Z / Preolímpica)</option>
          <option value="0">0 kg (Máquina / Prensa)</option>
        </select>
      </div>
    </div>
    <div id="plate-visual-container" class="barbell-visual"></div>
    <div id="plate-breakdown-text" style="text-align:center; font-size:13.5px; font-weight:700; color:var(--accent);"></div>
  `);
  updatePlateCalcVisual();
}

function updatePlateCalcVisual() {
  const total = Number(document.getElementById('plate-total-weight')?.value) || 0;
  const bar = Number(document.getElementById('plate-bar-weight')?.value) || 0;
  const visual = document.getElementById('plate-visual-container');
  const textEl = document.getElementById('plate-breakdown-text');
  if (!visual || !textEl) return;

  if (total <= bar) {
    visual.innerHTML = `<div class="bar-sleeve" style="width:160px;"></div>`;
    textEl.textContent = 'Solo la barra (sin discos adicionales).';
    return;
  }

  let perSide = (total - bar) / 2;
  const availablePlates = [
    { w: 25, color: '#ef4444', h: 92 },
    { w: 20, color: '#3b82f6', h: 88 },
    { w: 15, color: '#eab308', h: 78 },
    { w: 10, color: '#10b981', h: 68 },
    { w: 5, color: '#f3f4f6', h: 56, textColor: '#111' },
    { w: 2.5, color: '#6b7280', h: 46 },
    { w: 1.25, color: '#9ca3af', h: 38, textColor: '#111' }
  ];

  const chosen = [];
  let rem = perSide;
  for (const p of availablePlates) {
    while (rem >= p.w - 0.001) {
      chosen.push(p);
      rem = Math.round((rem - p.w) * 100) / 100;
    }
  }

  const platesHtml = chosen.map(p => `
    <div class="plate-item" style="height:${p.h}px; background:${p.color}; color:${p.textColor || '#fff'};">
      ${p.w}
    </div>
  `).join('');

  visual.innerHTML = `
    <div class="bar-sleeve"></div>
    ${platesHtml}
    <div class="bar-sleeve" style="width:24px;"></div>
  `;

  const counts = {};
  chosen.forEach(p => { counts[p.w] = (counts[p.w] || 0) + 1; });
  const summaryParts = Object.entries(counts).map(([w, c]) => `${c}× ${w}kg`);
  textEl.innerHTML = `Por cada lado (${perSide} kg): <br/><span style="color:#fff;">${summaryParts.join('  +  ') || 'Ninguno'}</span>`;
}

// ============================================================================
// 3. NUTRICIÓN, CÁLCULO DE CALORÍAS CON IA Y ESCÁNER DE CÓDIGO DE BARRAS
// ============================================================================

function switchNutritionSubtab(sub) {
  ['diary', 'ai', 'barcode', 'search'].forEach(k => {
    document.getElementById(`nut-sub-${k}`).style.display = k === sub ? 'block' : 'none';
    document.getElementById(`ntab-${k}`).classList.toggle('active', k === sub);
  });
  if (sub !== 'barcode') {
    stopBarcodeScanner();
  }
  if (sub === 'search') {
    renderFoodDatabaseList();
  }
}

function openQuickNutritionMode(mode) {
  switchTab('nutrition');
  switchNutritionSubtab(mode);
}

function changeNutritionDate(deltaDays) {
  const [y, m, d] = currentNutritionDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + deltaDays);
  const ny = dt.getFullYear();
  const nm = String(dt.getMonth() + 1).padStart(2, '0');
  const nd = String(dt.getDate()).padStart(2, '0');
  currentNutritionDate = `${ny}-${nm}-${nd}`;
  document.getElementById('nutrition-date-picker').value = currentNutritionDate;
  renderNutritionView();
}

function onNutritionDateChange(val) {
  if (!val) return;
  currentNutritionDate = val;
  renderNutritionView();
}

function renderNutritionView() {
  const totals = calculateDayTotals(currentNutritionDate);
  const g = appData.settings;

  document.getElementById('nut-kcal-in').textContent = Math.round(totals.kcal);
  document.getElementById('nut-kcal-target').textContent = g.kcalGoal;
  const left = g.kcalGoal - Math.round(totals.kcal);
  const leftEl = document.getElementById('nut-kcal-left');
  leftEl.textContent = left >= 0 ? `${left} kcal` : `+${Math.abs(left)} kcal`;
  leftEl.style.color = left >= 0 ? 'var(--accent)' : 'var(--amber)';

  document.getElementById('nut-p-val').textContent = `${Math.round(totals.protein)} / ${g.proteinGoal}g`;
  document.getElementById('nut-c-val').textContent = `${Math.round(totals.carbs)} / ${g.carbsGoal}g`;
  document.getElementById('nut-f-val').textContent = `${Math.round(totals.fat)} / ${g.fatGoal}g`;

  renderMealsDiary();
  renderFoodDatabaseList();
}

function renderMealsDiary() {
  const container = document.getElementById('meals-diary-container');
  if (!container) return;

  const day = getDayNutrition(currentNutritionDate);
  const slots = [
    { key: 'Desayuno', icon: '🌅', title: 'Desayuno' },
    { key: 'Almuerzo', icon: '☀️', title: 'Almuerzo' },
    { key: 'Cena', icon: '🌙', title: 'Cena' },
    { key: 'Snacks', icon: '🍎', title: 'Snacks / Pre & Post Entreno' }
  ];

  container.innerHTML = slots.map(slot => {
    const slotItems = day.items.filter(i => i.slot === slot.key);
    const slotKcal = slotItems.reduce((sum, i) => sum + (Number(i.kcal) || 0), 0);

    const itemsHtml = slotItems.length === 0
      ? `<div style="font-size:12px; color:var(--text-dim); padding:6px 0;">Sin alimentos registrados.</div>`
      : slotItems.map(item => `
          <div class="meal-item">
            <div>
              <div class="meal-item-title">${escapeHtml(item.name)} <span style="font-size:11px; color:var(--text-muted);">(${item.grams}g)</span></div>
              <div class="meal-item-sub">
                P: ${Math.round(item.protein)}g • C: ${Math.round(item.carbs)}g • G: ${Math.round(item.fat)}g
              </div>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <strong style="font-size:13.5px; color:var(--accent);">${Math.round(item.kcal)} kcal</strong>
              <button class="btn btn-ghost btn-sm" style="padding:3px 7px;" onclick="deleteDiaryFoodItem('${item.id}')">✕</button>
            </div>
          </div>
        `).join('');

    return `
      <div class="card">
        <div class="card-header" style="margin-bottom:8px;">
          <div class="card-title">${slot.icon} ${slot.title}</div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="badge badge-accent">${Math.round(slotKcal)} kcal</span>
            <button class="btn btn-secondary btn-sm" onclick="switchNutritionSubtab('search')">➕</button>
          </div>
        </div>
        ${itemsHtml}
      </div>
    `;
  }).join('');
}

function addFoodItemToDiary(itemObj) {
  const day = getDayNutrition(currentNutritionDate);
  day.items.push({
    id: 'meal_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    slot: itemObj.slot || 'Almuerzo',
    name: itemObj.name,
    grams: Number(itemObj.grams) || 100,
    kcal: Math.round(Number(itemObj.kcal) || 0),
    protein: Math.round((Number(itemObj.protein) || 0) * 10) / 10,
    carbs: Math.round((Number(itemObj.carbs) || 0) * 10) / 10,
    fat: Math.round((Number(itemObj.fat) || 0) * 10) / 10
  });
  saveAppData();
  renderAllViews();
}

function deleteDiaryFoodItem(itemId) {
  const day = getDayNutrition(currentNutritionDate);
  day.items = day.items.filter(i => i.id !== itemId);
  saveAppData();
  renderAllViews();
}

// ============================================================================
// CONTROL DE CALORÍAS POR FOTO CON IA (GEMINI VISION + ESTIMADOR INTELIGENTE)
// ============================================================================

function updateAIKeyStatusBadge() {
  const statusEl = document.getElementById('ai-key-status-text');
  if (!statusEl) return;
  if (appData.settings.geminiApiKey && appData.settings.geminiApiKey.trim().length > 10) {
    statusEl.innerHTML = '🟢 <strong>IA Gemini Vision Activa</strong> (Análisis visual directo)';
  } else {
    statusEl.innerHTML = '🟡 <strong>Modo Asistente Local</strong> (Agrega tu API Key gratis para visión automática)';
  }
}

function handleFoodPhotoSelected(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      // Comprimir imagen en canvas para envío rápido desde el celular
      const canvas = document.createElement('canvas');
      const maxDim = 800;
      let w = img.width;
      let h = img.height;
      if (w > h && w > maxDim) {
        h = Math.round((h * maxDim) / w);
        w = maxDim;
      } else if (h > maxDim) {
        w = Math.round((w * maxDim) / h);
        h = maxDim;
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      currentPhotoBase64 = dataUrl.split(',')[1];

      const preview = document.getElementById('ai-photo-preview');
      preview.src = dataUrl;
      preview.style.display = 'block';
      showToast('📸 Foto lista. Presiona "Calcular Calorías de la Foto".');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

async function analyzeFoodPhotoWithAI() {
  const hint = document.getElementById('ai-photo-hint').value.trim();
  const apiKey = (appData.settings.geminiApiKey || '').trim();
  const btn = document.getElementById('btn-analyze-photo');

  if (!currentPhotoBase64 && !hint) {
    showToast('📷 Toma o sube una foto de tu plato (o describe tu comida) primero.', '#f59e0b');
    return;
  }

  // Si el usuario configuró su API Key de Google Gemini, analizamos la imagen con Gemini Vision
  if (apiKey && currentPhotoBase64) {
    try {
      btn.disabled = true;
      btn.textContent = '🔍 Analizando plato con IA Vision...';

      const promptText = `Eres un nutricionista deportivo experto. Analiza la foto de esta comida${hint ? ` (Nota del usuario: "${hint}")` : ''}.
Identifica cada alimento visible en el plato, estima su peso en gramos y calcula sus calorías (kcal), proteínas (g), carbohidratos (g) y grasas (g).
Responde ÚNICAMENTE con un objeto JSON válido con este formato exacto, sin markdown adicional:
{"items":[{"name":"Nombre del alimento en español","grams":150,"kcal":240,"protein":35,"carbs":0,"fat":5}]}`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: promptText },
                { inline_data: { mime_type: 'image/jpeg', data: currentPhotoBase64 } }
              ]
            }],
            generationConfig: { temperature: 0.2 }
          })
        }
      );

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.items && parsed.items.length > 0) {
          aiDetectedItems = parsed.items;
          aiPortionScale = 1.0;
          document.getElementById('ai-portion-slider').value = '1.0';
          renderAIDetectedResults();
          showToast('✨ ¡Plato analizado con IA exitosamente!');
          btn.disabled = false;
          btn.textContent = '✨ Calcular Calorías de la Foto';
          return;
        }
      }
      throw new Error(data?.error?.message || 'Respuesta no reconocida');
    } catch (err) {
      console.warn('Error en llamada Gemini API, usando estimador inteligente local:', err);
      showToast('⚠️ Usando estimador inteligente local (verifica tu API Key si deseas visión en la nube).', '#f59e0b');
    } finally {
      btn.disabled = false;
      btn.textContent = '✨ Calcular Calorías de la Foto';
    }
  }

  // Estimador Inteligente Local (interpreta la descripción o arma un desglose editable del plato)
  aiDetectedItems = estimateMealFromHintOrDefault(hint);
  aiPortionScale = 1.0;
  document.getElementById('ai-portion-slider').value = '1.0';
  renderAIDetectedResults();
  showToast('🍽️ Desglose estimado listo. Puedes ajustar los gramos o porción antes de guardar.');
}

function estimateMealFromHintOrDefault(hintText) {
  if (!hintText) {
    return [
      { name: 'Pechuga de Pollo / Proteína Principal', grams: 160, kcal: 264, protein: 49.6, carbs: 0, fat: 5.8 },
      { name: 'Arroz Blanco / Guarnición Carbohidrato', grams: 150, kcal: 195, protein: 4.0, carbs: 42, fat: 0.5 },
      { name: 'Ensalada / Vegetales con Aceite', grams: 120, kcal: 75, protein: 1.5, carbs: 6, fat: 5.0 }
    ];
  }

  const text = hintText.toLowerCase();
  const matched = [];

  const rules = [
    { keys: ['pollo', 'pechuga'], ref: DEFAULT_FOODS[0], defaultG: 160 },
    { keys: ['carne', 'res', 'bistec'], ref: DEFAULT_FOODS[2], defaultG: 150 },
    { keys: ['huevo', 'huevos'], ref: DEFAULT_FOODS[3], defaultG: 120 },
    { keys: ['atun', 'atún'], ref: DEFAULT_FOODS[5], defaultG: 120 },
    { keys: ['salmon', 'salmón', 'pescado'], ref: DEFAULT_FOODS[6], defaultG: 150 },
    { keys: ['whey', 'proteina', 'scoop', 'batido'], ref: DEFAULT_FOODS[7], defaultG: 30 },
    { keys: ['yogurt', 'griego'], ref: DEFAULT_FOODS[8], defaultG: 150 },
    { keys: ['arroz'], ref: DEFAULT_FOODS[12], defaultG: 160 },
    { keys: ['avena'], ref: DEFAULT_FOODS[14], defaultG: 60 },
    { keys: ['papa', 'patata'], ref: DEFAULT_FOODS[15], defaultG: 180 },
    { keys: ['camote', 'batata'], ref: DEFAULT_FOODS[16], defaultG: 180 },
    { keys: ['pasta', 'fideos', 'espagueti'], ref: DEFAULT_FOODS[17], defaultG: 180 },
    { keys: ['pan', 'tostada'], ref: DEFAULT_FOODS[18], defaultG: 60 },
    { keys: ['tortilla'], ref: DEFAULT_FOODS[19], defaultG: 60 },
    { keys: ['frijol', 'lenteja'], ref: DEFAULT_FOODS[20], defaultG: 130 },
    { keys: ['arepa'], ref: DEFAULT_FOODS[21], defaultG: 100 },
    { keys: ['platano', 'plátano', 'banano', 'banana'], ref: DEFAULT_FOODS[22], defaultG: 120 },
    { keys: ['manzana'], ref: DEFAULT_FOODS[23], defaultG: 150 },
    { keys: ['ensalada', 'verdura', 'brocoli', 'brócoli'], ref: DEFAULT_FOODS[26], defaultG: 120 },
    { keys: ['aguacate', 'palta'], ref: DEFAULT_FOODS[27], defaultG: 80 },
    { keys: ['hamburguesa'], ref: DEFAULT_FOODS[33], defaultG: 220 },
    { keys: ['pizza'], ref: DEFAULT_FOODS[34], defaultG: 220 }
  ];

  rules.forEach(r => {
    if (r.keys.some(k => text.includes(k)) && r.ref) {
      const ratio = r.defaultG / r.ref.servingG;
      matched.push({
        name: r.ref.name,
        grams: r.defaultG,
        kcal: Math.round(r.ref.kcal * ratio),
        protein: Math.round(r.ref.protein * ratio * 10) / 10,
        carbs: Math.round(r.ref.carbs * ratio * 10) / 10,
        fat: Math.round(r.ref.fat * ratio * 10) / 10
      });
    }
  });

  if (matched.length === 0) {
    return [
      { name: hintText, grams: 300, kcal: 480, protein: 32, carbs: 48, fat: 16 }
    ];
  }
  return matched;
}

function updateAIPortionScale(val) {
  aiPortionScale = Number(val) || 1.0;
  document.getElementById('ai-portion-scale-lbl').textContent = `${Math.round(aiPortionScale * 100)}% (${aiPortionScale.toFixed(1)}x)`;
  renderAIDetectedResults();
}

function renderAIDetectedResults() {
  const card = document.getElementById('ai-analysis-results');
  const listEl = document.getElementById('ai-detected-items-list');
  const badgeEl = document.getElementById('ai-total-kcal-badge');
  if (!card || !listEl) return;

  card.style.display = 'block';
  let totalKcal = 0;

  listEl.innerHTML = aiDetectedItems.map((item, idx) => {
    const g = Math.round(item.grams * aiPortionScale);
    const kcal = Math.round(item.kcal * aiPortionScale);
    const p = (item.protein * aiPortionScale).toFixed(1);
    const c = (item.carbs * aiPortionScale).toFixed(1);
    const f = (item.fat * aiPortionScale).toFixed(1);
    totalKcal += kcal;

    return `
      <div class="meal-item">
        <div>
          <div class="meal-item-title">${escapeHtml(item.name)} <span class="badge">${g}g</span></div>
          <div class="meal-item-sub">Prot: ${p}g • Carb: ${c}g • Grasa: ${f}g</div>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <strong style="color:var(--accent);">${kcal} kcal</strong>
          <button class="btn btn-ghost btn-sm" style="padding:2px 6px;" onclick="aiDetectedItems.splice(${idx},1); renderAIDetectedResults();">✕</button>
        </div>
      </div>
    `;
  }).join('');

  badgeEl.textContent = `${totalKcal} kcal totales`;
}

function saveAIDetectedMealToDiary() {
  if (aiDetectedItems.length === 0) return;
  const slot = document.getElementById('ai-meal-slot')?.value || 'Almuerzo';

  aiDetectedItems.forEach(item => {
    addFoodItemToDiary({
      slot,
      name: `📸 ${item.name}`,
      grams: Math.round(item.grams * aiPortionScale),
      kcal: Math.round(item.kcal * aiPortionScale),
      protein: item.protein * aiPortionScale,
      carbs: item.carbs * aiPortionScale,
      fat: item.fat * aiPortionScale
    });
  });

  document.getElementById('ai-analysis-results').style.display = 'none';
  showToast(`✅ ¡Plato agregado a ${slot}!`);
  switchNutritionSubtab('diary');
}

// ============================================================================
// ESCÁNER DE CÓDIGO DE BARRAS (CÁMARA + OPENFOODFACTS API)
// ============================================================================

async function startBarcodeScanner() {
  const readerBox = document.getElementById('barcode-reader-box');
  const startBtn = document.getElementById('btn-start-scanner');
  const stopBtn = document.getElementById('btn-stop-scanner');

  if (typeof Html5Qrcode === 'undefined') {
    showToast('⚠️ Librería de cámara cargando o sin conexión. Puedes escribir el código manualmente abajo.', '#f59e0b');
    return;
  }

  try {
    readerBox.innerHTML = `<div id="qr-video-Mount" style="width:100%;"></div>`;
    html5QrScanner = new Html5Qrcode('qr-video-Mount');
    startBtn.style.display = 'none';
    stopBtn.style.display = 'inline-flex';

    await html5QrScanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 120 } },
      (decodedText) => {
        playSound('beep');
        stopBarcodeScanner();
        document.getElementById('manual-barcode-input').value = decodedText;
        lookupBarcodeProduct(decodedText);
      },
      () => {}
    );
  } catch (err) {
    startBtn.style.display = 'inline-flex';
    stopBtn.style.display = 'none';
    readerBox.innerHTML = `<div style="padding:16px; text-align:center; color:var(--text-muted);">No se pudo acceder a la cámara (asegúrate de dar permiso o abrir por HTTPS/localhost). Puedes escribir el código de barras abajo.</div>`;
  }
}

async function stopBarcodeScanner() {
  const startBtn = document.getElementById('btn-start-scanner');
  const stopBtn = document.getElementById('btn-stop-scanner');
  if (startBtn) startBtn.style.display = 'inline-flex';
  if (stopBtn) stopBtn.style.display = 'none';

  if (html5QrScanner) {
    try {
      await html5QrScanner.stop();
      await html5QrScanner.clear();
    } catch (e) {}
    html5QrScanner = null;
  }
}

async function lookupBarcodeProduct(rawCode) {
  const code = (rawCode || '').trim();
  if (!code) {
    showToast('Ingresa o escanea un código de barras válido.', '#ef4444');
    return;
  }

  const card = document.getElementById('barcode-product-card');
  card.style.display = 'block';
  card.innerHTML = `<div style="text-align:center; padding:14px;">🔍 Buscando código <strong>${escapeHtml(code)}</strong>...</div>`;

  // 1. Buscar primero en la base local
  const localMatch = appData.foods.find(f => f.barcode === code);
  if (localMatch) {
    renderScannedProductCard(localMatch, code);
    return;
  }

  // 2. Consultar API mundial OpenFoodFacts
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`);
    const data = await res.json();

    if (data && data.status === 1 && data.product) {
      const p = data.product;
      const nut = p.nutriments || {};
      const kcal100 = Number(nut['energy-kcal_100g'] || nut['energy-kcal'] || (nut['energy_100g'] ? nut['energy_100g'] / 4.184 : 0)) || 0;
      const prot100 = Number(nut.proteins_100g || nut.proteins || 0);
      const carbs100 = Number(nut.carbohydrates_100g || nut.carbohydrates || 0);
      const fat100 = Number(nut.fat_100g || nut.fat || 0);

      const foundFood = {
        id: 'fd_off_' + code,
        name: p.product_name_es || p.product_name || 'Producto Escaneado',
        brand: p.brands || 'Supermercado',
        servingG: 100,
        kcal: Math.round(kcal100),
        protein: Math.round(prot100 * 10) / 10,
        carbs: Math.round(carbs100 * 10) / 10,
        fat: Math.round(fat100 * 10) / 10,
        barcode: code,
        image: p.image_front_small_url || ''
      };

      // Guardar en base local para que quede disponible sin internet la próxima vez
      if (!appData.foods.some(f => f.barcode === code)) {
        appData.foods.unshift(foundFood);
        saveAppData();
      }

      renderScannedProductCard(foundFood, code);
      return;
    }
  } catch (e) {
    console.warn('Error consultando OpenFoodFacts:', e);
  }

  // Si el código no existe aún, ofrecer registrarlo
  card.innerHTML = `
    <div style="text-align:center; padding:10px;">
      <div style="font-weight:800; margin-bottom:6px;">Producto no encontrado para el código ${escapeHtml(code)}</div>
      <p style="font-size:12px; color:var(--text-muted); margin-bottom:10px;">
        ¿Quieres guardarlo en tu base personal con este código de barras para que siempre lo reconozca al instante?
      </p>
      <button class="btn btn-primary btn-sm" onclick="openCustomFoodModal('${escapeHtml(code)}')">➕ Registrar este Código</button>
    </div>
  `;
}

let activeScannedFood = null;

function renderScannedProductCard(food, code) {
  activeScannedFood = food;
  const card = document.getElementById('barcode-product-card');
  card.style.display = 'block';
  card.innerHTML = `
    <div style="display:flex; gap:12px; align-items:center; margin-bottom:12px;">
      ${food.image ? `<img src="${food.image}" style="width:58px; height:58px; object-fit:cover; border-radius:10px; border:1px solid var(--border);" />` : `<div style="width:52px; height:52px; border-radius:10px; background:var(--bg-elevated); display:flex; align-items:center; justify-content:center; font-size:24px;">🏷️</div>`}
      <div>
        <span class="badge badge-blue">Código: ${escapeHtml(code)}</span>
        <div style="font-size:16px; font-weight:800; margin-top:2px;">${escapeHtml(food.name)}</div>
        <div style="font-size:12px; color:var(--text-muted);">${escapeHtml(food.brand || 'Marca')} • Base cada ${food.servingG}g</div>
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Cantidad consumida (gramos / ml)</label>
        <input type="number" id="scanned-food-grams" class="form-control" value="${food.servingG}" oninput="updateScannedFoodPreview()" />
      </div>
      <div class="form-group">
        <label class="form-label">Comida</label>
        <select id="scanned-food-slot" class="form-control">
          <option value="Desayuno">🌅 Desayuno</option>
          <option value="Almuerzo" selected>☀️ Almuerzo</option>
          <option value="Cena">🌙 Cena</option>
          <option value="Snacks">🍎 Snacks</option>
        </select>
      </div>
    </div>

    <div id="scanned-macros-preview" style="background:var(--bg-input); padding:10px; border-radius:10px; margin-bottom:12px; text-align:center; font-size:13px; font-weight:700;"></div>

    <button class="btn btn-primary btn-block" onclick="confirmAddScannedFood()">
      ✅ Agregar al Diario de Hoy
    </button>
  `;
  updateScannedFoodPreview();
}

function updateScannedFoodPreview() {
  if (!activeScannedFood) return;
  const g = Number(document.getElementById('scanned-food-grams')?.value) || 0;
  const ratio = g / Math.max(1, activeScannedFood.servingG);
  const kcal = Math.round(activeScannedFood.kcal * ratio);
  const p = (activeScannedFood.protein * ratio).toFixed(1);
  const c = (activeScannedFood.carbs * ratio).toFixed(1);
  const f = (activeScannedFood.fat * ratio).toFixed(1);

  const el = document.getElementById('scanned-macros-preview');
  if (el) {
    el.innerHTML = `<span style="color:var(--accent); font-size:15px;">${kcal} kcal</span> &nbsp;•&nbsp; Prot: ${p}g &nbsp;|&nbsp; Carb: ${c}g &nbsp;|&nbsp; Grasa: ${f}g`;
  }
}

function confirmAddScannedFood() {
  if (!activeScannedFood) return;
  const g = Number(document.getElementById('scanned-food-grams')?.value) || 100;
  const slot = document.getElementById('scanned-food-slot')?.value || 'Almuerzo';
  const ratio = g / Math.max(1, activeScannedFood.servingG);

  addFoodItemToDiary({
    slot,
    name: activeScannedFood.name,
    grams: g,
    kcal: Math.round(activeScannedFood.kcal * ratio),
    protein: activeScannedFood.protein * ratio,
    carbs: activeScannedFood.carbs * ratio,
    fat: activeScannedFood.fat * ratio
  });

  showToast(`✅ ${activeScannedFood.name} agregado a ${slot}`);
  switchNutritionSubtab('diary');
}

// ============================================================================
// BASE DE DATOS DE ALIMENTOS Y BUSCADOR ONLINE
// ============================================================================

function renderFoodDatabaseList() {
  const container = document.getElementById('food-database-results');
  if (!container) return;
  const q = (document.getElementById('food-db-search')?.value || '').toLowerCase().trim();

  const filtered = appData.foods.filter(f =>
    !q || f.name.toLowerCase().includes(q) || (f.brand || '').toLowerCase().includes(q) || (f.barcode || '').includes(q)
  );

  container.innerHTML = filtered.slice(0, 35).map(f => `
    <div class="meal-item" style="cursor:pointer;" onclick="openLogFoodModal('${f.id}')">
      <div>
        <div class="meal-item-title">${escapeHtml(f.name)} <span class="badge">${f.servingG}g</span></div>
        <div class="meal-item-sub">
          <strong style="color:var(--accent);">${f.kcal} kcal</strong> • P: ${f.protein}g | C: ${f.carbs}g | G: ${f.fat}g
        </div>
      </div>
      <button class="btn btn-primary btn-sm">➕</button>
    </div>
  `).join('');
}

async function searchOpenFoodFactsByText() {
  const q = (document.getElementById('food-db-search')?.value || '').trim();
  if (!q) {
    showToast('Escribe el nombre de un producto o marca para buscar en línea.', '#f59e0b');
    return;
  }

  const container = document.getElementById('food-database-results');
  container.innerHTML = `<div style="text-align:center; padding:16px;">🌐 Buscando "${escapeHtml(q)}" en OpenFoodFacts...</div>`;

  try {
    const res = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=12`);
    const data = await res.json();
    if (data && data.products && data.products.length > 0) {
      data.products.forEach(p => {
        const nut = p.nutriments || {};
        const kcal = Math.round(Number(nut['energy-kcal_100g'] || nut['energy-kcal'] || 0));
        const name = p.product_name_es || p.product_name;
        if (name && kcal > 0) {
          const newItem = {
            id: 'fd_web_' + (p.code || Date.now() + Math.random()),
            name,
            brand: p.brands || 'Online',
            servingG: 100,
            kcal,
            protein: Math.round((Number(nut.proteins_100g) || 0) * 10) / 10,
            carbs: Math.round((Number(nut.carbohydrates_100g) || 0) * 10) / 10,
            fat: Math.round((Number(nut.fat_100g) || 0) * 10) / 10,
            barcode: p.code || ''
          };
          if (!appData.foods.some(existing => existing.name === newItem.name)) {
            appData.foods.unshift(newItem);
          }
        }
      });
      saveAppData();
      renderFoodDatabaseList();
      showToast('🌐 Resultados en línea agregados a tu buscador.');
      return;
    }
    showToast('No se encontraron productos adicionales en línea.', '#f59e0b');
    renderFoodDatabaseList();
  } catch (e) {
    showToast('Sin conexión al servidor online. Mostrando base local.', '#f59e0b');
    renderFoodDatabaseList();
  }
}

function openLogFoodModal(foodId) {
  const f = appData.foods.find(item => item.id === foodId);
  if (!f) return;
  activeScannedFood = f;

  openModal(`Registrar: ${f.name}`, `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Cantidad (gramos / ml)</label>
        <input type="number" id="modal-food-grams" class="form-control" value="${f.servingG}" oninput="updateModalFoodPreview()" />
      </div>
      <div class="form-group">
        <label class="form-label">Comida del Día</label>
        <select id="modal-food-slot" class="form-control">
          <option value="Desayuno">🌅 Desayuno</option>
          <option value="Almuerzo" selected>☀️ Almuerzo</option>
          <option value="Cena">🌙 Cena</option>
          <option value="Snacks">🍎 Snacks</option>
        </select>
      </div>
    </div>
    <div id="modal-food-preview" style="background:var(--bg-input); padding:12px; border-radius:10px; text-align:center; margin-bottom:14px; font-weight:700;"></div>
    <button class="btn btn-primary btn-block" onclick="confirmModalFoodLog()">✅ Agregar a Mi Día</button>
  `);
  updateModalFoodPreview();
}

function updateModalFoodPreview() {
  if (!activeScannedFood) return;
  const g = Number(document.getElementById('modal-food-grams')?.value) || 0;
  const ratio = g / Math.max(1, activeScannedFood.servingG);
  const el = document.getElementById('modal-food-preview');
  if (el) {
    el.innerHTML = `
      <span style="color:var(--accent); font-size:16px;">${Math.round(activeScannedFood.kcal * ratio)} kcal</span><br/>
      <span style="font-size:12px; color:var(--text-muted);">
        Proteína: ${(activeScannedFood.protein * ratio).toFixed(1)}g • Carbos: ${(activeScannedFood.carbs * ratio).toFixed(1)}g • Grasas: ${(activeScannedFood.fat * ratio).toFixed(1)}g
      </span>
    `;
  }
}

function confirmModalFoodLog() {
  if (!activeScannedFood) return;
  const g = Number(document.getElementById('modal-food-grams')?.value) || 100;
  const slot = document.getElementById('modal-food-slot')?.value || 'Almuerzo';
  const ratio = g / Math.max(1, activeScannedFood.servingG);

  addFoodItemToDiary({
    slot,
    name: activeScannedFood.name,
    grams: g,
    kcal: Math.round(activeScannedFood.kcal * ratio),
    protein: activeScannedFood.protein * ratio,
    carbs: activeScannedFood.carbs * ratio,
    fat: activeScannedFood.fat * ratio
  });

  closeModal();
  showToast(`✅ ${activeScannedFood.name} registrado en ${slot}`);
  switchNutritionSubtab('diary');
}

function openCustomFoodModal(prefillBarcode = '') {
  openModal('Crear Alimento Personalizado', `
    <div class="form-group">
      <label class="form-label">Nombre del Alimento o Plato</label>
      <input type="text" id="cf-name" class="form-control" placeholder="Ej: Mi Batido Ganador Casero" />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Porción Base (g / ml)</label>
        <input type="number" id="cf-serving" class="form-control" value="100" />
      </div>
      <div class="form-group">
        <label class="form-label">Código de Barras (opcional)</label>
        <input type="text" id="cf-barcode" class="form-control" value="${escapeHtml(prefillBarcode)}" placeholder="Ej: 75010..." />
      </div>
    </div>
    <div class="form-row-4" style="margin-bottom:14px;">
      <div>
        <label class="form-label">Kcal</label>
        <input type="number" id="cf-kcal" class="form-control" placeholder="200" />
      </div>
      <div>
        <label class="form-label">Prot (g)</label>
        <input type="number" id="cf-p" class="form-control" placeholder="20" />
      </div>
      <div>
        <label class="form-label">Carb (g)</label>
        <input type="number" id="cf-c" class="form-control" placeholder="15" />
      </div>
      <div>
        <label class="form-label">Grasa (g)</label>
        <input type="number" id="cf-f" class="form-control" placeholder="5" />
      </div>
    </div>
    <button class="btn btn-primary btn-block" onclick="saveCustomFood()">💾 Guardar en Mi Base de Datos</button>
  `);
}

function saveCustomFood() {
  const name = document.getElementById('cf-name').value.trim();
  if (!name) {
    showToast('Ingresa el nombre del alimento.', '#ef4444');
    return;
  }
  const newFood = {
    id: 'fd_custom_' + Date.now(),
    name,
    brand: 'Personalizado',
    servingG: Number(document.getElementById('cf-serving').value) || 100,
    barcode: document.getElementById('cf-barcode').value.trim(),
    kcal: Number(document.getElementById('cf-kcal').value) || 0,
    protein: Number(document.getElementById('cf-p').value) || 0,
    carbs: Number(document.getElementById('cf-c').value) || 0,
    fat: Number(document.getElementById('cf-f').value) || 0
  };
  appData.foods.unshift(newFood);
  saveAppData();
  closeModal();
  renderFoodDatabaseList();
  showToast('🍎 Alimento guardado en tu base de datos.');
}

// ============================================================================
// 4. PROGRESO, GRÁFICOS EN CANVAS Y BITÁCORA CORPORAL
// ============================================================================

function renderProgressView() {
  const sel = document.getElementById('progress-exercise-select');
  if (sel) {
    const currentVal = sel.value;
    sel.innerHTML = appData.exercises.map(ex => `<option value="${ex.id}">${escapeHtml(ex.name)}</option>`).join('');
    if (currentVal && appData.exercises.some(e => e.id === currentVal)) {
      sel.value = currentVal;
    }
  }
  renderStrengthChart();
  renderWeightChart();
  renderBodyLogsList();
}

function renderStrengthChart() {
  const canvas = document.getElementById('strength-chart-canvas');
  const sel = document.getElementById('progress-exercise-select');
  const summaryEl = document.getElementById('strength-chart-summary');
  if (!canvas || !sel) return;

  const exId = sel.value;
  const points = [];

  // Recorrer entrenamientos del más antiguo al más reciente
  [...appData.workouts].reverse().forEach(w => {
    const found = w.exercises.find(e => e.exerciseId === exId);
    if (found && found.sets.length > 0) {
      let best1RM = 0;
      let maxW = 0;
      found.sets.forEach(s => {
        const est = s.weight * (1 + s.reps / 30);
        if (est > best1RM) best1RM = est;
        if (s.weight > maxW) maxW = s.weight;
      });
      if (best1RM > 0) {
        points.push({ label: w.date.slice(5), value: Math.round(best1RM), maxW });
      }
    }
  });

  drawLineChartOnCanvas(canvas, points, '#10b981', 'kg (1RM)');

  if (summaryEl) {
    if (points.length === 0) {
      summaryEl.innerHTML = `<span>Sin registros aún para este ejercicio</span><span>Entrena para ver tu curva</span>`;
    } else {
      const first = points[0].value;
      const last = points[points.length - 1].value;
      const diff = last - first;
      summaryEl.innerHTML = `
        <span>Sesiones: <strong>${points.length}</strong></span>
        <span>Mejor 1RM: <strong>${ Math.max(...points.map(p => p.value)) } kg</strong></span>
        <span style="color:${diff >= 0 ? '#10b981' : '#f59e0b'};">Progreso: ${diff >= 0 ? '+' : ''}${diff} kg</span>
      `;
    }
  }
}

function renderWeightChart() {
  const canvas = document.getElementById('weight-chart-canvas');
  if (!canvas) return;
  const points = [...appData.bodyLogs]
    .reverse()
    .filter(b => Number(b.weight) > 0)
    .map(b => ({ label: b.date.slice(5), value: Number(b.weight) }));

  drawLineChartOnCanvas(canvas, points, '#3b82f6', 'kg');
}

function drawLineChartOnCanvas(canvas, points, colorHex, unitLabel) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  if (!points || points.length === 0) {
    ctx.fillStyle = '#6b7280';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Aún no hay datos suficientes para graficar', w / 2, h / 2);
    return;
  }

  const padL = 42, padR = 20, padT = 24, padB = 28;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const vals = points.map(p => p.value);
  let minV = Math.min(...vals);
  let maxV = Math.max(...vals);
  if (minV === maxV) {
    minV -= 5;
    maxV += 5;
  } else {
    const margin = (maxV - minV) * 0.15;
    minV = Math.max(0, minV - margin);
    maxV = maxV + margin;
  }

  // Líneas guía horizontales
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#9ca3af';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'right';

  for (let i = 0; i <= 3; i++) {
    const y = padT + (plotH / 3) * i;
    const val = maxV - ((maxV - minV) / 3) * i;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(w - padR, y);
    ctx.stroke();
    ctx.fillText(val.toFixed(0), padL - 6, y + 3);
  }

  // Coordenadas de puntos
  const coords = points.map((pt, idx) => {
    const x = points.length === 1 ? padL + plotW / 2 : padL + (idx / (points.length - 1)) * plotW;
    const y = padT + plotH - ((pt.value - minV) / (maxV - minV)) * plotH;
    return { x, y, ...pt };
  });

  // Área bajo la curva
  if (coords.length > 1) {
    const grad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
    grad.addColorStop(0, colorHex + '55');
    grad.addColorStop(1, colorHex + '00');
    ctx.beginPath();
    ctx.moveTo(coords[0].x, padT + plotH);
    coords.forEach(c => ctx.lineTo(c.x, c.y));
    ctx.lineTo(coords[coords.length - 1].x, padT + plotH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Línea principal
    ctx.beginPath();
    coords.forEach((c, i) => (i === 0 ? ctx.moveTo(c.x, c.y) : ctx.lineTo(c.x, c.y)));
    ctx.strokeStyle = colorHex;
    ctx.lineWidth = 2.8;
    ctx.stroke();
  }

  // Puntos y etiquetas
  ctx.textAlign = 'center';
  coords.forEach((c) => {
    ctx.beginPath();
    ctx.arc(c.x, c.y, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = colorHex;
    ctx.fill();

    ctx.fillStyle = '#f3f4f6';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText(`${c.value}`, c.x, c.y - 8);

    ctx.fillStyle = '#9ca3af';
    ctx.font = '9.5px sans-serif';
    ctx.fillText(c.label, c.x, h - 8);
  });
}

// Registro Corporal y Fotos de Progreso Físico
let pendingBodyPhotoBase64 = null;

function openBodyLogModal() {
  pendingBodyPhotoBase64 = null;
  const last = appData.bodyLogs[0] || {};
  openModal('⚖️ Registrar Peso, Medidas y Foto', `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Peso Corporal (kg)</label>
        <input type="number" step="0.1" id="bl-weight" class="form-control" value="${last.weight || 75}" />
      </div>
      <div class="form-group">
        <label class="form-label">% Grasa Corporal (opc.)</label>
        <input type="number" step="0.1" id="bl-fat" class="form-control" value="${last.bodyFat || ''}" placeholder="Ej: 15" />
      </div>
    </div>
    <div class="form-row-4" style="margin-bottom:12px;">
      <div>
        <label class="form-label">Cintura (cm)</label>
        <input type="number" id="bl-waist" class="form-control" value="${last.waist || ''}" />
      </div>
      <div>
        <label class="form-label">Pecho (cm)</label>
        <input type="number" id="bl-chest" class="form-control" value="${last.chest || ''}" />
      </div>
      <div>
        <label class="form-label">Brazo (cm)</label>
        <input type="number" id="bl-arms" class="form-control" value="${last.arms || ''}" />
      </div>
      <div>
        <label class="form-label">Pierna (cm)</label>
        <input type="number" id="bl-legs" class="form-control" value="${last.legs || ''}" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">📸 Foto de Progreso Físico (opcional, se guarda en tu celular)</label>
      <input type="file" accept="image/*" class="form-control" onchange="handleBodyProgressPhoto(event)" />
    </div>
    <div class="form-group">
      <label class="form-label">Notas</label>
      <input type="text" id="bl-notes" class="form-control" placeholder="Ej: En ayunas, post-descarga..." />
    </div>
    <button class="btn btn-primary btn-block" onclick="saveBodyLogEntry()">💾 Guardar Registro Corporal</button>
  `);
}

function handleBodyProgressPhoto(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxW = 500;
      const scale = Math.min(1, maxW / img.width);
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      pendingBodyPhotoBase64 = canvas.toDataURL('image/jpeg', 0.72);
      showToast('📸 Foto de progreso cargada.');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function saveBodyLogEntry() {
  const weight = Number(document.getElementById('bl-weight').value);
  if (!weight || weight <= 0) {
    showToast('Ingresa un peso válido.', '#ef4444');
    return;
  }

  appData.bodyLogs.unshift({
    id: 'bl_' + Date.now(),
    date: getTodayISO(),
    weight,
    bodyFat: document.getElementById('bl-fat').value,
    waist: document.getElementById('bl-waist').value,
    chest: document.getElementById('bl-chest').value,
    arms: document.getElementById('bl-arms').value,
    legs: document.getElementById('bl-legs').value,
    notes: document.getElementById('bl-notes').value.trim(),
    photo: pendingBodyPhotoBase64
  });

  saveAppData();
  closeModal();
  renderAllViews();
  showToast('⚖️ Registro corporal guardado.');
}

function renderBodyLogsList() {
  const container = document.getElementById('body-logs-list');
  if (!container) return;

  if (appData.bodyLogs.length === 0) {
    container.innerHTML = `<div style="font-size:12.5px; color:var(--text-muted); text-align:center; padding:12px;">Aún no hay registros corporales. Toca "➕ Registrar Hoy" arriba para llevar tu control de peso, medidas y fotos.</div>`;
    return;
  }

  container.innerHTML = appData.bodyLogs.map(b => `
    <div class="meal-item" style="align-items:flex-start;">
      <div style="display:flex; gap:10px; align-items:center;">
        ${b.photo ? `<img src="${b.photo}" style="width:54px; height:54px; object-fit:cover; border-radius:8px; border:1px solid var(--border); cursor:pointer;" onclick="viewBodyPhoto('${b.id}')" />` : ''}
        <div>
          <div class="meal-item-title">
            <strong>${b.weight} kg</strong>
            ${b.bodyFat ? `<span class="badge badge-blue">${b.bodyFat}% grasa</span>` : ''}
            <span style="font-size:11.5px; color:var(--text-muted);">• ${formatReadableDate(b.date)}</span>
          </div>
          <div class="meal-item-sub">
            ${b.waist ? `Cintura: ${b.waist}cm ` : ''}
            ${b.chest ? `• Pecho: ${b.chest}cm ` : ''}
            ${b.arms ? `• Brazo: ${b.arms}cm ` : ''}
            ${b.legs ? `• Pierna: ${b.legs}cm` : ''}
          </div>
          ${b.notes ? `<div style="font-size:11px; color:var(--text-dim);">${escapeHtml(b.notes)}</div>` : ''}
        </div>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="deleteBodyLog('${b.id}')">✕</button>
    </div>
  `).join('');
}

function viewBodyPhoto(id) {
  const b = appData.bodyLogs.find(item => item.id === id);
  if (!b || !b.photo) return;
  openModal(`Foto de Progreso (${b.date} • ${b.weight} kg)`, `<img src="${b.photo}" style="width:100%; border-radius:12px;" />`);
}

function deleteBodyLog(id) {
  appData.bodyLogs = appData.bodyLogs.filter(b => b.id !== id);
  saveAppData();
  renderAllViews();
}

// ============================================================================
// 5. AJUSTES, CALCULADORA TDEE, API KEY Y BACKUP JSON
// ============================================================================

function initSettingsInputs() {
  const s = appData.settings;
  document.getElementById('goal-kcal').value = s.kcalGoal || 2400;
  document.getElementById('goal-protein').value = s.proteinGoal || 160;
  document.getElementById('goal-carbs').value = s.carbsGoal || 260;
  document.getElementById('goal-fat').value = s.fatGoal || 70;
  document.getElementById('settings-gemini-key').value = s.geminiApiKey || '';

  if (s.tdeeProfile) {
    document.getElementById('tdee-sex').value = s.tdeeProfile.sex || 'M';
    document.getElementById('tdee-age').value = s.tdeeProfile.age || 25;
    document.getElementById('tdee-weight').value = s.tdeeProfile.weight || 75;
    document.getElementById('tdee-height').value = s.tdeeProfile.height || 175;
    document.getElementById('tdee-activity').value = s.tdeeProfile.activity || '1.55';
    document.getElementById('tdee-goal').value = s.tdeeProfile.goal || '300';
  }
}

function calculateAndApplyTDEE() {
  const sex = document.getElementById('tdee-sex').value;
  const age = Number(document.getElementById('tdee-age').value) || 25;
  const weight = Number(document.getElementById('tdee-weight').value) || 75;
  const height = Number(document.getElementById('tdee-height').value) || 175;
  const activity = Number(document.getElementById('tdee-activity').value) || 1.55;
  const goalDelta = Number(document.getElementById('tdee-goal').value) || 0;

  // Fórmula de Mifflin-St Jeor
  const bmr = sex === 'M'
    ? 10 * weight + 6.25 * height - 5 * age + 5
    : 10 * weight + 6.25 * height - 5 * age - 161;

  const tdee = Math.round(bmr * activity);
  const targetKcal = Math.max(1200, tdee + goalDelta);

  // Distribución óptima para gimnasio (2.1g proteína/kg, 0.9g grasa/kg, resto carbohidratos)
  const proteinG = Math.round(weight * 2.1);
  const fatG = Math.round(weight * 0.9);
  const remainingKcal = Math.max(200, targetKcal - (proteinG * 4 + fatG * 9));
  const carbsG = Math.round(remainingKcal / 4);

  document.getElementById('goal-kcal').value = targetKcal;
  document.getElementById('goal-protein').value = proteinG;
  document.getElementById('goal-carbs').value = carbsG;
  document.getElementById('goal-fat').value = fatG;

  appData.settings.tdeeProfile = { sex, age, weight, height, activity: String(activity), goal: String(goalDelta) };
  saveMacroGoals();
  showToast(`🎯 Calculado: ${targetKcal} kcal (${proteinG}g P / ${carbsG}g C / ${fatG}g G)`);
}

function saveMacroGoals() {
  appData.settings.kcalGoal = Number(document.getElementById('goal-kcal').value) || 2400;
  appData.settings.proteinGoal = Number(document.getElementById('goal-protein').value) || 160;
  appData.settings.carbsGoal = Number(document.getElementById('goal-carbs').value) || 260;
  appData.settings.fatGoal = Number(document.getElementById('goal-fat').value) || 70;
  saveAppData();
  renderAllViews();
  showToast('💾 Metas nutricionales actualizadas.');
}

function saveGeminiApiKey() {
  const key = document.getElementById('settings-gemini-key').value.trim();
  appData.settings.geminiApiKey = key;
  saveAppData();
  updateAIKeyStatusBadge();
  showToast(key ? '🔑 API Key de Gemini guardada en tu dispositivo.' : 'API Key eliminada.');
}

function exportBackupJSON() {
  const dataStr = JSON.stringify(appData, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `titan_gym_backup_${getTodayISO()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('⬇️ Copia de seguridad descargada.');
}

function importBackupJSON(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      if (imported && imported.exercises && imported.settings) {
        appData = imported;
        saveAppData();
        initSettingsInputs();
        renderAllViews();
        showToast('✅ Copia de seguridad restaurada con éxito.');
      } else {
        showToast('❌ El archivo no parece ser un backup válido de TITAN Gym.', '#ef4444');
      }
    } catch (err) {
      showToast('❌ Error al leer el archivo JSON.', '#ef4444');
    }
  };
  reader.readAsText(file);
}

function resetAllAppData() {
  if (!confirm('⚠️ ¿Estás completamente seguro de borrar TODOS tus entrenamientos, comidas y progreso? Esta acción no se puede deshacer.')) return;
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
