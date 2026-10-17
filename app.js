// ============================================================================
// YANBALLIN 🔵🔴 (BARÇA GYM, FITIA & YAZIO PRO) - Lógica Principal
// ============================================================================

const STORAGE_KEY = 'TITAN_GYM_APP_DATA_V1';

// Estado Global Persistente
let appData = {
  settings: {
    kcalGoal: 2400,
    proteinGoal: 160,
    carbsGoal: 260,
    fatGoal: 70,
    waterGoalMl: 2500,
    geminiApiKey: '',
    geminiModel: 'gemini-2.5-flash',
    tdeeProfile: {
      sex: 'M',
      age: 25,
      startWeight: 75,
      weight: 75,
      targetWeight: 70,
      height: 175,
      activity: '1.55',
      weeklyRate: '0.5'
    },
    reminders: {
      suppTime: '10:00',
      workoutTime: '18:30',
      waterInterval: false,
      lastNotifiedKey: ''
    }
  },
  exercises: [],
  routines: [],
  workouts: [],
  activeWorkout: null,
  prs: {},
  foods: [],
  recipes: [],
  supplements: [],
  fasting: {
    protocolHours: 16,
    isActive: false,
    startTime: null,
    notifiedGoal: false,
    history: []
  },
  nutritionByDate: {}, // { 'YYYY-MM-DD': { waterGlasses: 0, items: [], cardio: [], supplementsTaken: [] } }
  bodyLogs: []
};

// Variables de control en memoria
let currentTab = 'home';
let currentMuscleFilter = 'Todos';
let currentNutritionDate = getTodayISO();
let liveWorkoutInterval = null;
let restTimerInterval = null;
let fastingTimerInterval = null;
let reminderInterval = null;
let restTimerRemaining = 0;
let html5QrScanner = null;
let currentPhotoBase64 = null;
let aiDetectedItems = [];
let aiPortionScale = 1.0;
let deferredPwaPrompt = null;
let defaultSlotForNextFood = 'Almuerzo';

const MEAL_SLOTS = [
  { key: 'Desayuno', icon: '🌅', title: 'Desayuno' },
  { key: 'Snack Mañana', icon: '🥪', title: 'Snack Mañana' },
  { key: 'Almuerzo', icon: '☀️', title: 'Almuerzo' },
  { key: 'Snack Tarde', icon: '🍌', title: 'Snack Tarde / Pre-Entreno' },
  { key: 'Cena', icon: '🌙', title: 'Cena' },
  { key: 'Snack Noche', icon: '🥤', title: 'Snack Noche / Post-Entreno' }
];

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

function getDateISOOffset(daysOffset) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
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

function formatHMS(sec) {
  const s = Math.max(0, Math.floor(sec));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

function showToast(msg, color = '#EDBB00') {
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
  }, 3400);
}

function playSound(type = 'beep') {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (type === 'barca_chant') {
      // Melodía "¡Bar-ça! ¡Bar-ça! ¡Baaar-ça!" (Cant del Barça)
      const notes = [
        { freq: 523.25, start: 0.0, dur: 0.16 },  // Bar-
        { freq: 659.25, start: 0.18, dur: 0.22 }, // -ça!
        { freq: 523.25, start: 0.48, dur: 0.16 }, // Bar-
        { freq: 659.25, start: 0.66, dur: 0.22 }, // -ça!
        { freq: 783.99, start: 0.98, dur: 0.35 }, // ¡Baaar-
        { freq: 659.25, start: 1.36, dur: 0.35 }  // -ça!
      ];
      notes.forEach(n => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(n.freq, ctx.currentTime + n.start);
        g.gain.setValueAtTime(0.28, ctx.currentTime + n.start);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + n.start + n.dur);
        o.connect(g);
        g.connect(ctx.destination);
        o.start(ctx.currentTime + n.start);
        o.stop(ctx.currentTime + n.start + n.dur);
      });
      if (navigator.vibrate) navigator.vibrate([100, 60, 100, 60, 220]);
      return;
    }

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
  } catch (e) {}
}

const BARCA_CULE_QUOTES = [
  '🔵🔴 "¡Salid y disfrutad en YANBALLIN!" — Johan Cruyff • ¡A romperla hoy en el entreno!',
  '🏆 "YANBALLIN: Més que un Club, Més que un Gym" • ¡Disciplina de La Masia en cada serie y comida!',
  '🦁 "No tenemos sueños baratos. Entrenamos al 100% hasta el minuto 90." — ADN Capitán Puyol',
  '⚽ "¡Barça! ¡Barça! ¡Baaarça! 🔵🔴" • ¡Modo YANBALLIN con presión alta estilo Hansi Flick!',
  '🐐 "El talento gana partidos, pero la constancia diaria gana Balones de Oro." — Espíritu Culé',
  '🌟 "¡Força YANBALLIN! Cada gramo de proteína y cada repetición cuentan para el título."'
];
let barcaQuoteIdx = 0;

function launchBlaugranaConfetti(pieces = 34) {
  const colors = ['#004D98', '#A50044', '#EDBB00', '#DB0030', '#0066cc'];
  for (let i = 0; i < pieces; i++) {
    const piece = document.createElement('div');
    piece.className = 'blaugrana-confetti';
    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.background = colors[i % colors.length];
    piece.style.width = `${7 + Math.random() * 7}px`;
    piece.style.height = `${11 + Math.random() * 9}px`;
    piece.style.animationDuration = `${1.8 + Math.random() * 1.4}s`;
    piece.style.animationDelay = `${Math.random() * 0.25}s`;
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 3300);
  }
}

function triggerBarcaCrestInteraction() {
  playSound('barca_chant');
  launchBlaugranaConfetti(38);
  const quote = BARCA_CULE_QUOTES[barcaQuoteIdx % BARCA_CULE_QUOTES.length];
  barcaQuoteIdx++;
  showToast(quote, '#EDBB00');
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
        settings: {
          ...appData.settings,
          ...(parsed.settings || {}),
          tdeeProfile: { ...appData.settings.tdeeProfile, ...(parsed.settings?.tdeeProfile || {}) },
          reminders: { ...appData.settings.reminders, ...(parsed.settings?.reminders || {}) }
        },
        fasting: { ...appData.fasting, ...(parsed.fasting || {}) }
      };
    }
  } catch (e) {
    console.error('Error cargando datos locales:', e);
  }

  if (!appData.exercises || appData.exercises.length === 0) {
    appData.exercises = JSON.parse(JSON.stringify(DEFAULT_EXERCISES));
  }
  if (!appData.routines || appData.routines.length === 0) {
    appData.routines = JSON.parse(JSON.stringify(DEFAULT_ROUTINES));
  } else {
    // Actualizar colores y nombres de las rutinas por defecto al tema FC Barcelona Blaugrana
    DEFAULT_ROUTINES.forEach(defRt => {
      const existingRt = appData.routines.find(r => r.id === defRt.id);
      if (existingRt) {
        existingRt.color = defRt.color;
        existingRt.name = defRt.name;
        existingRt.tag = defRt.tag;
      }
    });
  }
  if (!appData.foods || appData.foods.length === 0) {
    appData.foods = JSON.parse(JSON.stringify(DEFAULT_FOODS));
  } else {
    // Asegurar que nuevos alimentos como Pan de Masa Madre estén presentes
    DEFAULT_FOODS.forEach(df => {
      if (!appData.foods.some(f => f.id === df.id || f.name === df.name)) {
        appData.foods.push(JSON.parse(JSON.stringify(df)));
      }
    });
  }
  if (!appData.recipes || appData.recipes.length === 0) {
    appData.recipes = JSON.parse(JSON.stringify(DEFAULT_RECIPES));
  }
  if (!appData.supplements || appData.supplements.length === 0) {
    appData.supplements = JSON.parse(JSON.stringify(DEFAULT_SUPPLEMENTS));
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

  const headerDate = document.getElementById('header-date-label');
  if (headerDate) {
    const dateTxt = new Date().toLocaleDateString('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long'
    });
    headerDate.textContent = `Més que un Gym • ${dateTxt}`;
  }

  const nutPicker = document.getElementById('nutrition-date-picker');
  if (nutPicker) nutPicker.value = currentNutritionDate;

  initSettingsInputs();
  renderAllViews();

  if (appData.activeWorkout) {
    startLiveWorkoutClock();
  }
  startFastingTicker();
  startRemindersScheduler();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});

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
  renderStreakAndGoals();
  renderHomeDashboard();
  renderWorkoutView();
  renderNutritionView();
  renderProgressView();
  updateAIKeyStatusBadge();
}

// ============================================================================
// SISTEMA DE RACHAS (STREAKS) Y OBJETIVOS DIARIOS
// ============================================================================

function getDayNutrition(dateStr) {
  if (!appData.nutritionByDate[dateStr]) {
    appData.nutritionByDate[dateStr] = {
      waterGlasses: 0,
      items: [],
      cardio: [],
      supplementsTaken: []
    };
  }
  const d = appData.nutritionByDate[dateStr];
  if (!d.cardio) d.cardio = [];
  if (!d.supplementsTaken) d.supplementsTaken = [];
  if (!d.items) d.items = [];
  return d;
}

function calculateDayTotals(dateStr) {
  const day = getDayNutrition(dateStr);
  const foodTotals = day.items.reduce(
    (acc, item) => {
      acc.kcal += Number(item.kcal) || 0;
      acc.protein += Number(item.protein) || 0;
      acc.carbs += Number(item.carbs) || 0;
      acc.fat += Number(item.fat) || 0;
      return acc;
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );
  const cardioBurned = (day.cardio || []).reduce((sum, c) => sum + (Number(c.kcalBurned) || 0), 0);
  return { ...foodTotals, cardioBurned };
}

function evaluateDayHabits(dateStr) {
  const day = getDayNutrition(dateStr);
  const totals = calculateDayTotals(dateStr);
  const g = appData.settings;

  const hasFoodLogged = day.items.length > 0 && totals.kcal >= 800;
  const hasWorkoutOrCardio =
    appData.workouts.some(w => w.date === dateStr) ||
    (day.cardio && day.cardio.length > 0);
  const waterGoalGlasses = Math.max(6, Math.round((g.waterGoalMl || 2500) / 250));
  const hasWaterGoal = (day.waterGlasses || 0) >= Math.ceil(waterGoalGlasses * 0.75);
  const hasSupplements =
    appData.supplements.length > 0 &&
    (day.supplementsTaken || []).length >= Math.min(2, appData.supplements.length);

  const count = [hasFoodLogged, hasWorkoutOrCardio, hasWaterGoal, hasSupplements].filter(Boolean).length;
  return {
    hasFoodLogged,
    hasWorkoutOrCardio,
    hasWaterGoal,
    hasSupplements,
    completedCount: count,
    isStreakDay: count >= 2 || day.items.length > 0 || hasWorkoutOrCardio
  };
}

function calculateCurrentStreak() {
  let streak = 0;
  const todayStr = getTodayISO();
  const todayEval = evaluateDayHabits(todayStr);
  if (todayEval.isStreakDay) {
    streak++;
  }

  for (let i = 1; i <= 365; i++) {
    const dStr = getDateISOOffset(-i);
    const ev = evaluateDayHabits(dStr);
    if (ev.isStreakDay) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

function renderStreakAndGoals() {
  const streak = calculateCurrentStreak();
  const streakEl = document.getElementById('header-streak-count');
  if (streakEl) streakEl.textContent = streak;

  const today = getTodayISO();
  const ev = evaluateDayHabits(today);
  const badgeEl = document.getElementById('home-goals-progress-badge');
  if (badgeEl) badgeEl.textContent = `${ev.completedCount} / 4 cumplidos`;

  const habitsListEl = document.getElementById('home-daily-habits-list');
  if (!habitsListEl) return;

  const habits = [
    {
      done: ev.hasFoodLogged,
      icon: '🍽️',
      title: 'Registrar mis comidas del día',
      sub: 'Mantener control calórico y de proteína',
      action: () => switchTab('nutrition')
    },
    {
      done: ev.hasWorkoutOrCardio,
      icon: '🏋️',
      title: 'Entrenar pesas o hacer Cardio hoy',
      sub: 'Sesión de fuerza o actividad cardiovascular',
      action: () => switchTab('workout')
    },
    {
      done: ev.hasWaterGoal,
      icon: '💧',
      title: 'Meta de hidratación diaria',
      sub: 'Beber al menos el 75% de tus vasos de agua',
      action: () => window.scrollTo({ top: 450, behavior: 'smooth' })
    },
    {
      done: ev.hasSupplements,
      icon: '💊',
      title: 'Tomar mis suplementos (Creatina / Stack)',
      sub: 'Marcar tus suplementos diarios como tomados',
      action: () => openQuickNutritionMode('supplements')
    }
  ];

  habitsListEl.innerHTML = habits.map((h, i) => `
    <div class="habit-check-row ${h.done ? 'done' : ''}" id="habit-row-${i}">
      <div style="display:flex; align-items:center; gap:10px;">
        <span style="font-size:18px;">${h.icon}</span>
        <div>
          <div style="font-weight:700; font-size:13px;">${h.title}</div>
          <div style="font-size:11px; color:var(--text-muted);">${h.sub}</div>
        </div>
      </div>
      <span class="badge ${h.done ? 'badge-accent' : ''}">${h.done ? '✓ Listo' : 'Ir ➔'}</span>
    </div>
  `).join('');

  habits.forEach((h, i) => {
    const row = document.getElementById(`habit-row-${i}`);
    if (row) row.onclick = h.action;
  });
}

function getBarcaPlayerRank(streak) {
  if (streak >= 30) return { title: '🐐 Leyenda D10S • Balón de Oro', sub: 'Nivel Messi en el Camp Nou: constancia histórica' };
  if (streak >= 14) return { title: '🎩 Maestro Xavi & Iniesta', sub: 'Control total del juego, la nutrición y el gimnasio' };
  if (streak >= 7) return { title: '🦁 Capitán Carles Puyol', sub: 'Hierro puro, disciplina inquebrantable toda la semana' };
  if (streak >= 3) return { title: '⭐ Titular de Hansi Flick', sub: 'Presión alta y rendimiento de primer equipo' };
  if (streak >= 1) return { title: '⚽ Debutante en el Camp Nou', sub: 'Ya sumaste tus primeros minutos con la camiseta Blaugrana' };
  return { title: '🌱 Canterano de La Masia', sub: 'Cumple hoy tus objetivos para debutar en el Primer Equipo' };
}

function openStreakModal() {
  const streak = calculateCurrentStreak();
  const ev = evaluateDayHabits(getTodayISO());
  const rank = getBarcaPlayerRank(streak);

  openModal('🔵🔴 Tu Racha y Rango en el Barça', `
    <div style="text-align:center; padding:10px 0;">
      <div style="font-size:44px;">🏆</div>
      <div style="font-size:26px; font-weight:900; color:var(--gold);">${streak} ${streak === 1 ? 'Partido' : 'Partidos'} (Días) en Racha</div>
      <div style="margin-top:6px; display:inline-block; padding:5px 12px; border-radius:99px; background:linear-gradient(135deg, #004D98, #A50044); border:1px solid var(--gold); font-weight:800; font-size:13px; color:#fff;">
        ${rank.title}
      </div>
      <p style="font-size:12px; color:var(--text-muted); margin-top:6px;">
        ${rank.sub}
      </p>
    </div>
    <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:8px; text-align:center; margin:12px 0;">
      <div style="background:var(--bg-input); padding:10px 4px; border-radius:10px; border:1px solid ${streak >= 3 ? 'var(--gold)' : 'var(--border)'};">
        <div style="font-size:18px;">⭐</div>
        <div style="font-size:10.5px; font-weight:800;">3 Días</div>
        <div style="font-size:9.5px; color:var(--text-muted);">Titular</div>
      </div>
      <div style="background:var(--bg-input); padding:10px 4px; border-radius:10px; border:1px solid ${streak >= 7 ? 'var(--gold)' : 'var(--border)'};">
        <div style="font-size:18px;">🦁</div>
        <div style="font-size:10.5px; font-weight:800;">7 Días</div>
        <div style="font-size:9.5px; color:var(--text-muted);">Puyol</div>
      </div>
      <div style="background:var(--bg-input); padding:10px 4px; border-radius:10px; border:1px solid ${streak >= 14 ? 'var(--gold)' : 'var(--border)'};">
        <div style="font-size:18px;">🎩</div>
        <div style="font-size:10.5px; font-weight:800;">14 Días</div>
        <div style="font-size:9.5px; color:var(--text-muted);">Iniesta</div>
      </div>
      <div style="background:var(--bg-input); padding:10px 4px; border-radius:10px; border:1px solid ${streak >= 30 ? 'var(--gold)' : 'var(--border)'};">
        <div style="font-size:18px;">🐐</div>
        <div style="font-size:10.5px; font-weight:800;">30 Días</div>
        <div style="font-size:9.5px; color:var(--text-muted);">D10S</div>
      </div>
    </div>
    <div style="font-size:12.5px; text-align:center; color:var(--gold); font-weight:700; margin-bottom:12px;">
      Hoy llevas ${ev.completedCount} de 4 objetivos de La Masia completados.
    </div>
    <div style="display:flex; flex-direction:column; gap:8px;">
      <button class="btn btn-secondary btn-block" onclick="triggerBarcaCrestInteraction()">
        🎺 ¡Sonar Himno y Confeti Blaugrana!
      </button>
      <button class="btn btn-primary btn-block" onclick="closeModal()">¡Força Barça! 🔵🔴</button>
    </div>
  `);
}

// ============================================================================
// 1. DASHBOARD / INICIO
// ============================================================================

function renderHomeDashboard() {
  const today = getTodayISO();
  const totals = calculateDayTotals(today);
  const g = appData.settings;

  const banner = document.getElementById('home-live-workout-banner');
  if (appData.activeWorkout) {
    banner.style.display = 'flex';
    document.getElementById('home-live-workout-name').textContent = appData.activeWorkout.name;
  } else {
    banner.style.display = 'none';
  }

  // Balance estilo Fitia/Yazio: Meta + Cardio - Consumidas
  const effectiveBudget = g.kcalGoal + totals.cardioBurned;
  const remaining = Math.round(effectiveBudget - totals.kcal);

  document.getElementById('home-kcal-consumed').textContent = Math.round(totals.kcal);
  document.getElementById('home-kcal-burned').textContent = `+${Math.round(totals.cardioBurned)}`;
  document.getElementById('home-kcal-goal').textContent = g.kcalGoal;

  const remEl = document.getElementById('home-kcal-remaining');
  const remLbl = document.getElementById('home-kcal-rem-label');
  if (remaining >= 0) {
    remEl.textContent = remaining;
    remLbl.textContent = 'Disponibles';
  } else {
    remEl.textContent = `+${Math.abs(remaining)}`;
    remLbl.textContent = 'Excedidas';
  }

  const pctKcal = Math.min(1, totals.kcal / Math.max(1, effectiveBudget));
  const circumference = 289;
  const offset = circumference - pctKcal * circumference;
  const ring = document.getElementById('home-kcal-ring');
  if (ring) {
    ring.style.strokeDashoffset = offset;
    ring.style.stroke = totals.kcal > effectiveBudget * 1.05 ? '#ef4444' : 'url(#barcaRingGrad)';
  }

  // Barras de macros
  document.getElementById('home-macro-p-txt').textContent = `${Math.round(totals.protein)} / ${g.proteinGoal}g`;
  document.getElementById('home-macro-c-txt').textContent = `${Math.round(totals.carbs)} / ${g.carbsGoal}g`;
  document.getElementById('home-macro-f-txt').textContent = `${Math.round(totals.fat)} / ${g.fatGoal}g`;

  document.getElementById('home-macro-p-bar').style.width = `${Math.min(100, (totals.protein / Math.max(1, g.proteinGoal)) * 100)}%`;
  document.getElementById('home-macro-c-bar').style.width = `${Math.min(100, (totals.carbs / Math.max(1, g.carbsGoal)) * 100)}%`;
  document.getElementById('home-macro-f-bar').style.width = `${Math.min(100, (totals.fat / Math.max(1, g.fatGoal)) * 100)}%`;

  // Suplementos rápidos en Inicio
  renderSupplementsWidgets();

  // Vasos de agua
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
      renderAllViews();
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
// 2. ENTRENAMIENTO, CARDIO, RUTINAS, EJERCICIOS Y TEMPORIZADOR
// ============================================================================

function getExerciseById(exId) {
  return appData.exercises.find(e => e.id === exId);
}

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
  ['routines', 'cardio', 'exercises', 'history'].forEach(k => {
    const el = document.getElementById(`workout-sub-${k}`);
    const tab = document.getElementById(`wtab-${k}`);
    if (el) el.style.display = k === sub ? 'block' : 'none';
    if (tab) tab.classList.toggle('active', k === sub);
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
    renderCardioTodayList();
    renderExerciseLibrary();
    renderWorkoutHistory();
  }
}

// Registro de Cardio estilo Fitia / Yazio
function openCardioModal() {
  const opts = DEFAULT_CARDIO_ACTIVITIES.map(c =>
    `<option value="${c.id}" data-met="${c.met}">${escapeHtml(c.name)}</option>`
  ).join('');

  openModal('🏃 Registrar Actividad de Cardio', `
    <div class="form-group">
      <label class="form-label">Selecciona el ejercicio cardiovascular o deporte</label>
      <select id="cardio-type-select" class="form-control" onchange="updateCardioKcalEstimate()">
        ${opts}
        <option value="custom" data-met="7.0">✨ Otra actividad personalizada...</option>
      </select>
    </div>
    <div class="form-group" id="cardio-custom-name-group" style="display:none;">
      <label class="form-label">Nombre de la actividad</label>
      <input type="text" id="cardio-custom-name" class="form-control" placeholder="Ej: Pádel / Tenis / Senderismo" />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Duración (minutos)</label>
        <input type="number" id="cardio-minutes" class="form-control" value="30" oninput="updateCardioKcalEstimate()" />
      </div>
      <div class="form-group">
        <label class="form-label">Calorías Quemadas (kcal)</label>
        <input type="number" id="cardio-kcal" class="form-control" value="280" />
      </div>
    </div>
    <p style="font-size:11.5px; color:var(--text-muted); margin-bottom:12px;">
      💡 Calculado automáticamente según tu peso corporal (${appData.settings.tdeeProfile?.weight || 75} kg). Si tu reloj o máquina marcó otro número de calorías, puedes editarlo directamente arriba.
    </p>
    <button class="btn btn-primary btn-block" onclick="saveCardioSession()">✅ Guardar Cardio y Sumar Kcal</button>
  `);
  updateCardioKcalEstimate();
}

function updateCardioKcalEstimate() {
  const sel = document.getElementById('cardio-type-select');
  if (!sel) return;
  const isCustom = sel.value === 'custom';
  const customGroup = document.getElementById('cardio-custom-name-group');
  if (customGroup) customGroup.style.display = isCustom ? 'block' : 'none';

  const opt = sel.options[sel.selectedIndex];
  const met = Number(opt?.getAttribute('data-met')) || 7.0;
  const mins = Number(document.getElementById('cardio-minutes')?.value) || 0;
  const userWeight = Number(appData.bodyLogs[0]?.weight || appData.settings.tdeeProfile?.weight || 75);

  // Fórmula estándar ACSM: Kcal = MET * 3.5 * pesoKg / 200 * minutos
  const estKcal = Math.round((met * 3.5 * userWeight / 200) * mins);
  const kcalInput = document.getElementById('cardio-kcal');
  if (kcalInput) kcalInput.value = estKcal;
}

function saveCardioSession() {
  const sel = document.getElementById('cardio-type-select');
  const mins = Number(document.getElementById('cardio-minutes')?.value) || 0;
  const kcalBurned = Number(document.getElementById('cardio-kcal')?.value) || 0;
  if (mins <= 0 || kcalBurned <= 0) {
    showToast('Ingresa minutos y calorías válidas.', '#ef4444');
    return;
  }

  let name = '';
  if (sel.value === 'custom') {
    name = document.getElementById('cardio-custom-name')?.value.trim() || '🏃 Cardio Personalizado';
  } else {
    const found = DEFAULT_CARDIO_ACTIVITIES.find(c => c.id === sel.value);
    name = found ? found.name : '🏃 Cardio';
  }

  const day = getDayNutrition(currentNutritionDate);
  day.cardio.push({
    id: 'cd_log_' + Date.now(),
    name,
    minutes: mins,
    kcalBurned: Math.round(kcalBurned)
  });

  saveAppData();
  closeModal();
  renderAllViews();
  playSound('pr');
  showToast(`🔥 ¡+${Math.round(kcalBurned)} kcal quemadas registradas!`);
}

function deleteCardioSession(dateStr, cardioId) {
  const day = getDayNutrition(dateStr);
  day.cardio = (day.cardio || []).filter(c => c.id !== cardioId);
  saveAppData();
  renderAllViews();
}

function renderCardioTodayList() {
  const container = document.getElementById('workout-cardio-today-list');
  if (!container) return;
  const today = getTodayISO();
  const day = getDayNutrition(today);

  if (!day.cardio || day.cardio.length === 0) {
    container.innerHTML = `<div class="card" style="text-align:center; color:var(--text-muted); font-size:12.5px;">Aún no has registrado cardio hoy.</div>`;
    return;
  }

  container.innerHTML = day.cardio.map(c => `
    <div class="card" style="padding:12px; margin-bottom:8px;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-weight:800; font-size:14px;">${escapeHtml(c.name)}</div>
          <div style="font-size:11.5px; color:var(--text-muted);">⏱️ ${c.minutes} minutos • 🔥 +${c.kcalBurned} kcal quemadas</div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="deleteCardioSession('${today}', '${c.id}')">✕</button>
      </div>
    </div>
  `).join('');
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
  set.type = order[(order.indexOf(set.type) + 1) % order.length];
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
        launchBlaugranaConfetti(22);
        showToast(`🏆 ¡GOLAZO / NUEVO PR en ${exName}! (${w}kg × ${r} reps) 🔵🔴`, '#EDBB00');
      } else {
        playSound('beep');
      }
    } else {
      playSound('beep');
    }
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
  playSound('barca_chant');
  launchBlaugranaConfetti(42);
  showToast(`🏆 ¡Victoria en el Camp Nou! Entreno guardado • Volumen: ${Math.round(totalVolume)} kg 🔵🔴`, '#EDBB00');
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
      showToast('⏱️ ¡Tiempo de descanso terminado! A darle a la siguiente serie 🔵🔴');
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

  openModal('Convocar Ejercicio a la Sesión', `
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
    sets: [1, 2, 3].map(() => ({
      type: '1',
      weight: prev ? prev.weight : '',
      reps: prev ? prev.reps : 10,
      prevText: prev ? `${prev.weight}kg × ${prev.reps}` : '8-12',
      completed: false,
      isPR: false
    }))
  });
  saveAppData();
  closeModal();
  renderLiveWorkoutSession();
}

function openNewExerciseModal() {
  openModal('Crear Nuevo Ejercicio en La Masia', `
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
  appData.exercises.unshift({
    id: 'ex_custom_' + Date.now(),
    name,
    muscle: document.getElementById('new-ex-muscle').value,
    equipment: document.getElementById('new-ex-equip').value,
    notes: document.getElementById('new-ex-notes').value.trim()
  });
  saveAppData();
  closeModal();
  renderExerciseLibrary();
  showToast('✅ Ejercicio agregado a La Masia.');
}

let tempRoutineExercises = [];
let editingRoutineId = null;

function openRoutineModal(routineId = null) {
  editingRoutineId = routineId;
  const existing = routineId ? appData.routines.find(r => r.id === routineId) : null;
  tempRoutineExercises = existing
    ? JSON.parse(JSON.stringify(existing.exercises))
    : [{ exerciseId: appData.exercises[0].id, targetSets: 3, targetReps: '8-10', restSeconds: 90 }];

  const exOptions = appData.exercises.map(e => `<option value="${e.id}">${escapeHtml(e.name)} (${e.muscle})</option>`).join('');

  openModal(existing ? 'Editar Táctica / Rutina' : 'Crear Nueva Táctica Blaugrana', `
    <div class="form-group">
      <label class="form-label">Nombre de la Rutina</label>
      <input type="text" id="rt-modal-name" class="form-control" value="${existing ? escapeHtml(existing.name) : ''}" placeholder="Ej: Día de Pecho y Espalda Camp Nou" />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Etiqueta / Enfoque</label>
        <input type="text" id="rt-modal-tag" class="form-control" value="${existing ? escapeHtml(existing.tag || '') : '🔵🔴 Hipertrofia Culé'}" />
      </div>
      <div class="form-group">
        <label class="form-label">Color Blaugrana / Oro</label>
        <input type="color" id="rt-modal-color" class="form-control" style="height:40px; padding:4px;" value="${existing ? (existing.color || '#A50044') : '#A50044'}" />
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

function openPlateCalcModal(initialWeight = 100) {
  openModal('⚽ Calculadora de Discos Blaugrana (Barra)', `
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
    <div id="plate-breakdown-text" style="text-align:center; font-size:13.5px; font-weight:700; color:var(--gold);"></div>
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
  // Discos Olímpicos con colores FC Barcelona (Grana, Blau, Oro Barça, Rojo Senyera)
  const availablePlates = [
    { w: 25, color: '#A50044', h: 92 },
    { w: 20, color: '#004D98', h: 88 },
    { w: 15, color: '#EDBB00', h: 78, textColor: '#090d1a' },
    { w: 10, color: '#DB0030', h: 68 },
    { w: 5, color: '#f8fafc', h: 56, textColor: '#090d1a' },
    { w: 2.5, color: '#1e3a8a', h: 46 },
    { w: 1.25, color: '#EDBB00', h: 38, textColor: '#090d1a' }
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
// 3. NUTRICIÓN, DIARIO DE 6 COMIDAS, IA EDITABLE, RECETAS, AYUNO Y SUPLEMENTOS
// ============================================================================

function switchNutritionSubtab(sub) {
  ['diary', 'ai', 'recipes', 'fasting', 'supplements', 'barcode', 'search'].forEach(k => {
    const el = document.getElementById(`nut-sub-${k}`);
    const tab = document.getElementById(`ntab-${k}`);
    if (el) el.style.display = k === sub ? 'block' : 'none';
    if (tab) tab.classList.toggle('active', k === sub);
  });
  if (sub !== 'barcode') {
    stopBarcodeScanner();
  }
  if (sub === 'search') renderFoodDatabaseList();
  if (sub === 'recipes') renderRecipesList();
  if (sub === 'supplements') renderSupplementsWidgets();
  if (sub === 'fasting') renderFastingView();
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
  const effectiveBudget = g.kcalGoal + totals.cardioBurned;

  document.getElementById('nut-kcal-in').textContent = Math.round(totals.kcal);
  document.getElementById('nut-kcal-target').textContent = effectiveBudget;
  const cardioLine = document.getElementById('nut-cardio-burned-line');
  if (cardioLine) {
    cardioLine.textContent = `🏃 Cardio registrado: +${Math.round(totals.cardioBurned)} kcal quemadas (Meta base: ${g.kcalGoal})`;
  }

  const left = effectiveBudget - Math.round(totals.kcal);
  const leftEl = document.getElementById('nut-kcal-left');
  leftEl.textContent = left >= 0 ? `${left} kcal` : `+${Math.abs(left)} kcal`;
  leftEl.style.color = left >= 0 ? 'var(--accent)' : 'var(--amber)';

  document.getElementById('nut-p-val').textContent = `${Math.round(totals.protein)} / ${g.proteinGoal}g`;
  document.getElementById('nut-c-val').textContent = `${Math.round(totals.carbs)} / ${g.carbsGoal}g`;
  document.getElementById('nut-f-val').textContent = `${Math.round(totals.fat)} / ${g.fatGoal}g`;

  renderMealsDiary();
  renderFoodDatabaseList();
  renderRecipesList();
  renderSupplementsWidgets();
  renderFastingView();
}

function renderMealsDiary() {
  const container = document.getElementById('meals-diary-container');
  if (!container) return;

  const day = getDayNutrition(currentNutritionDate);

  // Compatibilidad con items que tenían slot 'Snacks' antiguo
  day.items.forEach(it => {
    if (it.slot === 'Snacks') it.slot = 'Snack Tarde';
  });

  const mealsHtml = MEAL_SLOTS.map(slot => {
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
            <div style="display:flex; align-items:center; gap:6px;">
              <strong style="font-size:13px; color:var(--accent);">${Math.round(item.kcal)} kcal</strong>
              <button class="btn btn-ghost btn-sm" style="padding:3px 6px;" onclick="openEditDiaryItemModal('${item.id}')" title="Editar gramos o cambiar alimento">✏️</button>
              <button class="btn btn-ghost btn-sm" style="padding:3px 6px;" onclick="deleteDiaryFoodItem('${item.id}')">✕</button>
            </div>
          </div>
        `).join('');

    return `
      <div class="card">
        <div class="card-header" style="margin-bottom:8px;">
          <div class="card-title">${slot.icon} ${slot.title}</div>
          <div style="display:flex; align-items:center; gap:6px;">
            <span class="badge badge-accent">${Math.round(slotKcal)} kcal</span>
            <button class="btn btn-secondary btn-sm" onclick="quickAddForSlot('${slot.key}', 'search')" title="Buscar alimento">➕ Alimento</button>
            <button class="btn btn-ghost btn-sm" onclick="quickAddForSlot('${slot.key}', 'recipes')" title="Agregar receta">👨‍🍳</button>
          </div>
        </div>
        ${itemsHtml}
      </div>
    `;
  }).join('');

  // Tarjeta de Cardio del Día en el Diario
  const cardioItems = day.cardio || [];
  const cardioHtml = `
    <div class="card" style="border-color: rgba(16,185,129,0.35);">
      <div class="card-header" style="margin-bottom:8px;">
        <div class="card-title">🏃 Cardio y Ejercicio Quemado</div>
        <button class="btn btn-primary btn-sm" onclick="openCardioModal()">➕ Cardio</button>
      </div>
      ${cardioItems.length === 0
        ? `<div style="font-size:12px; color:var(--text-dim);">No hay sesiones de cardio registradas en esta fecha.</div>`
        : cardioItems.map(c => `
          <div class="meal-item">
            <div>
              <div class="meal-item-title">${escapeHtml(c.name)}</div>
              <div class="meal-item-sub">Duración: ${c.minutes} min</div>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <strong style="color:#34d399;">+${c.kcalBurned} kcal</strong>
              <button class="btn btn-ghost btn-sm" style="padding:3px 6px;" onclick="deleteCardioSession('${currentNutritionDate}', '${c.id}')">✕</button>
            </div>
          </div>
        `).join('')}
    </div>
  `;

  container.innerHTML = mealsHtml + cardioHtml;
}

function quickAddForSlot(slotKey, targetSubtab) {
  defaultSlotForNextFood = slotKey;
  const aiSlotSel = document.getElementById('ai-meal-slot');
  if (aiSlotSel) aiSlotSel.value = slotKey;
  switchNutritionSubtab(targetSubtab);
}

function addFoodItemToDiary(itemObj) {
  const day = getDayNutrition(currentNutritionDate);
  day.items.push({
    id: 'meal_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    slot: itemObj.slot || defaultSlotForNextFood || 'Almuerzo',
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

function openEditDiaryItemModal(itemId) {
  const day = getDayNutrition(currentNutritionDate);
  const item = day.items.find(i => i.id === itemId);
  if (!item) return;

  const baseG = Math.max(1, Number(item.grams) || 100);
  const kcalPerG = item.kcal / baseG;
  const pPerG = item.protein / baseG;
  const cPerG = item.carbs / baseG;
  const fPerG = item.fat / baseG;

  openModal('✏️ Editar Alimento Registrado', `
    <div class="form-group">
      <label class="form-label">Nombre del Alimento</label>
      <input type="text" id="edit-diary-name" class="form-control" value="${escapeHtml(item.name)}" />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Peso / Cantidad (gramos)</label>
        <input type="number" id="edit-diary-grams" class="form-control" value="${item.grams}"
          oninput="
            const ng = Number(this.value)||0;
            document.getElementById('edit-diary-kcal').value = Math.round(ng * ${kcalPerG});
            document.getElementById('edit-diary-p').value = (ng * ${pPerG}).toFixed(1);
            document.getElementById('edit-diary-c').value = (ng * ${cPerG}).toFixed(1);
            document.getElementById('edit-diary-f').value = (ng * ${fPerG}).toFixed(1);
          " />
      </div>
      <div class="form-group">
        <label class="form-label">Comida</label>
        <select id="edit-diary-slot" class="form-control">
          ${MEAL_SLOTS.map(s => `<option value="${s.key}" ${item.slot === s.key ? 'selected' : ''}>${s.icon} ${s.title}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-row-4" style="margin-bottom:14px;">
      <div>
        <label class="form-label">Kcal</label>
        <input type="number" id="edit-diary-kcal" class="form-control" value="${Math.round(item.kcal)}" />
      </div>
      <div>
        <label class="form-label">Prot (g)</label>
        <input type="number" step="0.1" id="edit-diary-p" class="form-control" value="${item.protein}" />
      </div>
      <div>
        <label class="form-label">Carb (g)</label>
        <input type="number" step="0.1" id="edit-diary-c" class="form-control" value="${item.carbs}" />
      </div>
      <div>
        <label class="form-label">Grasa (g)</label>
        <input type="number" step="0.1" id="edit-diary-f" class="form-control" value="${item.fat}" />
      </div>
    </div>
    <button class="btn btn-primary btn-block" onclick="saveEditedDiaryItem('${item.id}')">💾 Guardar Cambios</button>
  `);
}

function saveEditedDiaryItem(itemId) {
  const day = getDayNutrition(currentNutritionDate);
  const item = day.items.find(i => i.id === itemId);
  if (!item) return;

  item.name = document.getElementById('edit-diary-name').value.trim() || item.name;
  item.grams = Number(document.getElementById('edit-diary-grams').value) || 100;
  item.slot = document.getElementById('edit-diary-slot').value;
  item.kcal = Math.round(Number(document.getElementById('edit-diary-kcal').value) || 0);
  item.protein = Number(document.getElementById('edit-diary-p').value) || 0;
  item.carbs = Number(document.getElementById('edit-diary-c').value) || 0;
  item.fat = Number(document.getElementById('edit-diary-f').value) || 0;

  saveAppData();
  closeModal();
  renderAllViews();
  showToast('✅ Alimento actualizado.');
}

// ============================================================================
// CONTROL DE CALORÍAS POR FOTO CON IA + EDITOR INTERACTIVO DE INGREDIENTES
// ============================================================================

function updateAIKeyStatusBadge() {
  const statusEl = document.getElementById('ai-key-status-text');
  if (!statusEl) return;
  if (appData.settings.geminiApiKey && appData.settings.geminiApiKey.trim().length > 10) {
    statusEl.innerHTML = `🟢 <strong>IA Gemini Vision Activa</strong> (${escapeHtml(appData.settings.geminiModel || 'gemini-2.5-flash')})`;
  } else {
    statusEl.innerHTML = '🟡 <strong>Sin API Key</strong> (Configúrala gratis en Ajustes ⚙️)';
  }
}

function handleFoodPhotoSelected(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
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

// Normaliza un ingrediente de la IA guardando sus macros por 100g para que cambiar los gramos recalcule todo al instante
function normalizeDetectedItem(it) {
  const grams = Math.max(1, Number(it.grams ?? it.gramos) || 100);
  const kcal = Number(it.kcal ?? it.calorias ?? it.calories) || 0;
  const protein = Number(it.protein ?? it.proteina ?? it.proteinas) || 0;
  const carbs = Number(it.carbs ?? it.carbohidratos) || 0;
  const fat = Number(it.fat ?? it.grasas ?? it.grasa) || 0;

  return {
    name: String(it.name || it.nombre || 'Ingrediente detectado'),
    grams,
    kcal,
    protein,
    carbs,
    fat,
    kcalPer100: (kcal / grams) * 100,
    protPer100: (protein / grams) * 100,
    carbsPer100: (carbs / grams) * 100,
    fatPer100: (fat / grams) * 100
  };
}

async function analyzeFoodPhotoWithAI() {
  const hint = document.getElementById('ai-photo-hint').value.trim();
  const inputKey = document.getElementById('settings-gemini-key')?.value?.trim() || '';
  if (inputKey && !appData.settings.geminiApiKey) {
    appData.settings.geminiApiKey = inputKey;
    saveAppData();
  }
  const apiKey = (appData.settings.geminiApiKey || inputKey || '').trim();
  const modelName = appData.settings.geminiModel || 'gemini-2.5-flash';
  const btn = document.getElementById('btn-analyze-photo');
  const errorBox = document.getElementById('ai-error-box');
  const resultsCard = document.getElementById('ai-analysis-results');

  if (errorBox) {
    errorBox.style.display = 'none';
    errorBox.innerHTML = '';
  }

  if (!currentPhotoBase64) {
    const msg = 'Primero debes tomar una foto o subir una imagen de tu plato.';
    if (errorBox) {
      errorBox.style.display = 'block';
      errorBox.innerHTML = `<strong>⚠️ Falta la foto:</strong> ${escapeHtml(msg)}`;
    }
    showToast(`📷 ${msg}`, '#f59e0b');
    return;
  }

  if (!apiKey) {
    const msg = 'No has configurado tu Gemini API Key. Ve a la pestaña Ajustes (⚙️), pega tu clave de Google AI Studio y presiona "Guardar Configuración IA".';
    if (errorBox) {
      errorBox.style.display = 'block';
      errorBox.innerHTML = `<strong>🔑 Falta API Key:</strong> ${escapeHtml(msg)}`;
    }
    showToast('🔑 Configura tu Gemini API Key en Ajustes primero.', '#ef4444');
    return;
  }

  try {
    btn.disabled = true;
    btn.textContent = `🔍 Analizando ingredientes con ${modelName}...`;
    if (resultsCard) resultsCard.style.display = 'none';

    const promptText = `Eres un nutricionista deportivo experto. Analiza la foto de esta comida${hint ? ` (Nota importante del usuario: "${hint}")` : ''}.
Desglosa el plato en sus ingredientes individuales (por ejemplo, si es una hamburguesa: pan, carne, queso, vegetales, salsas; si es un plato: cada guarnición y proteína por separado), estima el peso en gramos de cada ingrediente y calcula sus calorías (kcal), proteínas (g), carbohidratos (g) y grasas (g).
Responde ÚNICAMENTE con un objeto JSON válido con este formato exacto, sin texto adicional ni bloques markdown:
{"items":[{"name":"Nombre del ingrediente en español","grams":100,"kcal":240,"protein":12,"carbs":30,"fat":6}]}`;

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: promptText },
            { inline_data: { mime_type: 'image/jpeg', data: currentPhotoBase64 } }
          ]
        }],
        generationConfig: {
          temperature: 0.2
        }
      })
    });

    const data = await response.json().catch(() => null);

    if (!response.ok || data?.error) {
      const apiErrMsg = data?.error?.message
        ? `${data.error.message} (Código ${data.error.code || response.status})`
        : `Error HTTP ${response.status} (${response.statusText || 'Fallo en la petición'})`;
      throw new Error(apiErrMsg);
    }

    const parts = data?.candidates?.[0]?.content?.parts || [];
    const rawText = parts
      .filter(p => !p.thought && typeof p.text === 'string')
      .map(p => p.text)
      .join('\n') || parts[0]?.text || '';

    if (!rawText) {
      const blockReason = data?.promptFeedback?.blockReason || data?.candidates?.[0]?.finishReason || 'Respuesta vacía del modelo';
      throw new Error(`Gemini no devolvió texto (${blockReason}).`);
    }

    const cleanText = rawText
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    const jsonObjectMatch = cleanText.match(/\{[\s\S]*\}/);
    const jsonStringToParse = jsonObjectMatch ? jsonObjectMatch[0] : cleanText;

    let parsed;
    try {
      parsed = JSON.parse(jsonStringToParse);
    } catch (parseErr) {
      throw new Error(`Error al parsear el JSON devuelto por Gemini: ${parseErr.message}. Respuesta recibida: ${cleanText.slice(0, 180)}`);
    }

    const itemsArray = Array.isArray(parsed) ? parsed : (parsed.items || parsed.alimentos || []);
    if (!Array.isArray(itemsArray) || itemsArray.length === 0) {
      throw new Error('Gemini no identificó ingredientes válidos en la imagen.');
    }

    aiDetectedItems = itemsArray.map(normalizeDetectedItem);
    aiPortionScale = 1.0;
    document.getElementById('ai-portion-slider').value = '1.0';
    renderAIDetectedResults();
    showToast('✨ ¡Ingredientes detectados! Puedes editar los pesos o cambiar cualquier ingrediente.');
  } catch (err) {
    console.error('Error real en Gemini API:', err);
    const realMsg = err?.message || String(err);
    if (errorBox) {
      errorBox.style.display = 'block';
      errorBox.innerHTML = `<strong>❌ Error en la API de Gemini (${escapeHtml(modelName)}):</strong><br/>${escapeHtml(realMsg)}`;
    }
    showToast(`❌ Error Gemini: ${escapeHtml(realMsg)}`, '#ef4444');
  } finally {
    btn.disabled = false;
    btn.textContent = '✨ Calcular Calorías de la Foto';
  }
}

function updateAIPortionScale(val) {
  aiPortionScale = Number(val) || 1.0;
  document.getElementById('ai-portion-scale-lbl').textContent = `${Math.round(aiPortionScale * 100)}% (${aiPortionScale.toFixed(1)}x)`;
  renderAIDetectedResults();
}

// Cambia los gramos de un ingrediente individual detectado por la IA y recalcula sus macros al instante
function updateAIIngredientGrams(idx, newGramsVal) {
  const item = aiDetectedItems[idx];
  if (!item) return;
  const g = Math.max(0, Number(newGramsVal) || 0);
  item.grams = g;
  item.kcal = Math.round((item.kcalPer100 * g) / 100);
  item.protein = Math.round(((item.protPer100 * g) / 100) * 10) / 10;
  item.carbs = Math.round(((item.carbsPer100 * g) / 100) * 10) / 10;
  item.fat = Math.round(((item.fatPer100 * g) / 100) * 10) / 10;
  renderAIDetectedResults(idx);
}

function renderAIDetectedResults(focusedInputIdx = null) {
  const card = document.getElementById('ai-analysis-results');
  const listEl = document.getElementById('ai-detected-items-list');
  const badgeEl = document.getElementById('ai-total-kcal-badge');
  if (!card || !listEl) return;

  card.style.display = 'block';
  let totalKcal = 0;
  let totalP = 0, totalC = 0, totalF = 0;

  listEl.innerHTML = aiDetectedItems.map((item, idx) => {
    const g = Math.round(item.grams * aiPortionScale);
    const kcal = Math.round(item.kcal * aiPortionScale);
    const p = (item.protein * aiPortionScale).toFixed(1);
    const c = (item.carbs * aiPortionScale).toFixed(1);
    const f = (item.fat * aiPortionScale).toFixed(1);
    totalKcal += kcal;
    totalP += Number(p);
    totalC += Number(c);
    totalF += Number(f);

    return `
      <div class="ai-ing-card">
        <div class="ai-ing-top">
          <div style="flex:1;">
            <div style="font-weight:800; font-size:14px; color:#fff;">${escapeHtml(item.name)}</div>
            <div style="font-size:11.5px; color:var(--text-muted); margin-top:2px;">
              <strong style="color:var(--accent);">${kcal} kcal</strong> • P: ${p}g | C: ${c}g | G: ${f}g
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:5px;">
            <input type="number" id="ai-ing-gram-input-${idx}" class="ai-gram-input" value="${item.grams}"
              oninput="updateAIIngredientGrams(${idx}, this.value)" title="Editar peso en gramos" />
            <span style="font-size:12px; font-weight:700; color:var(--text-muted);">g</span>
          </div>
        </div>
        <div class="ai-ing-actions">
          <button class="btn btn-secondary btn-sm" style="padding:4px 9px; font-size:11.5px;" onclick="openReplaceOrAddAIIngredientModal(${idx})">
            🔄 Cambiar por Alimento / Crear
          </button>
          <button class="btn btn-ghost btn-sm" style="padding:4px 9px; font-size:11.5px;" onclick="openEditAIIngredientMacrosModal(${idx})">
            ✏️ Editar Nombre/Macros
          </button>
          <button class="btn btn-danger btn-sm" style="padding:4px 8px; font-size:11.5px; margin-left:auto;" onclick="aiDetectedItems.splice(${idx},1); renderAIDetectedResults();">
            🗑️
          </button>
        </div>
      </div>
    `;
  }).join('');

  badgeEl.textContent = `${totalKcal} kcal (P:${Math.round(totalP)}g C:${Math.round(totalC)}g G:${Math.round(totalF)}g)`;

  if (focusedInputIdx !== null) {
    const inp = document.getElementById(`ai-ing-gram-input-${focusedInputIdx}`);
    if (inp) {
      inp.focus();
      const val = inp.value;
      inp.value = '';
      inp.value = val;
    }
  }
}

// Modal para reemplazar un ingrediente detectado por la IA usando el repositorio de alimentos o creándolo al instante
let replacingAIIngredientIndex = -1;

function openReplaceOrAddAIIngredientModal(idx) {
  replacingAIIngredientIndex = idx;
  const currentItem = idx >= 0 ? aiDetectedItems[idx] : null;
  const currentGrams = currentItem ? currentItem.grams : 100;

  openModal(
    idx >= 0 ? `🔄 Reemplazar: ${currentItem.name}` : '➕ Añadir Ingrediente al Plato',
    `
    <div class="form-group">
      <label class="form-label">Peso en gramos para este ingrediente</label>
      <input type="number" id="replace-ai-grams" class="form-control" value="${currentGrams}" />
    </div>

    <div class="form-group">
      <label class="form-label">1️⃣ Elegir de tu Repositorio de Alimentos</label>
      <div style="display:flex; gap:6px; margin-bottom:8px;">
        <input type="text" id="replace-ai-search" class="form-control" placeholder="🔍 Ej: Pan de masa madre, queso, pollo..." oninput="renderReplaceAIFoodList()" />
        <button class="btn btn-blue btn-sm" onclick="searchOnlineForAIModal()">🌐 Online</button>
      </div>
      <div id="replace-ai-food-list" style="max-height:210px; overflow-y:auto; border:1px solid var(--border); border-radius:10px; padding:6px;"></div>
    </div>

    <div style="border-top:1px solid var(--border); padding-top:12px; margin-top:10px;">
      <div class="form-label" style="color:var(--accent); font-weight:800; margin-bottom:8px;">
        2️⃣ ¿No está en la lista? Créalo en tu repositorio y úsalo ahora:
      </div>
      <div class="form-group">
        <input type="text" id="replace-new-name" class="form-control" placeholder="Nombre (Ej: Pan de Masa Madre Artesanal)" value="${currentItem ? escapeHtml(currentItem.name) : ''}" />
      </div>
      <div class="form-row-4" style="margin-bottom:10px;">
        <div>
          <label class="form-label">Kcal/100g</label>
          <input type="number" id="replace-new-kcal" class="form-control" placeholder="245" />
        </div>
        <div>
          <label class="form-label">Prot/100g</label>
          <input type="number" step="0.1" id="replace-new-p" class="form-control" placeholder="9.5" />
        </div>
        <div>
          <label class="form-label">Carb/100g</label>
          <input type="number" step="0.1" id="replace-new-c" class="form-control" placeholder="47" />
        </div>
        <div>
          <label class="form-label">Grasa/100g</label>
          <input type="number" step="0.1" id="replace-new-f" class="form-control" placeholder="1.8" />
        </div>
      </div>
      <button class="btn btn-primary btn-block" onclick="createAndUseFoodInAIPlate()">
        💾 Guardar en Repositorio y Usar en el Plato
      </button>
    </div>
    `
  );
  renderReplaceAIFoodList();
}

function renderReplaceAIFoodList() {
  const listEl = document.getElementById('replace-ai-food-list');
  if (!listEl) return;
  const q = (document.getElementById('replace-ai-search')?.value || '').toLowerCase().trim();

  const matches = appData.foods.filter(f =>
    !q || f.name.toLowerCase().includes(q) || (f.brand || '').toLowerCase().includes(q)
  ).slice(0, 25);

  if (matches.length === 0) {
    listEl.innerHTML = `<div style="font-size:12px; color:var(--text-muted); padding:10px; text-align:center;">No se encontró "${escapeHtml(q)}". Usa el botón 🌐 Online o créalo abajo.</div>`;
    return;
  }

  listEl.innerHTML = matches.map(f => `
    <div class="meal-item" style="cursor:pointer; padding:7px 4px;" onclick="selectFoodForAIReplacement('${f.id}')">
      <div>
        <div style="font-weight:700; font-size:13px;">${escapeHtml(f.name)}</div>
        <div style="font-size:11px; color:var(--text-muted);">Por ${f.servingG}g: <strong style="color:var(--accent);">${f.kcal} kcal</strong> (P:${f.protein}g C:${f.carbs}g G:${f.fat}g)</div>
      </div>
      <span class="btn btn-primary btn-sm">Usar</span>
    </div>
  `).join('');
}

async function searchOnlineForAIModal() {
  const q = (document.getElementById('replace-ai-search')?.value || '').trim();
  if (!q) {
    showToast('Escribe el nombre del alimento para buscar online.', '#f59e0b');
    return;
  }
  await searchOpenFoodFactsByText(q);
  renderReplaceAIFoodList();
}

function selectFoodForAIReplacement(foodId) {
  const food = appData.foods.find(f => f.id === foodId);
  if (!food) return;
  const grams = Math.max(1, Number(document.getElementById('replace-ai-grams')?.value) || food.servingG || 100);
  const ratio = grams / Math.max(1, food.servingG);

  const newItem = normalizeDetectedItem({
    name: food.name,
    grams,
    kcal: Math.round(food.kcal * ratio),
    protein: Math.round(food.protein * ratio * 10) / 10,
    carbs: Math.round(food.carbs * ratio * 10) / 10,
    fat: Math.round(food.fat * ratio * 10) / 10
  });

  if (replacingAIIngredientIndex >= 0 && replacingAIIngredientIndex < aiDetectedItems.length) {
    aiDetectedItems[replacingAIIngredientIndex] = newItem;
    showToast(`🔄 Cambiado por ${food.name} (${grams}g)`);
  } else {
    aiDetectedItems.push(newItem);
    showToast(`➕ Añadido ${food.name} (${grams}g)`);
  }

  closeModal();
  renderAIDetectedResults();
}

function createAndUseFoodInAIPlate() {
  const name = document.getElementById('replace-new-name')?.value.trim();
  if (!name) {
    showToast('Escribe el nombre del nuevo alimento.', '#ef4444');
    return;
  }
  const kcal100 = Number(document.getElementById('replace-new-kcal')?.value) || 0;
  const p100 = Number(document.getElementById('replace-new-p')?.value) || 0;
  const c100 = Number(document.getElementById('replace-new-c')?.value) || 0;
  const f100 = Number(document.getElementById('replace-new-f')?.value) || 0;
  const grams = Math.max(1, Number(document.getElementById('replace-ai-grams')?.value) || 100);

  const createdFood = {
    id: 'fd_custom_' + Date.now(),
    name,
    brand: 'Mi Repositorio',
    servingG: 100,
    kcal: kcal100,
    protein: p100,
    carbs: c100,
    fat: f100,
    barcode: ''
  };

  appData.foods.unshift(createdFood);
  saveAppData();
  selectFoodForAIReplacement(createdFood.id);
}

function openEditAIIngredientMacrosModal(idx) {
  const item = aiDetectedItems[idx];
  if (!item) return;

  openModal('✏️ Editar Ingrediente del Plato', `
    <div class="form-group">
      <label class="form-label">Nombre del Ingrediente</label>
      <input type="text" id="edit-ai-ing-name" class="form-control" value="${escapeHtml(item.name)}" />
    </div>
    <div class="form-group">
      <label class="form-label">Peso estimado (gramos)</label>
      <input type="number" id="edit-ai-ing-grams" class="form-control" value="${item.grams}" />
    </div>
    <div class="form-row-4" style="margin-bottom:14px;">
      <div>
        <label class="form-label">Kcal</label>
        <input type="number" id="edit-ai-ing-kcal" class="form-control" value="${Math.round(item.kcal)}" />
      </div>
      <div>
        <label class="form-label">Prot (g)</label>
        <input type="number" step="0.1" id="edit-ai-ing-p" class="form-control" value="${item.protein}" />
      </div>
      <div>
        <label class="form-label">Carb (g)</label>
        <input type="number" step="0.1" id="edit-ai-ing-c" class="form-control" value="${item.carbs}" />
      </div>
      <div>
        <label class="form-label">Grasa (g)</label>
        <input type="number" step="0.1" id="edit-ai-ing-f" class="form-control" value="${item.fat}" />
      </div>
    </div>
    <button class="btn btn-primary btn-block" onclick="saveEditedAIIngredient(${idx})">💾 Actualizar Ingrediente</button>
  `);
}

function saveEditedAIIngredient(idx) {
  const name = document.getElementById('edit-ai-ing-name').value.trim() || 'Ingrediente';
  const grams = Math.max(1, Number(document.getElementById('edit-ai-ing-grams').value) || 100);
  const kcal = Number(document.getElementById('edit-ai-ing-kcal').value) || 0;
  const protein = Number(document.getElementById('edit-ai-ing-p').value) || 0;
  const carbs = Number(document.getElementById('edit-ai-ing-c').value) || 0;
  const fat = Number(document.getElementById('edit-ai-ing-f').value) || 0;

  aiDetectedItems[idx] = normalizeDetectedItem({ name, grams, kcal, protein, carbs, fat });
  closeModal();
  renderAIDetectedResults();
  showToast('✅ Ingrediente actualizado.');
}

function saveAIMealAsCustomRecipe() {
  if (aiDetectedItems.length === 0) return;
  const name = prompt('Nombre para guardar este plato en "Mis Recetas":', 'Mi Plato Favorito');
  if (!name) return;

  appData.recipes.unshift({
    id: 'rec_' + Date.now(),
    name: name.trim(),
    servings: 1,
    ingredients: aiDetectedItems.map(it => ({
      foodId: '',
      name: it.name,
      grams: Math.round(it.grams * aiPortionScale),
      kcal: Math.round(it.kcal * aiPortionScale),
      protein: Math.round(it.protein * aiPortionScale * 10) / 10,
      carbs: Math.round(it.carbs * aiPortionScale * 10) / 10,
      fat: Math.round(it.fat * aiPortionScale * 10) / 10
    }))
  });
  saveAppData();
  renderRecipesList();
  showToast(`👨‍🍳 ¡Guardado en Mis Recetas como "${name}"!`);
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
  showToast(`✅ ¡Plato registrado en ${slot}!`);
  switchNutritionSubtab('diary');
}

// ============================================================================
// APARTADO DE MIS RECETAS PERSONALIZADAS (ESTILO FITIA)
// ============================================================================

let draftRecipeIngredients = [];
let editingRecipeId = null;

function computeRecipeTotals(rec) {
  const servings = Math.max(1, Number(rec.servings) || 1);
  const tot = (rec.ingredients || []).reduce(
    (acc, ing) => {
      acc.grams += Number(ing.grams) || 0;
      acc.kcal += Number(ing.kcal) || 0;
      acc.protein += Number(ing.protein) || 0;
      acc.carbs += Number(ing.carbs) || 0;
      acc.fat += Number(ing.fat) || 0;
      return acc;
    },
    { grams: 0, kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );
  return {
    total: tot,
    perServing: {
      grams: Math.round(tot.grams / servings),
      kcal: Math.round(tot.kcal / servings),
      protein: Math.round((tot.protein / servings) * 10) / 10,
      carbs: Math.round((tot.carbs / servings) * 10) / 10,
      fat: Math.round((tot.fat / servings) * 10) / 10
    }
  };
}

function renderRecipesList() {
  const container = document.getElementById('recipes-list-container');
  if (!container) return;

  if (!appData.recipes || appData.recipes.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:16px; color:var(--text-muted);">Aún no tienes recetas guardadas. Toca "➕ Crear Receta" para armar tus platos frecuentes.</div>`;
    return;
  }

  container.innerHTML = appData.recipes.map(rec => {
    const calc = computeRecipeTotals(rec);
    const ingNames = (rec.ingredients || []).map(i => `${i.name} (${i.grams}g)`).join(', ');

    return `
      <div class="card" style="background:var(--bg-input); margin-bottom:10px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
          <div>
            <div style="font-weight:800; font-size:15px;">👨‍🍳 ${escapeHtml(rec.name)}</div>
            <div style="font-size:11.5px; color:var(--text-muted);">
              Por porción (${calc.perServing.grams}g): <strong style="color:var(--accent);">${calc.perServing.kcal} kcal</strong> • P:${calc.perServing.protein}g | C:${calc.perServing.carbs}g | G:${calc.perServing.fat}g
            </div>
          </div>
          <div style="display:flex; gap:5px;">
            <button class="btn btn-ghost btn-sm" onclick="openRecipeBuilderModal('${rec.id}')">✏️</button>
            <button class="btn btn-ghost btn-sm" onclick="deleteRecipe('${rec.id}')">🗑️</button>
          </div>
        </div>
        <div style="font-size:11.5px; color:var(--text-dim); margin-bottom:10px;">
          <strong>Ingredientes:</strong> ${escapeHtml(ingNames)}
        </div>
        <button class="btn btn-primary btn-sm btn-block" onclick="openLogRecipeModal('${rec.id}')">
          🍽️ Registrar Esta Receta en Mi Diario
        </button>
      </div>
    `;
  }).join('');
}

function openRecipeBuilderModal(recipeId = null) {
  editingRecipeId = recipeId;
  const existing = recipeId ? appData.recipes.find(r => r.id === recipeId) : null;
  draftRecipeIngredients = existing ? JSON.parse(JSON.stringify(existing.ingredients)) : [];

  const foodOptions = appData.foods.map(f => `<option value="${f.id}">${escapeHtml(f.name)} (${f.kcal} kcal / ${f.servingG}g)</option>`).join('');

  openModal(existing ? '✏️ Editar Receta' : '👨‍🍳 Crear Nueva Receta', `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Nombre de la Receta</label>
        <input type="text" id="rec-name-input" class="form-control" value="${existing ? escapeHtml(existing.name) : ''}" placeholder="Ej: Hamburguesa Casera Masa Madre" />
      </div>
      <div class="form-group">
        <label class="form-label">N° de Porciones que rinde</label>
        <input type="number" id="rec-servings-input" class="form-control" value="${existing ? existing.servings : 1}" min="1" oninput="renderDraftRecipeIngredients()" />
      </div>
    </div>

    <div style="background:var(--bg-input); padding:10px; border-radius:10px; margin-bottom:12px;">
      <label class="form-label">Añadir Ingrediente del Repositorio:</label>
      <div style="display:flex; gap:6px; margin-bottom:6px;">
        <select id="rec-add-food-select" class="form-control" style="flex:2;">${foodOptions}</select>
        <input type="number" id="rec-add-food-grams" class="form-control" style="flex:1;" value="100" placeholder="g" />
        <button class="btn btn-secondary" onclick="addIngredientToRecipeDraft()">➕</button>
      </div>
    </div>

    <div class="form-label">Ingredientes de la receta:</div>
    <div id="rec-draft-ingredients-list" style="margin-bottom:12px;"></div>
    <div id="rec-draft-totals-box" style="text-align:center; padding:10px; background:var(--bg-input); border-radius:10px; margin-bottom:12px; font-weight:700; font-size:13px;"></div>

    <button class="btn btn-primary btn-block" onclick="saveRecipeFromModal()">💾 Guardar Receta</button>
  `);
  renderDraftRecipeIngredients();
}

function addIngredientToRecipeDraft() {
  const fId = document.getElementById('rec-add-food-select')?.value;
  const grams = Math.max(1, Number(document.getElementById('rec-add-food-grams')?.value) || 100);
  const food = appData.foods.find(f => f.id === fId);
  if (!food) return;

  const ratio = grams / Math.max(1, food.servingG);
  draftRecipeIngredients.push({
    foodId: food.id,
    name: food.name,
    grams,
    kcal: Math.round(food.kcal * ratio),
    protein: Math.round(food.protein * ratio * 10) / 10,
    carbs: Math.round(food.carbs * ratio * 10) / 10,
    fat: Math.round(food.fat * ratio * 10) / 10
  });
  renderDraftRecipeIngredients();
}

function renderDraftRecipeIngredients() {
  const listEl = document.getElementById('rec-draft-ingredients-list');
  const totEl = document.getElementById('rec-draft-totals-box');
  if (!listEl || !totEl) return;

  if (draftRecipeIngredients.length === 0) {
    listEl.innerHTML = `<div style="font-size:12px; color:var(--text-muted); padding:8px;">Agrega al menos un ingrediente arriba.</div>`;
    totEl.innerHTML = '0 kcal';
    return;
  }

  listEl.innerHTML = draftRecipeIngredients.map((ing, idx) => `
    <div class="meal-item" style="padding:6px 0;">
      <div>
        <div style="font-weight:700; font-size:13px;">${escapeHtml(ing.name)} (${ing.grams}g)</div>
        <div style="font-size:11px; color:var(--text-muted);">${ing.kcal} kcal • P:${ing.protein}g C:${ing.carbs}g G:${ing.fat}g</div>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="draftRecipeIngredients.splice(${idx},1); renderDraftRecipeIngredients();">✕</button>
    </div>
  `).join('');

  const servings = Math.max(1, Number(document.getElementById('rec-servings-input')?.value) || 1);
  const calc = computeRecipeTotals({ servings, ingredients: draftRecipeIngredients });
  totEl.innerHTML = `Por porción: <span style="color:var(--accent);">${calc.perServing.kcal} kcal</span> (P:${calc.perServing.protein}g | C:${calc.perServing.carbs}g | G:${calc.perServing.fat}g)`;
}

function saveRecipeFromModal() {
  const name = document.getElementById('rec-name-input')?.value.trim();
  if (!name) {
    showToast('Ponle un nombre a tu receta.', '#ef4444');
    return;
  }
  if (draftRecipeIngredients.length === 0) {
    showToast('Añade al menos un ingrediente a la receta.', '#ef4444');
    return;
  }
  const servings = Math.max(1, Number(document.getElementById('rec-servings-input')?.value) || 1);

  if (editingRecipeId) {
    const idx = appData.recipes.findIndex(r => r.id === editingRecipeId);
    if (idx >= 0) {
      appData.recipes[idx] = { id: editingRecipeId, name, servings, ingredients: draftRecipeIngredients };
    }
  } else {
    appData.recipes.unshift({
      id: 'rec_' + Date.now(),
      name,
      servings,
      ingredients: draftRecipeIngredients
    });
  }

  saveAppData();
  closeModal();
  renderRecipesList();
  showToast('👨‍🍳 ¡Receta guardada!');
}

function deleteRecipe(recId) {
  if (!confirm('¿Eliminar esta receta?')) return;
  appData.recipes = appData.recipes.filter(r => r.id !== recId);
  saveAppData();
  renderRecipesList();
}

function openLogRecipeModal(recId) {
  const rec = appData.recipes.find(r => r.id === recId);
  if (!rec) return;
  const calc = computeRecipeTotals(rec);

  openModal(`🍽️ Registrar: ${rec.name}`, `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Porciones consumidas</label>
        <input type="number" step="0.25" id="log-rec-portions" class="form-control" value="1"
          oninput="
            const p = Number(this.value)||0;
            document.getElementById('log-rec-preview').innerHTML =
              '<span style=\\'color:var(--accent); font-size:16px;\\'>' + Math.round(p * ${calc.perServing.kcal}) + ' kcal</span><br/>' +
              'Prot: ' + (p * ${calc.perServing.protein}).toFixed(1) + 'g • Carb: ' + (p * ${calc.perServing.carbs}).toFixed(1) + 'g • Grasa: ' + (p * ${calc.perServing.fat}).toFixed(1) + 'g';
          " />
      </div>
      <div class="form-group">
        <label class="form-label">Comida</label>
        <select id="log-rec-slot" class="form-control">
          ${MEAL_SLOTS.map(s => `<option value="${s.key}" ${defaultSlotForNextFood === s.key ? 'selected' : ''}>${s.icon} ${s.title}</option>`).join('')}
        </select>
      </div>
    </div>
    <div id="log-rec-preview" style="background:var(--bg-input); padding:12px; border-radius:10px; text-align:center; margin-bottom:14px; font-weight:700;">
      <span style="color:var(--accent); font-size:16px;">${calc.perServing.kcal} kcal</span><br/>
      Prot: ${calc.perServing.protein}g • Carb: ${calc.perServing.carbs}g • Grasa: ${calc.perServing.fat}g
    </div>
    <button class="btn btn-primary btn-block" onclick="confirmLogRecipe('${rec.id}')">✅ Agregar al Diario</button>
  `);
}

function confirmLogRecipe(recId) {
  const rec = appData.recipes.find(r => r.id === recId);
  if (!rec) return;
  const portions = Math.max(0.1, Number(document.getElementById('log-rec-portions')?.value) || 1);
  const slot = document.getElementById('log-rec-slot')?.value || 'Almuerzo';
  const calc = computeRecipeTotals(rec);

  addFoodItemToDiary({
    slot,
    name: `👨‍🍳 ${rec.name} (${portions} porc.)`,
    grams: Math.round(calc.perServing.grams * portions),
    kcal: Math.round(calc.perServing.kcal * portions),
    protein: calc.perServing.protein * portions,
    carbs: calc.perServing.carbs * portions,
    fat: calc.perServing.fat * portions
  });

  closeModal();
  showToast(`✅ Receta agregada a ${slot}`);
  switchNutritionSubtab('diary');
}

// ============================================================================
// APARTADO DE SUPLEMENTOS (CHECKLIST DIARIO + STACK PERSONALIZADO)
// ============================================================================

function renderSupplementsWidgets() {
  const today = getTodayISO();
  const day = getDayNutrition(today);
  const takenIds = day.supplementsTaken || [];

  const renderListHtml = (showDelete) =>
    appData.supplements.map(sup => {
      const isTaken = takenIds.includes(sup.id);
      return `
        <div class="supp-item ${isTaken ? 'taken' : ''}" onclick="toggleSupplementTaken('${sup.id}')">
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="font-size:20px;">${sup.icon || '💊'}</span>
            <div>
              <div style="font-weight:800; font-size:13.5px;">${escapeHtml(sup.name)} <span class="badge">${escapeHtml(sup.dose)}</span></div>
              <div style="font-size:11px; color:var(--text-muted);">${escapeHtml(sup.timing || 'Diario')}</div>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:6px;">
            <span class="badge ${isTaken ? 'badge-accent' : ''}">${isTaken ? '✓ Tomado' : 'Pendiente'}</span>
            ${showDelete ? `<button class="btn btn-ghost btn-sm" style="padding:2px 6px;" onclick="event.stopPropagation(); deleteSupplement('${sup.id}')">✕</button>` : ''}
          </div>
        </div>
      `;
    }).join('');

  const homeList = document.getElementById('home-supplements-quick-list');
  if (homeList) homeList.innerHTML = renderListHtml(false);

  const fullList = document.getElementById('supplements-full-list');
  if (fullList) fullList.innerHTML = renderListHtml(true);
}

function toggleSupplementTaken(supId) {
  const today = getTodayISO();
  const day = getDayNutrition(today);
  const idx = day.supplementsTaken.indexOf(supId);
  if (idx >= 0) {
    day.supplementsTaken.splice(idx, 1);
  } else {
    day.supplementsTaken.push(supId);
    playSound('beep');
    const sup = appData.supplements.find(s => s.id === supId);
    if (sup) showToast(`💊 ¡${sup.name} (${sup.dose}) registrado hoy!`);
  }
  saveAppData();
  renderAllViews();
}

function openAddSupplementModal() {
  openModal('💊 Agregar Suplemento a Mi Stack', `
    <div class="form-group">
      <label class="form-label">Nombre del Suplemento</label>
      <input type="text" id="sup-name-input" class="form-control" placeholder="Ej: Citratos de Magnesio / Ashwagandha / Beta-Alanina" />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Dosis</label>
        <input type="text" id="sup-dose-input" class="form-control" placeholder="Ej: 5g / 2 cápsulas" />
      </div>
      <div class="form-group">
        <label class="form-label">Ícono</label>
        <select id="sup-icon-input" class="form-control">
          <option value="💊">💊 Cápsula</option>
          <option value="⚡">⚡ Creatina / Energía</option>
          <option value="🥤">🥤 Batido / Polvo</option>
          <option value="🔥">🔥 Pre-Entreno</option>
          <option value="☀️">☀️ Vitamina</option>
          <option value="🐟">🐟 Omega / Salud</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Momento de toma</label>
      <input type="text" id="sup-timing-input" class="form-control" placeholder="Ej: Con el desayuno / Post-entreno" />
    </div>
    <button class="btn btn-primary btn-block" onclick="saveNewSupplement()">💾 Guardar Suplemento</button>
  `);
}

function saveNewSupplement() {
  const name = document.getElementById('sup-name-input')?.value.trim();
  if (!name) {
    showToast('Escribe el nombre del suplemento.', '#ef4444');
    return;
  }
  appData.supplements.push({
    id: 'sup_' + Date.now(),
    name,
    dose: document.getElementById('sup-dose-input')?.value.trim() || '1 dosis',
    icon: document.getElementById('sup-icon-input')?.value || '💊',
    timing: document.getElementById('sup-timing-input')?.value.trim() || 'Cualquier hora'
  });
  saveAppData();
  closeModal();
  renderSupplementsWidgets();
  showToast('💊 Suplemento añadido a tu checklist diario.');
}

function deleteSupplement(supId) {
  if (!confirm('¿Quitar este suplemento de tu lista?')) return;
  appData.supplements = appData.supplements.filter(s => s.id !== supId);
  saveAppData();
  renderSupplementsWidgets();
}

// ============================================================================
// RUTINA DE AYUNO INTERMITENTE (ESTILO YAZIO)
// ============================================================================

function startFastingTicker() {
  if (fastingTimerInterval) clearInterval(fastingTimerInterval);
  fastingTimerInterval = setInterval(() => {
    if (appData.fasting && appData.fasting.isActive) {
      renderFastingView();
    }
  }, 1000);
}

function changeFastingProtocol(hoursVal) {
  appData.fasting.protocolHours = Number(hoursVal) || 16;
  saveAppData();
  renderFastingView();
}

function toggleFastingSession() {
  const f = appData.fasting;
  if (!f.isActive) {
    f.isActive = true;
    f.startTime = Date.now();
    f.notifiedGoal = false;
    saveAppData();
    renderFastingView();
    showToast(`⏳ ¡Ayuno ${f.protocolHours}:${24 - f.protocolHours} iniciado!`);
  } else {
    const elapsedHours = ((Date.now() - f.startTime) / 3600000).toFixed(1);
    if (!confirm(`Llevas ${elapsedHours} horas de ayuno. ¿Deseas terminar y guardar este ayuno?`)) return;
    f.history.unshift({
      id: 'fst_' + Date.now(),
      date: getTodayISO(),
      protocol: `${f.protocolHours}:${24 - f.protocolHours}`,
      hoursCompleted: Number(elapsedHours),
      goalHours: f.protocolHours
    });
    f.isActive = false;
    f.startTime = null;
    saveAppData();
    renderFastingView();
    playSound('pr');
    showToast(`🎉 ¡Ayuno de ${elapsedHours} horas registrado en tu historial!`);
  }
}

function editFastingStartTime() {
  if (!appData.fasting.isActive) return;
  const hoursAgo = prompt('¿Hace cuántas horas empezaste a ayunar? (Ej: escribe 4 si cenaste hace 4 horas):', '2');
  if (hoursAgo !== null && !isNaN(Number(hoursAgo))) {
    appData.fasting.startTime = Date.now() - Number(hoursAgo) * 3600000;
    saveAppData();
    renderFastingView();
    showToast('⏱️ Hora de inicio del ayuno ajustada.');
  }
}

function renderFastingView() {
  const f = appData.fasting || { protocolHours: 16, isActive: false, history: [] };
  const protoBadgeHome = document.getElementById('home-fasting-protocol-badge');
  if (protoBadgeHome) protoBadgeHome.textContent = `${f.protocolHours}:${24 - f.protocolHours}`;

  const sel = document.getElementById('fasting-protocol-select');
  if (sel && String(sel.value) !== String(f.protocolHours)) {
    sel.value = String(f.protocolHours);
  }

  const ring = document.getElementById('fasting-ring-circle');
  const timerMain = document.getElementById('fasting-timer-main');
  const timerLbl = document.getElementById('fasting-timer-label');
  const pctLbl = document.getElementById('fasting-pct-label');
  const phaseBadge = document.getElementById('fasting-phase-badge');
  const startDisp = document.getElementById('fasting-start-display');
  const endDisp = document.getElementById('fasting-end-display');
  const btnToggle = document.getElementById('btn-fasting-toggle');
  const btnEdit = document.getElementById('btn-fasting-edit-start');
  const homeStatus = document.getElementById('home-fasting-status-text');
  const homeSub = document.getElementById('home-fasting-sub-text');

  if (f.isActive && f.startTime) {
    const elapsedSec = Math.max(0, Math.floor((Date.now() - f.startTime) / 1000));
    const goalSec = f.protocolHours * 3600;
    const remSec = Math.max(0, goalSec - elapsedSec);
    const pct = Math.min(100, Math.round((elapsedSec / goalSec) * 100));
    const elapsedHrs = elapsedSec / 3600;

    let phaseText = '💧 Digestión y glucógeno (0-4h)';
    if (elapsedHrs >= 16) phaseText = '🧬 Autofagia y renovación celular (16h+)';
    else if (elapsedHrs >= 12) phaseText = '🔥 Cetosis ligera y quema de grasa (12-16h)';
    else if (elapsedHrs >= 4) phaseText = '⚡ Insulina baja • Movilizando reservas (4-12h)';

    if (phaseBadge) phaseBadge.textContent = phaseText;
    if (timerLbl) timerLbl.textContent = remSec > 0 ? `Faltan ${formatHMS(remSec)}` : '¡Meta Alcanzada!';
    if (timerMain) timerMain.textContent = formatHMS(elapsedSec);
    if (pctLbl) pctLbl.textContent = `${pct}% de ${f.protocolHours}h`;

    if (ring) {
      const circ = 452;
      ring.style.strokeDashoffset = circ - (pct / 100) * circ;
    }

    const startDt = new Date(f.startTime);
    const endDt = new Date(f.startTime + goalSec * 1000);
    const fmt = (d) => d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    if (startDisp) startDisp.textContent = fmt(startDt);
    if (endDisp) endDisp.textContent = fmt(endDt);

    if (btnToggle) {
      btnToggle.textContent = '⏹️ Terminar y Guardar Ayuno';
      btnToggle.className = 'btn btn-danger btn-block';
    }
    if (btnEdit) btnEdit.style.display = 'inline-flex';

    if (homeStatus) homeStatus.textContent = `🔥 Ayunando: ${formatHMS(elapsedSec)} (${pct}%)`;
    if (homeSub) homeSub.textContent = phaseText;

    if (remSec === 0 && !f.notifiedGoal) {
      f.notifiedGoal = true;
      saveAppData();
      sendLocalNotification('⏳ ¡Meta de Ayuno Cumplida!', `Completaste tus ${f.protocolHours} horas de ayuno intermitente.`);
    }
  } else {
    if (phaseBadge) phaseBadge.textContent = '🍽️ En ventana de alimentación';
    if (timerLbl) timerLbl.textContent = 'Meta de ayuno';
    if (timerMain) timerMain.textContent = `${f.protocolHours}:00:00`;
    if (pctLbl) pctLbl.textContent = 'Inactivo';
    if (ring) ring.style.strokeDashoffset = 452;
    if (startDisp) startDisp.textContent = '--:--';
    if (endDisp) endDisp.textContent = '--:--';
    if (btnToggle) {
      btnToggle.textContent = '▶️ Iniciar Ayuno Ahora';
      btnToggle.className = 'btn btn-primary btn-block';
    }
    if (btnEdit) btnEdit.style.display = 'none';
    if (homeStatus) homeStatus.textContent = '🍽️ Ventana de Alimentación';
    if (homeSub) homeSub.textContent = `Protocolo ${f.protocolHours}:${24 - f.protocolHours} listo para iniciar.`;
  }

  const histEl = document.getElementById('fasting-history-list');
  if (histEl) {
    if (!f.history || f.history.length === 0) {
      histEl.innerHTML = `<div style="font-size:12px; color:var(--text-muted); text-align:center; padding:10px;">Sin ayunos guardados todavía.</div>`;
    } else {
      histEl.innerHTML = f.history.slice(0, 10).map(h => `
        <div class="meal-item">
          <div>
            <div class="meal-item-title">Protocolo ${escapeHtml(h.protocol)} • ${formatReadableDate(h.date)}</div>
            <div class="meal-item-sub">Meta: ${h.goalHours}h</div>
          </div>
          <span class="badge ${h.hoursCompleted >= h.goalHours ? 'badge-accent' : 'badge-gold'}">
            ⏱️ ${h.hoursCompleted} horas
          </span>
        </div>
      `).join('');
    }
  }
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
    readerBox.innerHTML = `<div style="padding:16px; text-align:center; color:var(--text-muted);">No se pudo acceder a la cámara. Puedes escribir el código de barras abajo.</div>`;
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

  const localMatch = appData.foods.find(f => f.barcode === code);
  if (localMatch) {
    renderScannedProductCard(localMatch, code);
    return;
  }

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

  card.innerHTML = `
    <div style="text-align:center; padding:10px;">
      <div style="font-weight:800; margin-bottom:6px;">Producto no encontrado para el código ${escapeHtml(code)}</div>
      <p style="font-size:12px; color:var(--text-muted); margin-bottom:10px;">
        ¿Quieres guardarlo en tu repositorio personal con este código de barras?
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
          ${MEAL_SLOTS.map(s => `<option value="${s.key}" ${defaultSlotForNextFood === s.key ? 'selected' : ''}>${s.icon} ${s.title}</option>`).join('')}
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

  container.innerHTML = filtered.slice(0, 40).map(f => `
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

async function searchOpenFoodFactsByText(overrideQuery = null) {
  const q = (overrideQuery ?? document.getElementById('food-db-search')?.value ?? '').trim();
  if (!q) {
    showToast('Escribe el nombre de un producto o marca para buscar en línea.', '#f59e0b');
    return;
  }

  const container = document.getElementById('food-database-results');
  if (container && !overrideQuery) {
    container.innerHTML = `<div style="text-align:center; padding:16px;">🌐 Buscando "${escapeHtml(q)}" en OpenFoodFacts...</div>`;
  }

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
      showToast('🌐 Productos online agregados a tu repositorio.');
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
          ${MEAL_SLOTS.map(s => `<option value="${s.key}" ${defaultSlotForNextFood === s.key ? 'selected' : ''}>${s.icon} ${s.title}</option>`).join('')}
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
  openModal('Crear Alimento en Mi Repositorio', `
    <div class="form-group">
      <label class="form-label">Nombre del Alimento</label>
      <input type="text" id="cf-name" class="form-control" placeholder="Ej: Pan de Masa Madre / Queso Fresco" />
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
        <input type="number" id="cf-kcal" class="form-control" placeholder="245" />
      </div>
      <div>
        <label class="form-label">Prot (g)</label>
        <input type="number" step="0.1" id="cf-p" class="form-control" placeholder="9.5" />
      </div>
      <div>
        <label class="form-label">Carb (g)</label>
        <input type="number" step="0.1" id="cf-c" class="form-control" placeholder="47" />
      </div>
      <div>
        <label class="form-label">Grasa (g)</label>
        <input type="number" step="0.1" id="cf-f" class="form-control" placeholder="1.8" />
      </div>
    </div>
    <button class="btn btn-primary btn-block" onclick="saveCustomFood()">💾 Guardar en Mi Repositorio</button>
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
  showToast('🍎 Alimento guardado en tu repositorio.');
}

// ============================================================================
// 4. PROGRESO, META DE PESO ESTILO YAZIO Y GRÁFICOS
// ============================================================================

function renderProgressView() {
  renderYazioWeightGoalCard();

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

function renderYazioWeightGoalCard() {
  const container = document.getElementById('yazio-weight-goal-summary');
  if (!container) return;

  const prof = appData.settings.tdeeProfile || {};
  const currentW = Number(appData.bodyLogs[0]?.weight || prof.weight || 75);
  const startW = Number(appData.bodyLogs[appData.bodyLogs.length - 1]?.weight || prof.startWeight || prof.weight || currentW);
  const targetW = Number(prof.targetWeight || 70);
  const rate = Math.max(0.1, Number(prof.weeklyRate) || 0.5);

  const diffRemaining = Math.abs(targetW - currentW);
  const totalSpan = Math.max(0.5, Math.abs(targetW - startW));
  let pctDone = 0;
  if (Math.abs(targetW - currentW) < 0.1) {
    pctDone = 100;
  } else if ((targetW < startW && currentW <= startW) || (targetW > startW && currentW >= startW)) {
    pctDone = Math.min(100, Math.max(5, Math.round((Math.abs(currentW - startW) / totalSpan) * 100)));
  }

  const weeksLeft = diffRemaining / rate;
  const targetDate = new Date(Date.now() + weeksLeft * 7 * 86400000);
  const dateStr = targetDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  const modeLabel = targetW < currentW ? '🔥 Pérdida de Peso / Definición' : targetW > currentW ? '💪 Aumento de Masa Muscular' : '⚖️ Mantenimiento';

  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
      <span class="badge badge-gold">${modeLabel}</span>
      <span style="font-size:12px; color:var(--text-muted);">Ritmo: <strong>${rate} kg/sem</strong></span>
    </div>
    <div style="display:grid; grid-template-columns:repeat(3,1fr); text-align:center; gap:8px; margin-bottom:10px;">
      <div style="background:var(--bg-input); padding:8px; border-radius:10px;">
        <div style="font-size:11px; color:var(--text-muted);">Inicial</div>
        <div style="font-weight:800; font-size:15px;">${startW} kg</div>
      </div>
      <div style="background:var(--bg-input); padding:8px; border-radius:10px; border:1px solid #004D98;">
        <div style="font-size:11px; color:#38bdf8;">Actual</div>
        <div style="font-weight:900; font-size:16px;">${currentW} kg</div>
      </div>
      <div style="background:var(--bg-input); padding:8px; border-radius:10px; border:1px solid var(--gold);">
        <div style="font-size:11px; color:var(--gold);">Peso Meta</div>
        <div style="font-weight:900; font-size:16px; color:var(--gold);">${targetW} kg</div>
      </div>
    </div>
    <div class="progress-track" style="height:9px; margin-bottom:8px;">
      <div class="progress-fill" style="width:${pctDone}%; background:linear-gradient(90deg, #004D98, #A50044, #EDBB00);"></div>
    </div>
    <div style="font-size:12px; color:var(--text-muted); display:flex; justify-content:space-between;">
      <span>Faltan: <strong>${diffRemaining.toFixed(1)} kg</strong></span>
      <span>📅 Meta estimada: <strong style="color:var(--gold);">${diffRemaining < 0.2 ? '🏆 ¡Lograda!' : dateStr}</strong></span>
    </div>
  `;
}

function renderStrengthChart() {
  const canvas = document.getElementById('strength-chart-canvas');
  const sel = document.getElementById('progress-exercise-select');
  const summaryEl = document.getElementById('strength-chart-summary');
  if (!canvas || !sel) return;

  const exId = sel.value;
  const points = [];

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

  drawLineChartOnCanvas(canvas, points, '#EDBB00');

  if (summaryEl) {
    if (points.length === 0) {
      summaryEl.innerHTML = `<span>Sin registros aún para este ejercicio</span><span>Entrena para ver tu curva</span>`;
    } else {
      const first = points[0].value;
      const last = points[points.length - 1].value;
      const diff = last - first;
      summaryEl.innerHTML = `
        <span>Partidos: <strong>${points.length}</strong></span>
        <span>Mejor 1RM: <strong style="color:var(--gold);">${Math.max(...points.map(p => p.value))} kg</strong></span>
        <span style="color:${diff >= 0 ? '#EDBB00' : '#ff4d79'};">Progreso: ${diff >= 0 ? '+' : ''}${diff} kg</span>
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

  drawLineChartOnCanvas(canvas, points, '#A50044');
}

function drawLineChartOnCanvas(canvas, points, colorHex) {
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

  const coords = points.map((pt, idx) => {
    const x = points.length === 1 ? padL + plotW / 2 : padL + (idx / (points.length - 1)) * plotW;
    const y = padT + plotH - ((pt.value - minV) / (maxV - minV)) * plotH;
    return { x, y, ...pt };
  });

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

    ctx.beginPath();
    coords.forEach((c, i) => (i === 0 ? ctx.moveTo(c.x, c.y) : ctx.lineTo(c.x, c.y)));
    ctx.strokeStyle = colorHex;
    ctx.lineWidth = 2.8;
    ctx.stroke();
  }

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

let pendingBodyPhotoBase64 = null;

function openBodyLogModal() {
  pendingBodyPhotoBase64 = null;
  const last = appData.bodyLogs[0] || {};
  openModal('⚖️ Registrar Peso, Medidas y Foto', `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Peso Corporal (kg)</label>
        <input type="number" step="0.1" id="bl-weight" class="form-control" value="${last.weight || appData.settings.tdeeProfile?.weight || 75}" />
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
      <input type="text" id="bl-notes" class="form-control" placeholder="Ej: En ayunas, post-entreno..." />
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

  if (appData.settings.tdeeProfile) {
    appData.settings.tdeeProfile.weight = weight;
  }

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
// 5. AJUSTES, PLANIFICADOR YAZIO DE PESO META, RECORDATORIOS Y BACKUP
// ============================================================================

function initSettingsInputs() {
  const s = appData.settings;
  document.getElementById('goal-kcal').value = s.kcalGoal || 2400;
  document.getElementById('goal-protein').value = s.proteinGoal || 160;
  document.getElementById('goal-carbs').value = s.carbsGoal || 260;
  document.getElementById('goal-fat').value = s.fatGoal || 70;
  document.getElementById('settings-gemini-key').value = s.geminiApiKey || '';
  const modelSel = document.getElementById('settings-gemini-model');
  if (modelSel) modelSel.value = s.geminiModel || 'gemini-2.5-flash';

  if (s.tdeeProfile) {
    document.getElementById('tdee-sex').value = s.tdeeProfile.sex || 'M';
    document.getElementById('tdee-age').value = s.tdeeProfile.age || 25;
    document.getElementById('tdee-weight').value = s.tdeeProfile.weight || 75;
    document.getElementById('tdee-target-weight').value = s.tdeeProfile.targetWeight || 70;
    document.getElementById('tdee-height').value = s.tdeeProfile.height || 175;
    document.getElementById('tdee-activity').value = s.tdeeProfile.activity || '1.55';
    document.getElementById('tdee-weekly-rate').value = s.tdeeProfile.weeklyRate || '0.5';
  }

  if (s.reminders) {
    document.getElementById('rem-supp-time').value = s.reminders.suppTime || '10:00';
    document.getElementById('rem-workout-time').value = s.reminders.workoutTime || '18:30';
    document.getElementById('rem-water-enabled').checked = !!s.reminders.waterInterval;
  }

  updateYazioProjectionBanner();
}

function updateYazioProjectionBanner() {
  const banner = document.getElementById('yazio-projection-banner');
  if (!banner) return;
  const w = Number(document.getElementById('tdee-weight')?.value) || 75;
  const tw = Number(document.getElementById('tdee-target-weight')?.value) || 70;
  const rate = Number(document.getElementById('tdee-weekly-rate')?.value) || 0.5;

  const diff = tw - w;
  if (Math.abs(diff) < 0.2) {
    banner.innerHTML = `⚖️ <strong>Objetivo: Mantener tu peso actual (${w} kg)</strong> sin déficit ni superávit.`;
    return;
  }
  const weeks = Math.abs(diff) / rate;
  const targetDate = new Date(Date.now() + weeks * 7 * 86400000);
  const dateFormatted = targetDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  const dailyDelta = Math.round((rate * 7700) / 7);

  if (diff < 0) {
    banner.innerHTML = `🔥 <strong>Meta: Bajar ${Math.abs(diff).toFixed(1)} kg</strong> (${w}kg ➔ ${tw}kg).<br/>Déficit diario: <strong>-${dailyDelta} kcal</strong> • Fecha estimada: <strong style="color:var(--accent);">${dateFormatted}</strong> (~${Math.ceil(weeks)} semanas).`;
  } else {
    banner.innerHTML = `💪 <strong>Meta: Subir ${diff.toFixed(1)} kg de masa</strong> (${w}kg ➔ ${tw}kg).<br/>Superávit diario: <strong>+${Math.round(dailyDelta * 0.7)} kcal</strong> • Fecha estimada: <strong style="color:var(--accent);">${dateFormatted}</strong> (~${Math.ceil(weeks)} semanas).`;
  }
}

function calculateAndApplyTDEE() {
  const sex = document.getElementById('tdee-sex').value;
  const age = Number(document.getElementById('tdee-age').value) || 25;
  const weight = Number(document.getElementById('tdee-weight').value) || 75;
  const targetWeight = Number(document.getElementById('tdee-target-weight').value) || weight;
  const height = Number(document.getElementById('tdee-height').value) || 175;
  const activity = Number(document.getElementById('tdee-activity').value) || 1.55;
  const weeklyRate = Number(document.getElementById('tdee-weekly-rate').value) || 0.5;

  // Mifflin-St Jeor BMR
  const bmr = sex === 'M'
    ? 10 * weight + 6.25 * height - 5 * age + 5
    : 10 * weight + 6.25 * height - 5 * age - 161;

  const tdee = Math.round(bmr * activity);

  // Ajuste calórico estilo Yazio según Peso Meta vs Peso Actual
  let goalDelta = 0;
  const diff = targetWeight - weight;
  const rawDailyDelta = Math.round((weeklyRate * 7700) / 7);
  if (diff < -0.2) {
    goalDelta = -rawDailyDelta;
  } else if (diff > 0.2) {
    goalDelta = Math.round(rawDailyDelta * 0.7);
  }

  const targetKcal = Math.max(1250, tdee + goalDelta);

  // Proteína alta para proteger masa muscular (usando peso objetivo o actual)
  const refWeight = diff < 0 ? Math.max(targetWeight, weight * 0.88) : weight;
  const proteinG = Math.round(refWeight * 2.1);
  const fatG = Math.round(refWeight * 0.85);
  const remainingKcal = Math.max(200, targetKcal - (proteinG * 4 + fatG * 9));
  const carbsG = Math.round(remainingKcal / 4);

  document.getElementById('goal-kcal').value = targetKcal;
  document.getElementById('goal-protein').value = proteinG;
  document.getElementById('goal-carbs').value = carbsG;
  document.getElementById('goal-fat').value = fatG;

  appData.settings.tdeeProfile = {
    sex,
    age,
    startWeight: appData.settings.tdeeProfile?.startWeight || weight,
    weight,
    targetWeight,
    height,
    activity: String(activity),
    weeklyRate: String(weeklyRate)
  };

  updateYazioProjectionBanner();
  saveMacroGoals();
  showToast(`🎯 Plan Yazio activado: ${targetKcal} kcal/día para llegar a ${targetWeight} kg!`);
}

function saveMacroGoals() {
  appData.settings.kcalGoal = Number(document.getElementById('goal-kcal').value) || 2400;
  appData.settings.proteinGoal = Number(document.getElementById('goal-protein').value) || 160;
  appData.settings.carbsGoal = Number(document.getElementById('goal-carbs').value) || 260;
  appData.settings.fatGoal = Number(document.getElementById('goal-fat').value) || 70;
  saveAppData();
  renderAllViews();
  showToast('💾 Metas nutricionales guardadas.');
}

function saveGeminiApiKey() {
  const key = document.getElementById('settings-gemini-key').value.trim();
  const model = document.getElementById('settings-gemini-model')?.value || 'gemini-2.5-flash';
  appData.settings.geminiApiKey = key;
  appData.settings.geminiModel = model;
  saveAppData();
  updateAIKeyStatusBadge();
  showToast(key ? `🔑 Configuración IA (${model}) guardada.` : 'API Key eliminada.');
}

// ============================================================================
// RECORDATORIOS Y NOTIFICACIONES LOCALES (WEB NOTIFICATIONS API)
// ============================================================================

async function requestAndTestNotification() {
  if (!('Notification' in window)) {
    showToast('🔔 Tu navegador actual usa alertas internas con sonido.', '#f59e0b');
    playSound('timer_end');
    return;
  }

  let perm = Notification.permission;
  if (perm !== 'granted') {
    perm = await Notification.requestPermission();
  }

  if (perm === 'granted') {
    sendLocalNotification('🔵🔴 YANBALLIN • Barça Fit', '¡Las notificaciones y recordatorios de La Masia están activos en tu dispositivo!');
    showToast('🔔 ¡Notificación de prueba enviada!');
  } else {
    showToast('⚠️ Permiso de notificación bloqueado en el navegador. Se usarán alertas dentro de la app.', '#f59e0b');
  }
}

function sendLocalNotification(title, bodyText) {
  playSound('timer_end');
  showToast(`🔔 <strong>${escapeHtml(title)}</strong>: ${escapeHtml(bodyText)}`);

  if ('Notification' in window && Notification.permission === 'granted') {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(reg => {
        if (reg && reg.showNotification) {
          reg.showNotification(title, {
            body: bodyText,
            vibrate: [200, 100, 200],
            tag: 'yanballin-reminder-' + Date.now()
          });
        } else {
          new Notification(title, { body: bodyText });
        }
      }).catch(() => {
        new Notification(title, { body: bodyText });
      });
    } else {
      new Notification(title, { body: bodyText });
    }
  }
}

function saveRemindersConfig() {
  appData.settings.reminders = {
    suppTime: document.getElementById('rem-supp-time')?.value || '10:00',
    workoutTime: document.getElementById('rem-workout-time')?.value || '18:30',
    waterInterval: !!document.getElementById('rem-water-enabled')?.checked,
    lastNotifiedKey: appData.settings.reminders?.lastNotifiedKey || ''
  };
  saveAppData();
  showToast('🔔 Horarios de recordatorios guardados.');
}

function startRemindersScheduler() {
  if (reminderInterval) clearInterval(reminderInterval);
  reminderInterval = setInterval(() => {
    const rem = appData.settings.reminders;
    if (!rem) return;

    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const todayKey = `${getTodayISO()}_${hhmm}`;

    if (rem.lastNotifiedKey === todayKey) return;

    if (hhmm === rem.suppTime) {
      rem.lastNotifiedKey = todayKey;
      saveAppData();
      sendLocalNotification('💊 YANBALLIN • Suplementos', 'No olvides tomar tu Creatina (5g) y vitaminas de hoy para mantener tu racha Culé.');
    } else if (hhmm === rem.workoutTime) {
      rem.lastNotifiedKey = todayKey;
      saveAppData();
      sendLocalNotification('⚽ YANBALLIN • Hora de Entrenar', '¡Hora de saltar al campo en el gym o registrar tus comidas del día!');
    } else if (rem.waterInterval && now.getMinutes() === 0 && now.getHours() >= 9 && now.getHours() <= 21 && now.getHours() % 2 === 0) {
      rem.lastNotifiedKey = todayKey;
      saveAppData();
      sendLocalNotification('💧 Hidratación YANBALLIN', 'Toma un vaso de agua (250 ml) y regístralo en tu app.');
    }
  }, 25000);
}

// ============================================================================
// EXPORTAR / IMPORTAR COPIA DE SEGURIDAD JSON
// ============================================================================

function exportBackupJSON() {
  const dataStr = JSON.stringify(appData, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `yanballin_backup_${getTodayISO()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('⬇️ Copia de seguridad de YANBALLIN descargada.');
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
        loadAppData();
        initSettingsInputs();
        renderAllViews();
        showToast('✅ Copia de seguridad restaurada con éxito.');
      } else {
        showToast('❌ El archivo no parece ser un backup válido de YANBALLIN.', '#ef4444');
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
