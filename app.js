document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const transportSelect = document.getElementById('transport-select');
    const speedRange = document.getElementById('speed-range');
    const brightnessRange = document.getElementById('brightness-range');
    const noiseRange = document.getElementById('noise-range');
    const batteryRange = document.getElementById('battery-range');
    
    const speedVal = document.getElementById('speed-val');
    const brightnessVal = document.getElementById('brightness-val');
    const noiseVal = document.getElementById('noise-val');
    const batteryVal = document.getElementById('battery-val');

    const toggleExplanations = document.getElementById('toggle-explanations');
    const toggleVibration = document.getElementById('toggle-vibration');
    
    const appUi = document.getElementById('app-ui');
    const volumeBar = document.getElementById('volume-bar');
    
    const stateMovement = document.getElementById('state-movement');
    const stateLight = document.getElementById('state-light');
    const stateUi = document.getElementById('state-ui');

    let presets = {};
    let mapData = {}; // Store map data
    let currentDestination = null; // Store current destination
    let lastState = {
        moving: false,
        highContrast: false,
        dark: false,
        noisy: false,
        batteryLow: false
    };

    // Load Data
    fetch('data.json')
        .then(response => response.json())
        .then(data => {
            presets = data.presets;
            mapData = data.mapData; // Load map data
            populateTransportOptions();
        })
        .catch(err => console.error('Erreur chargement JSON:', err));

    function populateTransportOptions() {
        for (const [key, value] of Object.entries(presets)) {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = value.label;
            transportSelect.appendChild(option);
        }
    }

    // Event Listeners
    transportSelect.addEventListener('change', (e) => {
        const selected = e.target.value;
        if (presets[selected]) {
            const p = presets[selected];
            speedRange.value = p.speed;
            brightnessRange.value = p.brightness;
            noiseRange.value = p.noise;
            updateUI();
        }
    });

    [speedRange, brightnessRange, noiseRange, batteryRange].forEach(input => {
        input.addEventListener('input', () => {
            if (input !== batteryRange) transportSelect.value = 'custom';
            updateUI();
        });
    });

    toggleVibration.addEventListener('change', updateUI);

    toggleExplanations.addEventListener('change', () => {
        if (toggleExplanations.checked) {
            // Summary of current state when enabled
            let active = [];
            if (parseInt(speedRange.value) > 15) active.push("Mouvement");
            if (parseInt(brightnessRange.value) > 80) active.push("Haut Contraste");
            if (parseInt(brightnessRange.value) < 30) active.push("Mode Sombre");
            if (parseInt(noiseRange.value) > 70) active.push("Bruit");
            if (parseInt(batteryRange.value) < 20) active.push("Éco Batterie");
            
            if (active.length > 0) {
                showToast(`🎓 Adaptations actives : ${active.join(', ')}`);
            } else {
                showToast("🎓 Mode Explicatif activé : Aucune adaptation nécessaire");
            }
        }
        updateUI();
    });

    // Main Logic
    function updateUI() {
        const speed = parseInt(speedRange.value);
        const brightness = parseInt(brightnessRange.value);
        const noise = parseInt(noiseRange.value);
        const battery = parseInt(batteryRange.value);

        // Update Labels
        speedVal.textContent = speed;
        brightnessVal.textContent = brightness;
        noiseVal.textContent = noise;
        batteryVal.textContent = battery;

        // Reset Classes
        appUi.className = 'phone-mockup'; // Keep base class
        
        // State Detection
        const isMoving = speed > 15;
        const isHighContrast = brightness > 80;
        const isDark = brightness < 30;
        const isNoisy = noise > 70;
        const isBatteryLow = battery < 20;

        // 1. Speed Adaptation
        if (isMoving) {
            appUi.classList.add('mode-moving');
            stateMovement.textContent = '🏃 En mouvement (UI Simplifiée)';
            stateUi.textContent = '🔍 Gros boutons / Texte large';
        } else {
            stateMovement.textContent = '🛑 À l\'arrêt';
            stateUi.textContent = '📱 UI Standard';
        }

        // 2. Brightness Adaptation
        if (isHighContrast) {
            appUi.classList.add('mode-high-contrast');
            stateLight.textContent = '☀️ Forte luminosité (Haut Contraste)';
        } else if (isDark) {
            appUi.classList.add('mode-dark');
            stateLight.textContent = '🌙 Faible luminosité (Mode Sombre)';
        } else {
            stateLight.textContent = '🔅 Luminosité normale';
        }

        // 3. Noise Adaptation
        // Map noise 0-120 to width 0-100%
        const volumeWidth = Math.min(100, (noise / 120) * 100);
        volumeBar.style.width = `${volumeWidth}%`;
        
        if (isNoisy) {
            appUi.classList.add('mode-noisy');
            // Simulate volume boost visual
            volumeBar.style.backgroundColor = '#ff0000';
        } else {
            volumeBar.style.backgroundColor = ''; // Reset to CSS default
        }

        // 4. Battery Adaptation (Overrides others if critical)
        if (isBatteryLow) {
            appUi.classList.add('mode-battery-saver');
            // Force dark mode text update if needed
            stateLight.textContent = '🔋 Économie d\'énergie (Mode Sombre Forcé)';
        }

        // 5. Vibration Simulation
        if (toggleVibration.checked && (speed > 30 || transportSelect.value === 'bus' || transportSelect.value === 'metro')) {
            if (!isBatteryLow) { // Disable vibration if battery is low
                appUi.classList.add('shaking');
            }
        }

        // 6. Explanatory Mode (Feedback)
        if (toggleExplanations.checked) {
            // Speed
            if (isMoving && !lastState.moving) showToast("🎓 Vitesse > 15km/h : Interface simplifiée pour la sécurité");
            else if (!isMoving && lastState.moving) showToast("ℹ️ Vitesse normale : Retour à l'interface standard");

            // Brightness
            if (isHighContrast && !lastState.highContrast) showToast("🎓 Luminosité forte : Contraste augmenté");
            else if (!isHighContrast && lastState.highContrast) showToast("ℹ️ Luminosité normale : Contraste standard");
            
            if (isDark && !lastState.dark) showToast("🎓 Faible luminosité : Mode Sombre activé");
            else if (!isDark && lastState.dark) showToast("ℹ️ Luminosité suffisante : Mode Sombre désactivé");

            // Noise
            if (isNoisy && !lastState.noisy) showToast("🎓 Bruit détecté : Volume visuel amplifié");
            else if (!isNoisy && lastState.noisy) showToast("ℹ️ Environnement calme : Volume standard");

            // Battery
            if (isBatteryLow && !lastState.batteryLow) showToast("🎓 Batterie < 20% : Mode économie activé");
            else if (!isBatteryLow && lastState.batteryLow) showToast("ℹ️ Batterie suffisante : Mode économie désactivé");
        }

        // Update last state
        lastState = {
            moving: isMoving,
            highContrast: isHighContrast,
            dark: isDark,
            noisy: isNoisy,
            batteryLow: isBatteryLow
        };

        // Update Map Info if destination is selected
        if (currentDestination) {
            updateMapInfo(currentDestination);
        }
    }

    // --- Button Interaction Simulation ---
    
    // Create Toast Element
    const toast = document.createElement('div');
    toast.className = 'toast';
    appUi.appendChild(toast);
    
    let toastTimeout;

    function showToast(message) {
        toast.textContent = message;
        toast.classList.add('show');
        
        if (toastTimeout) clearTimeout(toastTimeout);
        
        toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
        }, 2000);
    }

    // --- Modal Logic ---
    const modal = document.getElementById('app-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const closeModalBtn = document.getElementById('close-modal');

    function openModal(title, content) {
        modalTitle.textContent = title;
        modalBody.innerHTML = content;
        modal.classList.remove('hidden');
    }

    closeModalBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
    });

    // --- Map Logic ---
    function renderMap(containerId, destination = null) {
        const container = document.getElementById(containerId);
        if (!container || !mapData.currentPosition) return;

        container.innerHTML = ''; // Clear previous map

        // Create Wrapper for scrolling/zooming
        const wrapper = document.createElement('div');
        wrapper.className = 'map-scroll-wrapper';
        container.appendChild(wrapper);

        // 1. SVG Layer for Path
        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("class", "map-svg-layer");
        wrapper.appendChild(svg);

        // 2. Render Current Position
        const currentPos = mapData.currentPosition;
        const currentMarker = createMarker(currentPos.x, currentPos.y, "🔵", currentPos.label, "current");
        wrapper.appendChild(currentMarker);

        // 3. Render POIs
        mapData.pois.forEach(poi => {
            let icon = "📍";
            if (poi.type === "transport") icon = "🚆";
            if (poi.type === "culture") icon = "🏛️";
            if (poi.type === "nature") icon = "🌳";
            if (poi.type === "shop") icon = "🛒";

            const marker = createMarker(poi.x, poi.y, icon, poi.label, "poi");
            
            // Click event to set destination
            marker.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent map click
                selectDestination(poi, wrapper);
            });

            wrapper.appendChild(marker);
        });

        // 4. Handle Map Click (Arbitrary Destination)
        wrapper.addEventListener('click', (e) => {
            const rect = wrapper.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;
            
            const customDest = {
                x: x,
                y: y,
                label: "Destination personnalisée",
                type: "custom"
            };
            selectDestination(customDest, wrapper);
        });

        // If a destination is already selected (re-render scenario), draw it
        if (destination) {
            selectDestination(destination, wrapper);
        }
    }

    function createMarker(x, y, icon, label, type) {
        const marker = document.createElement('div');
        marker.className = `map-marker ${type}`;
        marker.style.left = `${x}%`;
        marker.style.top = `${y}%`;
        marker.innerHTML = `${icon}<div class="map-marker-label">${label}</div>`;
        return marker;
    }

    function selectDestination(dest, container) {
        currentDestination = dest; // Store current destination

        // Remove existing destination markers if any (except POIs which are permanent)
        const existingDest = container.querySelector('.map-marker.destination');
        if (existingDest) existingDest.remove();

        // If it's a custom point, add a marker
        if (dest.type === "custom") {
            const marker = createMarker(dest.x, dest.y, "🏁", dest.label, "destination");
            container.appendChild(marker);
        } else {
            // Highlight the POI? For now just draw path to it.
        }

        // Draw Path
        drawPath(mapData.currentPosition, dest, container);

        // Update Info Panel
        updateMapInfo(dest);
    }

    function drawPath(start, end, container) {
        const svg = container.querySelector('svg');
        // Clear old path
        svg.innerHTML = '';

        const path = document.createElementNS("http://www.w3.org/2000/svg", "line");
        path.setAttribute("x1", `${start.x}%`);
        path.setAttribute("y1", `${start.y}%`);
        path.setAttribute("x2", `${end.x}%`);
        path.setAttribute("y2", `${end.y}%`);
        path.setAttribute("class", "map-path-line");
        svg.appendChild(path);
    }

    function updateMapInfo(dest) {
        const infoPanel = document.getElementById('map-info-content');
        if (!infoPanel) return;

        // Calculate fake distance
        const dx = dest.x - mapData.currentPosition.x;
        const dy = dest.y - mapData.currentPosition.y;
        // Assume map diagonal is roughly 2km for this simulation
        // Distance in % * 20 gives meters approx (100% = 2000m)
        const dist = Math.sqrt(dx*dx + dy*dy) * 20; 
        
        // Calculate time based on current speed
        let currentSpeed = parseInt(speedRange.value);
        if (currentSpeed <= 0) currentSpeed = 5; // Min walking speed
        
        // Speed in m/min = km/h * 1000 / 60
        const speedInMPerMin = currentSpeed * 16.66;
        
        // Time in minutes
        let time = Math.round(dist / speedInMPerMin);
        
        // Ensure at least 1 min
        time = Math.max(1, time);

        infoPanel.innerHTML = `
            <h3>Destination : ${dest.label}</h3>
            <p>📍 Coordonnées : ${Math.round(dest.x)}, ${Math.round(dest.y)}</p>
            <p>📏 Distance estimée : ${Math.round(dist)} m</p>
            <p>⏱️ Temps de trajet : <strong>${time} min</strong> (à ${currentSpeed} km/h)</p>
        `;
    }

    // Attach listeners to all buttons in the mockup
    const buttons = appUi.querySelectorAll('button');
    buttons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Find the label or icon to describe the action
            let actionName = "Action";
            const label = btn.querySelector('.label') || btn.querySelector('.nav-label');
            
            if (label) {
                actionName = label.textContent.trim();
            } else if (btn.classList.contains('icon-btn')) {
                actionName = "Paramètres";
            } else if (btn.textContent.includes('Accueil')) {
                actionName = "Accueil";
            } else if (btn.textContent.includes('Recherche')) {
                actionName = "Recherche";
            } else if (btn.textContent.includes('Profil')) {
                actionName = "Profil";
            }

            // Specific Actions
            if (actionName === "Itinéraire") {
                openModal("Itinéraire Interactif", `
                    <div id="interactive-map" class="interactive-map-container"></div>
                    <div id="map-info-panel" class="map-info-panel">
                        <div id="map-info-content">
                            <p>👆 Cliquez sur la carte ou un lieu pour définir votre destination.</p>
                        </div>
                    </div>
                `);
                // Initialize Map after modal is open
                setTimeout(() => renderMap('interactive-map'), 100);
            } else if (actionName === "Billets") {
                openModal("Mes Billets", `
                    <div class="ticket-view">
                        <h3>Pass Navigo</h3>
                        <div class="qr-placeholder">QR CODE</div>
                        <p>Valide jusqu'au 31/12/2025</p>
                        <p style="color: green; font-weight: bold;">✅ Validé</p>
                    </div>
                `);
            } else if (actionName === "Signalement") {
                openModal("Signalement", `
                    <p>Que souhaitez-vous signaler ?</p>
                    <div class="report-grid">
                        <div class="report-btn">🕒<br>Retard</div>
                        <div class="report-btn">🧹<br>Saleté</div>
                        <div class="report-btn">🔊<br>Bruit</div>
                        <div class="report-btn">⚠️<br>Incident</div>
                    </div>
                `);
            } else if (actionName === "Paramètres") {
                // Keep toast for settings
                showToast(`Simulation : "${actionName}" activé`);
            } else {
                // Navigation buttons
                showToast(`Navigation vers : "${actionName}"`);
            }
            
            // Visual feedback (ripple effect simulation)
            btn.style.transform = "scale(0.95)";
            setTimeout(() => btn.style.transform = "", 150);
        });
    });

    // Initial call
    updateUI();
});
