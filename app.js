/* ==========================================================================
   Awa - Core Application Logic (Bladder & Urine Accumulation Focus)
   ========================================================================== */

class AwaTracker {
  constructor() {
    // Current date state
    this.currentDate = new Date();
    
    // Core App Settings: dailyGoal represents bladderCapacity here (Default: 500ml)
    this.settings = {
      dailyGoal: 500, // Maximum standard bladder capacity in ml
      soundEnabled: true
    };
    
    // Active UI tabs
    this.activeTab = 'timeline';
    
    // Loaded logs for the current active day
    this.logs = [];
    
    // Reference to Chart.js instance
    this.chartInstance = null;
    this.lastChartRenderTime = 0;
    
    // Time simulation properties
    this.simTimeMultiplier = 1;
    this.realStartTime = Date.now();
    this.simStartTime = Date.now();
    
    // Define Drink Types and their bladder filtration ratios & time constants (tau in minutes)
    // Co-factors: alcohol & caffeine are diuretics, so they filter highly (e.g. coffee 90%, beer 95%, cubata 105% due to dehydration)
    // tau defines how fast it absorbs: 15-20m for fast alcohol/diuretics, 40m for pure water, 50m for sugar/protein drinks.
    this.drinkDatabase = {
      agua: { name: 'Agua', ratio: 0.70, icon: 'fa-glass-water', color: '#00b4d8', tau: 40 },
      leche: { name: 'Leche', ratio: 0.50, icon: 'fa-cow', color: '#f5ebe0', tau: 50 },
      cafe: { name: 'Café', ratio: 0.90, icon: 'fa-mug-hot', color: '#6f4e37', tau: 25 },
      te: { name: 'Té', ratio: 0.85, icon: 'fa-leaf', color: '#556b2f', tau: 25 },
      refresco: { name: 'Refresco', ratio: 0.65, icon: 'fa-bottle-water', color: '#e63946', tau: 50 },
      cerveza: { name: 'Cerveza', ratio: 0.95, icon: 'fa-beer-mug-empty', color: '#ffb703', tau: 20 },
      vino: { name: 'Vino', ratio: 1.30, icon: 'fa-wine-glass', color: '#581845', tau: 20 },
      cubata: { name: 'Cubata', ratio: 1.80, icon: 'fa-martini-glass-citrus', color: '#7209b7', tau: 15 }
    };

    // Predefined Urine color levels (Clinical Hydration Indicators)
    this.urineColors = {
      1: { text: "Excelente: Hidratación óptima (orina clara)", class: "text-green", color: "#f7fafc" },
      2: { text: "Buena: Hidratado, todo en orden", class: "text-green", color: "#ffea70" },
      3: { text: "Alerta: Bajo nivel de agua, ¡bebe un vaso!", class: "text-yellow", color: "#f6ad55" },
      4: { text: "Severa: Deshidratado, bebe agua inmediatamente", class: "text-red", color: "#dd6b20" },
      5: { text: "Crítica: Orina extremadamente oscura (consulta médica si persiste)", class: "text-darkred", color: "#8b0000" }
    };

    // Synthesizer Audio Context (Lazy loaded)
    this.audioCtx = null;
    
    // Initialize elements and event handlers
    this.initDOMReferences();
    this.loadSettings();
    this.loadDayLogs();
    this.registerEventListeners();
    this.updateUI();
    
    // Start active real-time ticking for physiological simulation (every 500ms)
    setInterval(() => this.tick(), 500);
  }

  // --- 1. DOM SELECTORS ---
  initDOMReferences() {
    // Header & Navigation
    this.prevDayBtn = document.getElementById('prev-day-btn');
    this.nextDayBtn = document.getElementById('next-day-btn');
    this.currentDateDisplay = document.getElementById('current-date-display');
    this.settingsBtn = document.getElementById('settings-btn');
    
    // Dashboard Stats
    this.bladderVolumeVal = document.getElementById('bladder-volume-val');
    this.bladderStatusBubble = document.getElementById('bladder-status-bubble');
    this.totalIntakeVal = document.getElementById('total-intake-val');
    this.totalOutputVal = document.getElementById('total-output-val');
    
    // Tank elements
    this.bladderPct = document.getElementById('bladder-pct');
    this.bladderProgressText = document.getElementById('bladder-progress-text');
    this.statusDot = document.getElementById('status-dot');
    this.hydrationHealthDesc = document.getElementById('hydration-health-desc');
    this.waveFront = document.getElementById('wave-front');
    this.waveBack = document.getElementById('wave-back');
    
    // Tabs & Timeline
    this.tabTimelineBtn = document.getElementById('tab-timeline-btn');
    this.tabChartBtn = document.getElementById('tab-chart-btn');
    this.tabTimelineContent = document.getElementById('tab-timeline-content');
    this.tabChartContent = document.getElementById('tab-chart-content');
    this.timelineList = document.getElementById('timeline-list');
    
    // Chart stats
    this.avgEfficiencyVal = document.getElementById('avg-efficiency-val');
    this.avgUrineColorVal = document.getElementById('avg-urine-color-val');
    
    // Bottom Sheet: Beber
    this.drinkBottomSheet = document.getElementById('drink-bottom-sheet');
    this.drinkSheetBackdrop = document.getElementById('drink-sheet-backdrop');
    this.triggerDrinkBtn = document.getElementById('trigger-drink-sheet');
    this.closeDrinkSheetBtn = document.getElementById('close-drink-sheet');
    this.drinkVolRange = document.getElementById('drink-vol-range');
    this.customVolDisplay = document.getElementById('custom-vol-display');
    this.drinkCalcWaterVal = document.getElementById('drink-calc-water-val');
    this.saveDrinkBtn = document.getElementById('save-drink-btn');
    
    // Bottom Sheet: Mear
    this.peeBottomSheet = document.getElementById('pee-bottom-sheet');
    this.peeSheetBackdrop = document.getElementById('pee-sheet-backdrop');
    this.triggerPeeBtn = document.getElementById('trigger-pee-sheet');
    this.closePeeSheetBtn = document.getElementById('close-pee-sheet');
    this.peeCalcWaterVal = document.getElementById('pee-calc-water-val');
    this.urineColorFeedback = document.getElementById('urine-color-feedback');
    this.savePeeBtn = document.getElementById('save-pee-btn');
    
    // Settings panel
    this.settingsOverlay = document.getElementById('settings-overlay');
    this.closeSettingsBtn = document.getElementById('close-settings-btn');
    this.dailyGoalInput = document.getElementById('daily-goal-input'); // tracks bladderCapacity
    this.soundEffectsToggle = document.getElementById('sound-effects-toggle');
    this.saveSettingsBtn = document.getElementById('save-settings-btn');
    this.clearAllDataBtn = document.getElementById('clear-all-data-btn');
    this.simulateDataBtn = document.getElementById('simulate-data-btn');

    // Time & Filtration Elements
    this.statusBarTime = document.getElementById('status-bar-time');
    this.timeSpeedSelect = document.getElementById('time-speed-select');
    this.filtrationProgressFill = document.getElementById('filtration-progress-fill');
    this.filtrationProgressText = document.getElementById('filtration-progress-text');
    this.filtrationRateText = document.getElementById('filtration-rate-text');
    this.absorptionEtaText = document.getElementById('absorption-eta-text');
    this.filtrationStatusBadge = document.getElementById('filtration-status-badge');
  }

  // --- 2. STORAGE & DATA MANAGEMENT ---
  
  getDateKey(date = this.currentDate) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  getSimulatedTime() {
    return this.simStartTime + (Date.now() - this.realStartTime) * this.simTimeMultiplier;
  }

  getTargetTime() {
    const todayStr = new Date().toDateString();
    const currentStr = this.currentDate.toDateString();
    if (todayStr === currentStr) {
      return this.getSimulatedTime();
    } else {
      const endOfDay = new Date(this.currentDate);
      endOfDay.setHours(23, 59, 59, 999);
      return endOfDay.getTime();
    }
  }

  filteredAmount(drink, atTime) {
    const elapsedMs = atTime - new Date(drink.timestamp).getTime();
    if (elapsedMs < 0) return 0;
    
    const elapsedMins = elapsedMs / (1000 * 60);
    const drinkName = drink.name.toLowerCase();
    const dbDrink = this.drinkDatabase[drinkName] || { tau: 40 };
    const tau = dbDrink.tau;
    
    return drink.waterEstimate * (1 - Math.exp(-elapsedMins / tau));
  }

  getHydrationStateAt(timeMs) {
    const threeHoursMs = 3 * 60 * 60 * 1000;
    const sixHoursMs = 6 * 60 * 60 * 1000;
    
    let water3h = 0;
    let water6h = 0;
    
    this.logs.forEach(log => {
      if (log.type === 'drink') {
        const logTime = new Date(log.timestamp).getTime();
        if (logTime <= timeMs) {
          if (logTime >= timeMs - threeHoursMs) {
            water3h += log.waterEstimate;
          }
          if (logTime >= timeMs - sixHoursMs) {
            water6h += log.waterEstimate;
          }
        }
      }
    });
    
    if (water6h === 0) {
      return 'none'; // Sin ingestas en las últimas 6 horas -> producción basal detenida (0 ml/min)
    } else if (water3h >= 350) {
      return 'high'; // Muy hidratado -> diuresis activa (3.0 ml/min)
    } else {
      return 'normal'; // Hidratación normal -> producción basal estándar (1.2 ml/min)
    }
  }

  getUrineProductionRateAt(timeMs) {
    const state = this.getHydrationStateAt(timeMs);
    if (state === 'none') return 0.0;
    return state === 'high' ? 3.0 : 1.2;
  }

  getUrineRateAt(timeMs) {
    const hydrationState = this.getHydrationStateAt(timeMs);
    if (hydrationState === 'none') {
      return 0.0;
    }
    
    // Tasa basal (1.2 o 3.0 ml/min)
    const baselineRate = hydrationState === 'high' ? 3.0 : 1.2;
    
    // Sumar tasa de filtración de bebidas activas en este milisegundo
    let drinkRate = 0;
    this.logs.forEach(log => {
      if (log.type === 'drink') {
        const logTime = new Date(log.timestamp).getTime();
        const elapsedMs = timeMs - logTime;
        if (elapsedMs >= 0) {
          const dbDrink = this.drinkDatabase[log.name.toLowerCase()] || { tau: 40 };
          const tau = dbDrink.tau;
          const durationMs = tau * 4.6 * 60 * 1000;
          if (elapsedMs < durationMs) {
            const elapsedMins = elapsedMs / (1000 * 60);
            drinkRate += (log.waterEstimate / tau) * Math.exp(-elapsedMins / tau);
          }
        }
      }
    });
    
    const totalRate = baselineRate + drinkRate;
    
    // CAPAR la tasa total de entrada a la vejiga:
    // Máximo 3.0 ml/min si está muy hidratado o hay bebidas filtrándose.
    // Máximo 1.2 ml/min en hidratación normal.
    const maxAllowedRate = (hydrationState === 'high' || drinkRate > 0.01) ? 3.0 : 1.2;
    
    return Math.min(maxAllowedRate, totalRate);
  }

  computeUrineAccumulationBetween(startTimeMs, endTimeMs) {
    if (endTimeMs <= startTimeMs) return 0;
    
    let totalUrine = 0;
    const stepMs = 5 * 60 * 1000; // Pasos de 5 minutos
    
    for (let t = startTimeMs; t < endTimeMs; t += stepMs) {
      const currentStepEnd = Math.min(endTimeMs, t + stepMs);
      const durationMins = (currentStepEnd - t) / (60 * 1000);
      const rate = this.getUrineRateAt(t);
      totalUrine += rate * durationMins;
    }
    
    return totalUrine;
  }

  computeBladderStateAt(targetTime) {
    const sortedLogs = [...this.logs]
      .filter(log => new Date(log.timestamp).getTime() <= targetTime)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Si no hay registros aún hoy, la vejiga inicia completamente vacía (0 ml)
    if (sortedLogs.length === 0) {
      return 0;
    }

    // Comenzar producción basal a partir del primer registro del día
    let startMs = new Date(sortedLogs[0].timestamp).getTime();
    
    if (targetTime < startMs) {
      startMs = targetTime;
    }
      
    let lastTime = startMs;
    let bladderVolume = 0;
    
    // Recorremos los eventos cronológicamente
    for (let i = 0; i < sortedLogs.length; i++) {
      const log = sortedLogs[i];
      const logTime = new Date(log.timestamp).getTime();
      
      if (logTime > lastTime) {
        // Sumar producción basal y filtración acumulada con el límite (cap) aplicado
        bladderVolume += this.computeUrineAccumulationBetween(lastTime, logTime);
      }
      
      // Aplicar el evento de meada (pee)
      if (log.type === 'pee') {
        bladderVolume = Math.max(0, bladderVolume - log.volume);
      }
      
      lastTime = Math.max(lastTime, logTime);
    }
    
    // Sumar el remanente hasta el tiempo objetivo (targetTime)
    if (targetTime > lastTime) {
      bladderVolume += this.computeUrineAccumulationBetween(lastTime, targetTime);
    }
    
    return Math.max(0, bladderVolume);
  }

  tick() {
    const todayStr = new Date().toDateString();
    const currentStr = this.currentDate.toDateString();
    if (todayStr !== currentStr) return;

    const nowSim = this.getSimulatedTime();

    // 1. Update status bar virtual clock
    const simDate = new Date(nowSim);
    const hrs = String(simDate.getHours()).padStart(2, '0');
    const mins = String(simDate.getMinutes()).padStart(2, '0');
    if (this.statusBarTime) {
      this.statusBarTime.textContent = `${hrs}:${mins}`;
    }

    // 2. Compute bladder volume
    const bladderVol = this.computeBladderStateAt(nowSim);
    const bladderCapacity = this.settings.dailyGoal;

    // 3. Update Bladder Volume Display
    if (this.bladderVolumeVal) {
      this.bladderVolumeVal.innerHTML = `${bladderVol.toFixed(1)} <span class="unit">ml</span>`;
    }

    // 4. Update Bladder Status Bubble & Hydration Health Desc
    this.updateBladderStatus(bladderVol, bladderCapacity);

    // 5. Update Tank Sphere
    const bladderPctVal = Math.round((bladderVol / bladderCapacity) * 100);
    if (this.bladderPct) {
      this.bladderPct.textContent = `${bladderPctVal}%`;
    }
    if (this.bladderProgressText) {
      this.bladderProgressText.textContent = `${bladderVol.toFixed(0)} / ${bladderCapacity} ml`;
    }

    const waveTranslate = 100 - Math.min(100, bladderPctVal);
    if (this.waveFront) {
      this.waveFront.style.transform = `translateY(${waveTranslate}%)`;
    }
    if (this.waveBack) {
      this.waveBack.style.transform = `translateY(${Math.max(0, waveTranslate - 3)}%)`;
    }

    const fillRatio = Math.min(1.0, bladderVol / bladderCapacity);
    const hue = 48 - (12 * fillRatio);
    const lightness = 70 - (22 * fillRatio);
    const waveColor = `hsl(${hue}, 100%, ${lightness}%)`;
    const backWaveColor = `hsl(${hue - 6}, 100%, ${lightness - 12}%)`;

    if (this.waveFront) this.waveFront.style.fill = waveColor;
    if (this.waveBack) this.waveBack.style.fill = backWaveColor;

    const sphereBox = document.querySelector('.liquid-sphere');
    if (sphereBox) {
      if (fillRatio >= 1.0) {
        sphereBox.style.borderColor = "var(--color-danger)";
        sphereBox.style.boxShadow = "inset 0 0 25px rgba(230, 57, 70, 0.4), 0 0 15px rgba(230, 57, 70, 0.3)";
      } else if (fillRatio >= 0.75) {
        sphereBox.style.borderColor = "var(--color-warning)";
        sphereBox.style.boxShadow = "inset 0 0 20px rgba(255, 183, 3, 0.25), 0 0 10px rgba(255, 183, 3, 0.15)";
      } else {
        sphereBox.style.borderColor = "rgba(255, 209, 102, 0.2)";
        sphereBox.style.boxShadow = "inset 0 0 20px rgba(0, 0, 0, 0.7)";
      }
    }

    // 6. Update Kidney Filtration Panel
    let totalWaterIntake = 0;
    let totalFilteredVolume = 0;
    let rate = 0;
    let maxEtaMins = 0;

    this.logs.forEach(log => {
      if (log.type === 'drink') {
        totalWaterIntake += log.waterEstimate;
        const filtered = this.filteredAmount(log, nowSim);
        totalFilteredVolume += filtered;

        const elapsedMs = nowSim - new Date(log.timestamp).getTime();
        const dbDrink = this.drinkDatabase[log.name.toLowerCase()] || { tau: 40 };
        const tau = dbDrink.tau;
        const durationMs = tau * 4.6 * 60 * 1000;

        if (elapsedMs >= 0) {
          const elapsedMins = elapsedMs / (1000 * 60);
          rate += (log.waterEstimate / tau) * Math.exp(-elapsedMins / tau);

          if (elapsedMs < durationMs) {
            const remainingMs = durationMs - elapsedMs;
            const remainingMins = Math.ceil(remainingMs / (1000 * 60));
            if (remainingMins > maxEtaMins) {
              maxEtaMins = remainingMins;
            }
          }
        }
      }
    });

    const remainingToFilter = Math.max(0, totalWaterIntake - totalFilteredVolume);
    const pct = totalWaterIntake > 0 ? (totalFilteredVolume / totalWaterIntake) * 100 : 100;

    if (this.filtrationProgressFill) {
      this.filtrationProgressFill.style.width = `${pct}%`;
    }

    const badge = this.filtrationStatusBadge;
    const spinner = document.querySelector('.filtration-spinner');

    const baselineRate = this.getUrineProductionRateAt(nowSim);
    const totalRate = this.getUrineRateAt(nowSim);

    if (remainingToFilter > 0.1 && rate > 0.01) {
      if (badge) {
        badge.textContent = "Filtrando";
        badge.className = "filtration-status filtering";
      }
      if (spinner) {
        spinner.classList.add('active');
      }
      if (this.filtrationProgressText) {
        this.filtrationProgressText.textContent = `Procesando: ${totalFilteredVolume.toFixed(0)} / ${totalWaterIntake.toFixed(0)} ml`;
      }
      if (this.filtrationRateText) {
        this.filtrationRateText.textContent = `Filtrando a +${totalRate.toFixed(1)} ml/min (Basal: +${baselineRate.toFixed(1)})`;
      }
      if (this.absorptionEtaText) {
        this.absorptionEtaText.textContent = `ETA: ${maxEtaMins} min`;
      }
    } else {
      if (badge) {
        badge.textContent = "Estable";
        badge.className = "filtration-status";
      }
      if (spinner) {
        spinner.classList.remove('active');
      }
      if (this.filtrationProgressText) {
        this.filtrationProgressText.textContent = "Todo procesado";
      }
      if (this.filtrationRateText) {
        this.filtrationRateText.textContent = `Producción basal: +${baselineRate.toFixed(1)} ml/min`;
      }
      if (this.absorptionEtaText) {
        this.absorptionEtaText.textContent = "--";
      }
    }

    // 7. Throttled Chart rendering (once every 3 seconds)
    if (this.activeTab === 'chart' && (Date.now() - this.lastChartRenderTime > 3000)) {
      this.renderChart();
      this.lastChartRenderTime = Date.now();
    }
  }

  loadSettings() {
    const saved = localStorage.getItem('awa_settings');
    if (saved) {
      try {
        this.settings = JSON.parse(saved);
        // Fallback for bladderCapacity renaming compatibility
        if (!this.settings.dailyGoal) this.settings.dailyGoal = 500;
        this.dailyGoalInput.value = this.settings.dailyGoal;
        this.soundEffectsToggle.checked = this.settings.soundEnabled;
      } catch (e) {
        console.error("Error loading settings", e);
      }
    }
    // Set simulator select value
    if (this.timeSpeedSelect) {
      this.timeSpeedSelect.value = this.simTimeMultiplier.toString();
    }
  }

  saveSettings() {
    this.settings.dailyGoal = parseInt(this.dailyGoalInput.value) || 500;
    this.settings.soundEnabled = this.soundEffectsToggle.checked;
    localStorage.setItem('awa_settings', JSON.stringify(this.settings));
    this.closeModal(this.settingsOverlay);
    this.updateUI();
    this.playAudioSynth('settings');
  }

  loadDayLogs() {
    const key = this.getDateKey();
    const savedLogs = localStorage.getItem(`awa_logs_${key}`);
    if (savedLogs) {
      try {
        this.logs = JSON.parse(savedLogs);
      } catch (e) {
        this.logs = [];
        console.error("Error loading logs", e);
      }
    } else {
      this.logs = [];
    }
  }

  saveDayLogs() {
    const key = this.getDateKey();
    localStorage.setItem(`awa_logs_${key}`, JSON.stringify(this.logs));
    this.updateUI();
  }

  // Add Log Entry
  addLog(type, name, volume, optionals = {}) {
    let ratio = 1.0;
    let waterEstimate = volume;
    
    if (type === 'drink') {
      const dbDrink = this.drinkDatabase[name.toLowerCase()];
      ratio = dbDrink ? dbDrink.ratio : 0.70;
      waterEstimate = Math.round(volume * ratio); // filters this volume to the bladder
    } else if (type === 'pee') {
      ratio = 1.0; // Directly empties bladder
      waterEstimate = volume;
    }

    const newLog = {
      id: Date.now().toString(),
      type,
      name,
      volume,
      waterRatio: ratio,
      waterEstimate,
      timestamp: new Date(this.getSimulatedTime()).toISOString(),
      ...optionals
    };

    this.logs.push(newLog);
    this.logs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    this.saveDayLogs();
    
    if (type === 'drink') {
      this.playAudioSynth('drink');
    } else if (type === 'pee') {
      this.playAudioSynth('pee');
    }
  }

  deleteLog(id) {
    this.logs = this.logs.filter(log => log.id !== id);
    this.saveDayLogs();
    this.playAudioSynth('delete');
  }

  // --- 3. SYNTHESIZED WEB AUDIO EFFECTS ---
  initAudio() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  playAudioSynth(type) {
    if (!this.settings.soundEnabled) return;
    
    try {
      this.initAudio();
      const now = this.audioCtx.currentTime;
      
      if (type === 'drink') {
        const notes = [200, 260, 320, 480];
        notes.forEach((freq, idx) => {
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();
          
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.08);
          osc.frequency.exponentialRampToValueAtTime(freq * 1.35, now + idx * 0.08 + 0.07);
          
          gain.gain.setValueAtTime(0, now + idx * 0.08);
          gain.gain.linearRampToValueAtTime(0.12, now + idx * 0.08 + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.07);
          
          osc.connect(gain);
          gain.connect(this.audioCtx.destination);
          
          osc.start(now + idx * 0.08);
          osc.stop(now + idx * 0.08 + 0.08);
        });
      } 
      else if (type === 'pee') {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(750, now);
        osc.frequency.linearRampToValueAtTime(320, now + 0.4);
        
        gain.gain.setValueAtTime(0.07, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.45);

        const bufferSize = this.audioCtx.sampleRate * 0.4;
        const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        
        const noiseNode = this.audioCtx.createBufferSource();
        noiseNode.buffer = buffer;
        
        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(900, now);
        filter.frequency.exponentialRampToValueAtTime(250, now + 0.35);

        const noiseGain = this.audioCtx.createGain();
        noiseGain.gain.setValueAtTime(0.05, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        noiseNode.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.audioCtx.destination);

        noiseNode.start(now);
        noiseNode.stop(now + 0.4);
      } 
      else if (type === 'delete') {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(280, now);
        osc.frequency.exponentialRampToValueAtTime(90, now + 0.1);
        
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.12);
      } 
      else if (type === 'settings' || type === 'click') {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now); // D5
        
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.06);
      }
    } catch (e) {
      console.warn("Audio failure", e);
    }
  }

  // --- 4. RENDER & CALCULATIONS ---

  updateUI() {
    // 4.1 Update Date Displays
    const todayStr = new Date().toDateString();
    const currentStr = this.currentDate.toDateString();
    const isToday = (todayStr === currentStr);
    
    if (isToday) {
      this.currentDateDisplay.textContent = 'Hoy';
      this.nextDayBtn.disabled = true;
    } else {
      this.currentDateDisplay.textContent = this.currentDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
      this.nextDayBtn.disabled = false;
    }

    // 4.2 Compute Bladder Fluid Accumulation physiologically
    let totalFluidIntake = 0;
    let totalFluidPee = 0;
    
    this.logs.forEach(log => {
      if (log.type === 'drink') {
        totalFluidIntake += log.volume;
      } else if (log.type === 'pee') {
        totalFluidPee += log.volume;
      }
    });

    const targetTime = this.getTargetTime();
    const bladderVol = this.computeBladderStateAt(targetTime);
    const bladderCapacity = this.settings.dailyGoal;
    
    // Update Stats Display
    this.totalIntakeVal.textContent = `${totalFluidIntake} ml`;
    this.totalOutputVal.textContent = `${totalFluidPee} ml`;
    
    const displayBladderVolText = isToday ? bladderVol.toFixed(1) : Math.round(bladderVol).toString();
    this.bladderVolumeVal.innerHTML = `${displayBladderVolText} <span class="unit">ml</span>`;

    // 4.3 Update Bladder urges state bubble
    this.updateBladderStatus(bladderVol, bladderCapacity);

    // 4.4 Update Fluid Tank Sphere level & dynamic color concentration
    const bladderPctVal = Math.round((bladderVol / bladderCapacity) * 100);
    if (this.bladderPct) {
      this.bladderPct.textContent = `${bladderPctVal}%`;
    }
    if (this.bladderProgressText) {
      this.bladderProgressText.textContent = `${isToday ? bladderVol.toFixed(0) : Math.round(bladderVol)} / ${bladderCapacity} ml`;
    }

    // Wave translation math
    const waveTranslate = 100 - Math.min(100, bladderPctVal);
    if (this.waveFront) {
      this.waveFront.style.transform = `translateY(${waveTranslate}%)`;
    }
    if (this.waveBack) {
      this.waveBack.style.transform = `translateY(${Math.max(0, waveTranslate - 3)}%)`;
    }

    // Visual Color shifting!
    const fillRatio = Math.min(1.0, bladderVol / bladderCapacity);
    const hue = 48 - (12 * fillRatio);
    const lightness = 70 - (22 * fillRatio);
    const waveColor = `hsl(${hue}, 100%, ${lightness}%)`;
    const backWaveColor = `hsl(${hue - 6}, 100%, ${lightness - 12}%)`;
    
    if (this.waveFront) this.waveFront.style.fill = waveColor;
    if (this.waveBack) this.waveBack.style.fill = backWaveColor;
    
    // Border of the sphere glows
    const sphereBox = document.querySelector('.liquid-sphere');
    if (sphereBox) {
      if (fillRatio >= 1.0) {
        sphereBox.style.borderColor = "var(--color-danger)";
        sphereBox.style.boxShadow = "inset 0 0 25px rgba(230, 57, 70, 0.4), 0 0 15px rgba(230, 57, 70, 0.3)";
      } else if (fillRatio >= 0.75) {
        sphereBox.style.borderColor = "var(--color-warning)";
        sphereBox.style.boxShadow = "inset 0 0 20px rgba(255, 183, 3, 0.25), 0 0 10px rgba(255, 183, 3, 0.15)";
      } else {
        sphereBox.style.borderColor = "rgba(255, 209, 102, 0.2)";
        sphereBox.style.boxShadow = "inset 0 0 20px rgba(0, 0, 0, 0.7)";
      }
    }

    // 4.5 Timeline Rendering
    this.renderTimeline();

    // 4.6 Charts Rendering
    this.renderChart();

    // 4.7 Update averages
    this.updateAverages(totalFluidIntake);
  }

  updateBladderStatus(displayBladderVol, bladderCapacity) {
    const ratio = displayBladderVol / bladderCapacity;
    let statusClass = 'green';
    let statusBubbleText = 'Vejiga vacía y cómoda';
    let advisorText = 'Todo excelente. Tu vejiga está descargada.';

    if (ratio >= 1.0) {
      statusClass = 'red';
      statusBubbleText = '¡VEJIGA CRÍTICA! Ve al baño';
      advisorText = 'Presión extrema. ¡Micciona de inmediato!';
      this.bladderStatusBubble.style.animation = "logo-pulse 1s infinite alternate";
    } else if (ratio >= 0.75) {
      statusClass = 'yellow';
      statusBubbleText = 'Vejiga Llena - Ganas Moderadas';
      advisorText = 'Vejiga cargada. Buen momento para orinar.';
      this.bladderStatusBubble.style.animation = "none";
    } else if (ratio >= 0.35) {
      statusClass = 'green';
      statusBubbleText = 'Llenado Inicial - Ganas Leves';
      advisorText = 'Comienzas a acumular orina. Cómodo.';
      this.bladderStatusBubble.style.animation = "none";
    } else {
      statusClass = 'green';
      statusBubbleText = 'Vejiga confortable';
      advisorText = 'Vejiga libre de presión.';
      this.bladderStatusBubble.style.animation = "none";
    }

    this.bladderStatusBubble.textContent = statusBubbleText;
    
    // Stylize status bubble according to urge
    if (statusClass === 'red') {
      this.bladderStatusBubble.style.color = "var(--color-danger)";
      this.bladderStatusBubble.style.borderColor = "rgba(230, 57, 70, 0.3)";
      this.bladderStatusBubble.style.backgroundColor = "rgba(230, 57, 70, 0.08)";
    } else if (statusClass === 'yellow') {
      this.bladderStatusBubble.style.color = "var(--color-secondary)";
      this.bladderStatusBubble.style.borderColor = "rgba(255, 183, 3, 0.25)";
      this.bladderStatusBubble.style.backgroundColor = "rgba(255, 183, 3, 0.05)";
    } else {
      this.bladderStatusBubble.style.color = "var(--color-success)";
      this.bladderStatusBubble.style.borderColor = "rgba(46, 196, 182, 0.15)";
      this.bladderStatusBubble.style.backgroundColor = "rgba(46, 196, 182, 0.03)";
    }

    this.statusDot.className = `status-dot ${statusClass}`;
    this.hydrationHealthDesc.textContent = advisorText;
  }

  renderTimeline() {
    this.timelineList.innerHTML = '';
    
    if (this.logs.length === 0) {
      this.timelineList.innerHTML = `
        <div class="empty-timeline-state">
          <i class="fa-solid fa-circle-info"></i>
          <p>No hay registros el día de hoy.<br>¡Comienza añadiendo agua o pipí!</p>
        </div>`;
      return;
    }

    const reversedLogs = [...this.logs].reverse();

    reversedLogs.forEach(log => {
      const itemCard = document.createElement('div');
      itemCard.className = `timeline-item ${log.type === 'drink' ? 'item-drink' : 'item-pee'}`;
      
      const timeStr = new Date(log.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
      
      if (log.type === 'drink') {
        const dbDrink = this.drinkDatabase[log.name.toLowerCase()] || { icon: 'fa-glass-water', color: '#00b4d8' };
        itemCard.innerHTML = `
          <div class="item-left">
            <div class="item-icon" style="--card-color: ${dbDrink.color}"><i class="fa-solid ${dbDrink.icon}"></i></div>
            <div class="item-details">
              <span class="item-title">${log.name}</span>
              <span class="item-meta">${timeStr} · A Vejiga: <span class="water-est">+${log.waterEstimate}ml</span></span>
            </div>
          </div>
          <div class="item-right">
            <span class="item-value">+${log.volume}ml</span>
            <button class="delete-log-btn" data-id="${log.id}" title="Eliminar"><i class="fa-solid fa-trash-can"></i></button>
          </div>
        `;
      } else {
        const colorBubble = this.urineColors[log.colorIdx || 1].color;
        itemCard.innerHTML = `
          <div class="item-left">
            <div class="item-icon"><i class="fa-solid fa-toilet"></i></div>
            <div class="item-details">
              <span class="item-title">Micción ${log.name}</span>
              <span class="item-meta">${timeStr} · Vaciado Vejiga: <span class="water-est" style="color: var(--color-warning);">${log.volume}ml</span></span>
            </div>
          </div>
          <div class="item-right">
            <span class="item-value" style="display: flex; align-items: center; gap: 8px;">
              -${log.volume}ml
              <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: ${colorBubble}; border: 1px solid var(--border-glass);"></span>
            </span>
            <button class="delete-log-btn" data-id="${log.id}" title="Eliminar"><i class="fa-solid fa-trash-can"></i></button>
          </div>
        `;
      }

      itemCard.querySelector('.delete-log-btn').addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        this.deleteLog(id);
      });

      this.timelineList.appendChild(itemCard);
    });
  }

  updateAverages(totalFluidIntake) {
    if (this.logs.length === 0) {
      this.avgEfficiencyVal.textContent = '-- %';
      this.avgUrineColorVal.textContent = '--';
      return;
    }

    let totalIntakeVolume = 0;
    let totalIntakeUrineFiltered = 0;
    let totalPeeColorScore = 0;
    let peeCount = 0;

    this.logs.forEach(log => {
      if (log.type === 'drink') {
        totalIntakeVolume += log.volume;
        totalIntakeUrineFiltered += log.waterEstimate;
      } else if (log.type === 'pee') {
        totalPeeColorScore += log.colorIdx || 1;
        peeCount++;
      }
    });

    const retention = totalIntakeVolume > 0 ? Math.round((totalIntakeUrineFiltered / totalIntakeVolume) * 100) : 100;
    this.avgEfficiencyVal.textContent = `${retention}%`;

    if (peeCount > 0) {
      const avgColorIdx = Math.round(totalPeeColorScore / peeCount);
      let colorDesc = 'Óptimo';
      if (avgColorIdx === 2) colorDesc = 'Bueno';
      if (avgColorIdx === 3) colorDesc = 'Alerta';
      if (avgColorIdx === 4) colorDesc = 'Severo';
      if (avgColorIdx === 5) colorDesc = 'Crítico';
      this.avgUrineColorVal.textContent = colorDesc;
      
      let indicatorColor = "#2ec4b6"; // green
      if (avgColorIdx === 3) indicatorColor = "var(--color-warning)";
      if (avgColorIdx >= 4) indicatorColor = "var(--color-danger)";
      this.avgUrineColorVal.style.color = indicatorColor;
    } else {
      this.avgUrineColorVal.textContent = 'Ninguno';
      this.avgUrineColorVal.style.color = '#fff';
    }
  }

  // --- 5. CHART.JS CUMULATIVE BLADDER PLOT ---
  renderChart() {
    if (this.activeTab !== 'chart') return;
    
    const canvas = document.getElementById('hydration-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    if (this.chartInstance) {
      this.chartInstance.destroy();
    }

    const todayStr = new Date().toDateString();
    const currentStr = this.currentDate.toDateString();
    const isToday = (todayStr === currentStr);
    
    const startOfDay = new Date(this.currentDate);
    startOfDay.setHours(0, 0, 0, 0);
    const startMs = startOfDay.getTime();
    
    const targetTime = this.getTargetTime();
    
    // Generate sample timestamps
    let timestamps = [];
    
    // 1. Every 30 minutes from startMs to targetTime
    const interval = 30 * 60 * 1000; // 30 mins
    for (let t = startMs; t <= targetTime; t += interval) {
      timestamps.push(t);
    }
    
    // Always include start and end
    timestamps.push(startMs);
    timestamps.push(targetTime);
    
    // 2. For each log, add just before and just after
    this.logs.forEach(log => {
      const logMs = new Date(log.timestamp).getTime();
      if (logMs >= startMs && logMs <= targetTime) {
        timestamps.push(logMs - 1000); // 1 sec before
        timestamps.push(logMs + 1000); // 1 sec after
      }
    });
    
    // Sort and filter
    timestamps = [...new Set(timestamps)]
      .filter(t => t >= startMs && t <= targetTime)
      .sort((a, b) => a - b);
      
    let data = [];
    let labels = [];
    
    timestamps.forEach(t => {
      const vol = this.computeBladderStateAt(t);
      data.push(vol);
      
      const d = new Date(t);
      const hrs = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      labels.push(`${hrs}:${mins}`);
    });

    // Liquid yellow urine gradient fill for bladder curve
    const gradient = ctx.createLinearGradient(0, 0, 0, 160);
    gradient.addColorStop(0, 'rgba(255, 183, 3, 0.4)');
    gradient.addColorStop(1, 'rgba(255, 183, 3, 0.0)');

    this.chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Orina en Vejiga (ml)',
          data: data,
          borderColor: '#ffb703',
          borderWidth: 3,
          pointBackgroundColor: '#ffb703',
          pointHoverRadius: 6,
          pointRadius: data.length > 30 ? 0 : 2,
          fill: true,
          backgroundColor: gradient,
          tension: 0.25,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function(context) {
                return `Vejiga: ${context.parsed.y.toFixed(1)} ml`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.04)', drawBorder: false },
            ticks: { 
              color: '#a0aec0', 
              font: { family: 'Outfit', size: 9 },
              maxTicksLimit: 8
            }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.04)', drawBorder: false },
            ticks: { color: '#a0aec0', font: { family: 'Outfit', size: 9 } },
            min: 0,
            max: Math.max(this.settings.dailyGoal, Math.max(...data) * 1.1)
          }
        }
      }
    });
  }

  // --- 6. SHEET DRAWER INTERACTIONS (MODALS) ---
  openModal(modalElement) {
    modalElement.classList.add('open');
    this.playAudioSynth('click');
  }

  closeModal(modalElement) {
    modalElement.classList.remove('open');
  }

  // --- 7. EVENT LISTENERS ---
  registerEventListeners() {
    
    // --- 7.1 Day Navigation ---
    this.prevDayBtn.addEventListener('click', () => {
      this.currentDate.setDate(this.currentDate.getDate() - 1);
      this.loadDayLogs();
      this.updateUI();
      this.playAudioSynth('click');
    });

    this.nextDayBtn.addEventListener('click', () => {
      const today = new Date().toDateString();
      if (this.currentDate.toDateString() !== today) {
        this.currentDate.setDate(this.currentDate.getDate() + 1);
        this.loadDayLogs();
        this.updateUI();
        this.playAudioSynth('click');
      }
    });

    // --- 7.2 Tabs Selector ---
    this.tabTimelineBtn.addEventListener('click', () => {
      this.activeTab = 'timeline';
      this.tabTimelineBtn.classList.add('active');
      this.tabChartBtn.classList.remove('active');
      this.tabTimelineContent.classList.add('active');
      this.tabChartContent.classList.remove('active');
      this.playAudioSynth('click');
    });

    this.tabChartBtn.addEventListener('click', () => {
      this.activeTab = 'chart';
      this.tabChartBtn.classList.add('active');
      this.tabTimelineBtn.classList.remove('active');
      this.tabChartContent.classList.add('active');
      this.tabTimelineContent.classList.remove('active');
      this.renderChart();
      this.playAudioSynth('click');
    });

    // --- 7.3 Settings Modal triggers ---
    this.settingsBtn.addEventListener('click', () => this.openModal(this.settingsOverlay));
    this.closeSettingsBtn.addEventListener('click', () => this.closeModal(this.settingsOverlay));
    
    this.saveSettingsBtn.addEventListener('click', () => this.saveSettings());
    
    this.clearAllDataBtn.addEventListener('click', () => {
      if (confirm('¿Seguro que deseas eliminar TODOS tus registros históricos? Esta acción es irreversible.')) {
        localStorage.clear();
        this.currentDate = new Date();
        this.loadSettings();
        this.loadDayLogs();
        this.updateUI();
        this.closeModal(this.settingsOverlay);
        this.playAudioSynth('delete');
      }
    });

    this.simulateDataBtn.addEventListener('click', () => {
      this.simulatePastLogs();
      this.closeModal(this.settingsOverlay);
    });

    // --- 7.4 Bottom Sheets: Open/Close ---
    this.triggerDrinkBtn.addEventListener('click', () => this.openModal(this.drinkBottomSheet));
    this.closeDrinkSheetBtn.addEventListener('click', () => this.closeModal(this.drinkBottomSheet));
    this.drinkSheetBackdrop.addEventListener('click', () => this.closeModal(this.drinkBottomSheet));

    this.triggerPeeBtn.addEventListener('click', () => this.openModal(this.peeBottomSheet));
    this.closePeeSheetBtn.addEventListener('click', () => this.closeModal(this.peeBottomSheet));
    this.peeSheetBackdrop.addEventListener('click', () => this.closeModal(this.peeBottomSheet));

    // --- 7.5 Drink Card Grid Selection ---
    const drinkCards = document.querySelectorAll('.drink-item-card');
    drinkCards.forEach(card => {
      card.addEventListener('click', (e) => {
        drinkCards.forEach(c => c.classList.remove('active'));
        const currentCard = e.currentTarget;
        currentCard.classList.add('active');
        
        this.updateDrinkWaterEstimation();
        this.playAudioSynth('click');
      });
    });

    // Preset volumes buttons
    const presetVolBtns = document.querySelectorAll('.preset-vol-btn');
    presetVolBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        presetVolBtns.forEach(b => b.classList.remove('active'));
        const currentBtn = e.currentTarget;
        currentBtn.classList.add('active');
        
        const vol = currentBtn.getAttribute('data-vol');
        this.drinkVolRange.value = vol;
        this.customVolDisplay.textContent = `${vol} ml`;
        
        this.updateDrinkWaterEstimation();
        this.playAudioSynth('click');
      });
    });

    // Custom slider volume drag
    this.drinkVolRange.addEventListener('input', (e) => {
      presetVolBtns.forEach(b => b.classList.remove('active'));
      const val = e.target.value;
      this.customVolDisplay.textContent = `${val} ml`;
      this.updateDrinkWaterEstimation();
    });

    // Save Drink Log Trigger
    this.saveDrinkBtn.addEventListener('click', () => {
      const activeCard = document.querySelector('.drink-item-card.active');
      if (!activeCard) return;

      const drinkName = activeCard.querySelector('.drink-name').textContent;
      const totalVolume = parseInt(this.drinkVolRange.value);

      this.addLog('drink', drinkName, totalVolume);
      this.closeModal(this.drinkBottomSheet);
    });

    // --- 7.6 Pee Selection Sheet ---
    const sizeCards = document.querySelectorAll('.size-card');
    sizeCards.forEach(card => {
      card.addEventListener('click', (e) => {
        sizeCards.forEach(c => c.classList.remove('active'));
        const currentCard = e.currentTarget;
        currentCard.classList.add('active');
        
        this.updatePeeWaterEstimation();
        this.playAudioSynth('click');
      });
    });

    const colorBtns = document.querySelectorAll('.color-btn');
    colorBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        colorBtns.forEach(b => b.classList.remove('active'));
        const currentBtn = e.currentTarget;
        currentBtn.classList.add('active');
        
        const idx = currentBtn.getAttribute('data-color-idx');
        const feedback = this.urineColors[idx];
        
        this.urineColorFeedback.textContent = feedback.text;
        this.urineColorFeedback.className = `color-feedback-text ${feedback.class}`;
        
        this.playAudioSynth('click');
      });
    });

    // Save Pee Log Trigger
    this.savePeeBtn.addEventListener('click', () => {
      const activeSizeCard = document.querySelector('.size-card.active');
      const activeColorBtn = document.querySelector('.color-btn.active');
      
      if (!activeSizeCard || !activeColorBtn) return;

      const peeName = activeSizeCard.querySelector('.size-name').textContent;
      const totalVolume = parseInt(activeSizeCard.getAttribute('data-vol'));
      const colorIdx = parseInt(activeColorBtn.getAttribute('data-color-idx'));

      this.addLog('pee', peeName, totalVolume, { colorIdx });
      this.closeModal(this.peeBottomSheet);
    });

    // Time speed simulation select listener
    if (this.timeSpeedSelect) {
      this.timeSpeedSelect.addEventListener('change', () => {
        const currentSim = this.getSimulatedTime();
        this.simStartTime = currentSim;
        this.realStartTime = Date.now();
        this.simTimeMultiplier = parseFloat(this.timeSpeedSelect.value);
        this.playAudioSynth('click');
      });
    }
  }

  updateDrinkWaterEstimation() {
    const activeCard = document.querySelector('.drink-item-card.active');
    if (!activeCard) return;

    const ratio = parseFloat(activeCard.getAttribute('data-ratio'));
    const vol = parseInt(this.drinkVolRange.value);
    
    const waterEst = Math.round(vol * ratio);
    this.drinkCalcWaterVal.textContent = waterEst;
  }

  updatePeeWaterEstimation() {
    const activeCard = document.querySelector('.size-card.active');
    if (!activeCard) return;

    const vol = parseInt(activeCard.getAttribute('data-vol'));
    this.peeCalcWaterVal.textContent = vol; // directly subtracts this amount from bladder
  }

  // --- 8. CLINICAL/DEV SIMULATION GENERATOR ---
  simulatePastLogs() {
    const key = this.getDateKey();
    const now = new Date();
    
    const atTime = (hours, minutes) => {
      const d = new Date(now);
      d.setHours(hours, minutes, 0, 0);
      return d.toISOString();
    };

    // Establishes a simulated sequence of bladder rise and fall
    const simulatedLogs = [
      {
        id: "sim-1",
        type: "drink",
        name: "Café",
        volume: 150,
        waterRatio: 0.90, // filters 135ml to bladder
        waterEstimate: 135,
        timestamp: atTime(8, 15)
      },
      {
        id: "sim-2",
        type: "drink",
        name: "Agua",
        volume: 330,
        waterRatio: 0.70, // filters 231ml to bladder (Total bladder = 366ml)
        waterEstimate: 231,
        timestamp: atTime(9, 30)
      },
      {
        id: "sim-3",
        type: "pee",
        name: "Mediana",
        volume: 300, // empties 300ml (Total bladder = 66ml)
        waterRatio: 1.0,
        waterEstimate: 300,
        timestamp: atTime(10, 45),
        colorIdx: 2
      },
      {
        id: "sim-4",
        type: "drink",
        name: "Agua",
        volume: 500,
        waterRatio: 0.70, // filters 350ml to bladder (Total bladder = 416ml)
        waterEstimate: 350,
        timestamp: atTime(12, 10)
      },
      {
        id: "sim-5",
        type: "drink",
        name: "Leche",
        volume: 250,
        waterRatio: 0.50, // filters 125ml (Total bladder = 541ml - Urge!)
        waterEstimate: 125,
        timestamp: atTime(14, 0)
      },
      {
        id: "sim-6",
        type: "pee",
        name: "Grande",
        volume: 500, // empties 500ml (Total bladder = 41ml)
        waterRatio: 1.0,
        waterEstimate: 500,
        timestamp: atTime(15, 30),
        colorIdx: 1
      },
      {
        id: "sim-7",
        type: "drink",
        name: "Cerveza",
        volume: 330,
        waterRatio: 0.95, // filters 313ml to bladder (Total bladder = 354ml)
        waterEstimate: 313,
        timestamp: atTime(18, 0)
      },
      {
        id: "sim-8",
        type: "drink",
        name: "Agua",
        volume: 250,
        waterRatio: 0.70, // filters 175ml (Total bladder = 529ml - Urge!)
        waterEstimate: 175,
        timestamp: atTime(20, 15)
      },
      {
        id: "sim-9",
        type: "pee",
        name: "Mediana",
        volume: 300, // empties 300ml (Total bladder = 229ml)
        waterRatio: 1.0,
        waterEstimate: 300,
        timestamp: atTime(21, 30),
        colorIdx: 2
      }
    ];

    const currentHour = now.getHours();
    this.logs = simulatedLogs.filter(log => {
      const logHour = new Date(log.timestamp).getHours();
      return logHour <= currentHour;
    });

    if (this.logs.length === 0) {
      this.logs = simulatedLogs.slice(0, 3);
    }

    localStorage.setItem(`awa_logs_${key}`, JSON.stringify(this.logs));
    this.updateUI();
    this.playAudioSynth('drink');
    alert("¡Se ha generado un historial de demostración de vejiga activa!");
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.AwaApp = new AwaTracker();

  // Registrar Service Worker para soporte PWA e instalabilidad
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('Awa Service Worker registrado con éxito:', reg.scope))
        .catch(err => console.warn('Fallo al registrar el Service Worker:', err));
    });
  }
});
