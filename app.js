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

    // Scenario Elements
    const scenarioSelect = document.getElementById('scenario-select');
    const scenarioStatus = document.getElementById('scenario-status');
    const scenarioDesc = document.getElementById('scenario-desc');
    const scenarioControls = document.getElementById('scenario-controls');
    const btnScenarioToggle = document.getElementById('btn-scenario-toggle');

    const toggleExplanations = document.getElementById('toggle-explanations');
    const toggleVibration = document.getElementById('toggle-vibration');
    const btnRestartApp = document.getElementById('btn-restart-app');
    
    const appUi = document.getElementById('app-ui');
    
    const stateMovement = document.getElementById('state-movement');
    const stateLight = document.getElementById('state-light');
    const stateUi = document.getElementById('state-ui');

    let presets = {};
    let mapData = {}; // Store map data
    let scenarios = {}; // Store scenarios
    let currentDestination = null; // Store current destination
    let currentPath = null; // Store calculated path
    let activeScenarioInterval = null; // Store active scenario animation frame
    let watchId = null; // Store geolocation watch ID
    let isNavigating = false; // Track if navigation is active
    let userStartPosition = null; // Store user's starting position for animation
    let isScenarioRunning = false;

    let lastState = {
        moving: false,
        speedLevel: 0,
        highContrast: false,
        dark: false,
        noisy: false,
        batteryLow: false
    };

    // Transient volume popup element (created once)
    const volumePopup = document.createElement('div');
    volumePopup.className = 'volume-popup';
    volumePopup.innerHTML = `
        <div class="vol-icon">🔊</div>
        <div class="vol-track"><div class="vol-level" style="height:0%"></div></div>
    `;
    // Append into phone UI so it positions relative to phone
    appUi.appendChild(volumePopup);
    const volLevelEl = volumePopup.querySelector('.vol-level');
    let volumePopupTimeout = null;
    let lastVolumePercent = -1;

    // Top status elements (battery display + notifications)
    const statusBarEl = document.getElementById('status-bar');
    const batteryTopEl = document.getElementById('battery-top');
    const batteryTopLevel = batteryTopEl ? batteryTopEl.querySelector('.level') : null;
    const statusNotificationEl = document.getElementById('status-notification');

    function showStatusNotification(msg, persistent = false) {
        if (!statusNotificationEl) return;
        statusNotificationEl.textContent = msg;
        statusNotificationEl.classList.remove('hidden');
        if (persistent) statusNotificationEl.classList.add('persistent');
        else statusNotificationEl.classList.remove('persistent');
    }
    function hideStatusNotification() {
        if (!statusNotificationEl) return;
        statusNotificationEl.classList.add('hidden');
        statusNotificationEl.classList.remove('persistent');
    }

    function showVolumePopup(percent) {
        // percent: 0-100
        const h = Math.max(2, Math.min(100, Math.round(percent)));
        volLevelEl.style.height = `${h}%`;
        volumePopup.classList.add('show');
        if (volumePopupTimeout) clearTimeout(volumePopupTimeout);
        volumePopupTimeout = setTimeout(() => {
            volumePopup.classList.remove('show');
        }, 1200);
    }

    // Load Data
    fetch('data.json')
        .then(response => response.json())
        .then(data => {
            presets = data.presets;
            mapData = data.mapData; // Load map data
            scenarios = data.scenarios || {};
            populateTransportOptions();
            populateScenarioOptions();
        })
        .catch(err => console.error('Erreur chargement JSON:', err));

    function populateTransportOptions() {
        const transportIcons = {
            static: '🏠',
            walking: '🚶',
            cycling: '🚲',
            bus: '🚌',
            metro: '🚇',
            car: '🚗',
            custom: '⚙️'
        };

        for (const [key, value] of Object.entries(presets)) {
            const option = document.createElement('option');
            option.value = key;
            const icon = transportIcons[key] || transportIcons.custom;
            const labelText = value.label || '';
            const alreadyHasIcon = Object.values(transportIcons).some(ic => labelText.startsWith(ic));
            option.textContent = alreadyHasIcon ? labelText : `${icon} ${labelText}`;
            transportSelect.appendChild(option);
        }
    }

    function populateScenarioOptions() {
        for (const [key, value] of Object.entries(scenarios)) {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = value.label;
            scenarioSelect.appendChild(option);
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

    // When a scenario is selected, show controls but do NOT auto-open the map
    scenarioSelect.addEventListener('change', (e) => {
        const selectedScenario = e.target.value;
        if (selectedScenario) {
            // Show controls
            scenarioControls.classList.remove('hidden');
            // Do NOT open the map automatically — user must open it manually if desired
            showToast(`📍 Scénario "${scenarios[selectedScenario].label}" sélectionné. Ouvrez la carte pour choisir une destination ou cliquez sur ▶️ Start pour lancer le scénario.`);
        } else {
            scenarioControls.classList.add('hidden');
            stopScenario();
        }
    });

    // Scenario Controls Listeners
    btnScenarioToggle.addEventListener('click', () => {
        if (isScenarioRunning) {
            stopScenario();
            showToast(`⏹️ Scénario arrêté`);
        } else {
            const selected = scenarioSelect.value;
            if (selected) {
                showToast(`▶️ Scénario démarré`);
                runScenario(selected);
            }
        }
    });

    // Explicit map open button (does not auto-open when scenario is selected)
    const btnOpenMap = document.getElementById('btn-open-map');
    if (btnOpenMap) {
        btnOpenMap.addEventListener('click', () => {
            openMapWithNavigation();
        });
    }

    toggleVibration.addEventListener('change', updateUI);

    if (btnRestartApp) {
        btnRestartApp.addEventListener('click', () => {
            showToast('🔄 Redémarrage...');
            setTimeout(() => {
                // Full reload to return to initial state
                window.location.reload();
            }, 400);
        });
    }

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
        let speedLevel = 0;
        if (speed > 10 && speed <= 30) speedLevel = 1;
        else if (speed > 30 && speed <= 70) speedLevel = 2;
        else if (speed > 70) speedLevel = 3;

        const isMoving = speed > 10;
        const isHighContrast = brightness > 80;
        const isDark = brightness < 30;
        const isNoisy = noise > 70;
        const isBatteryLow = battery < 20;

        // 1. Speed Adaptation
        if (speedLevel === 1) {
            appUi.classList.add('mode-speed-1');
            stateMovement.textContent = '🚶 Vitesse modérée (UI Confort)';
            stateUi.textContent = '🔍 Texte agrandi';
        } else if (speedLevel === 2) {
            appUi.classList.add('mode-speed-2');
            stateMovement.textContent = '🏃 Vitesse rapide (UI Simplifiée)';
            stateUi.textContent = '🔍 Gros boutons / 1 colonne';
        } else if (speedLevel === 3) {
            appUi.classList.add('mode-speed-3');
            stateMovement.textContent = '🚀 Grande vitesse (UI Max)';
            stateUi.textContent = '🔍 Interface XXL / Zoom Max';
        } else {
            stateMovement.textContent = '🛑 À l\'arrêt';
            stateUi.textContent = '📱 UI Standard';
        }

        // Keep the map view in sync with speed changes (auto-zoom to user)
        try { setMapZoomForSpeed(true); } catch (e) { /* noop if map not initialized */ }

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

        // Show transient right-side popup when volume changes
        if (typeof lastVolumePercent !== 'undefined' && Math.round(lastVolumePercent) !== Math.round(volumeWidth)) {
            showVolumePopup(volumeWidth);
        }
        lastVolumePercent = volumeWidth;
        
        if (isNoisy) {
            appUi.classList.add('mode-noisy');
            // Popup shows prominence; persistent homepage bar removed
        } else {
            // Nothing to reset for removed homepage bar
        }

        // 4. Battery Adaptation (Overrides others if critical)
        // Update top status battery indicator
        if (batteryTopLevel) batteryTopLevel.textContent = `${battery}%`;

        if (isBatteryLow) {
            appUi.classList.add('mode-battery-saver');
            // Force dark mode text update if needed
            stateLight.textContent = '🔋 Économie d\'énergie (Mode Sombre Forcé)';

            // Top bar indicator and low battery notification
            if (statusBarEl) statusBarEl.classList.add('battery-low');
            if (!lastState.batteryLow) {
                showToast(`⚠️ Batterie faible : ${battery}% — Pensez à recharger.`);
                showStatusNotification(`⚠️ Batterie faible : ${battery}%`, true);
            } else {
                // update persistent notification text
                if (statusNotificationEl && statusNotificationEl.classList.contains('persistent')) {
                    statusNotificationEl.textContent = `⚠️ Batterie faible : ${battery}%`;
                }
            }
        } else {
            if (statusBarEl) statusBarEl.classList.remove('battery-low');
            hideStatusNotification();
            if (lastState.batteryLow) {
                showToast(`🔋 Batterie : ${battery}% — Chargement OK`);
            }
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
            if (speedLevel !== lastState.speedLevel) {
                if (speedLevel === 1) showToast("🎓 Vitesse modérée : Texte agrandi pour le confort");
                else if (speedLevel === 2) showToast("🎓 Vitesse rapide : Interface simplifiée (1 colonne)");
                else if (speedLevel === 3) showToast("🎓 Grande vitesse : Interface XXL pour sécurité max");
                else if (speedLevel === 0 && lastState.speedLevel > 0) showToast("ℹ️ Arrêt : Retour à l'interface standard");
            }

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
            speedLevel: speedLevel,
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
        modalBody.classList.remove('no-padding');
        modal.classList.remove('hidden');
    }

    closeModalBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
    });

    // --- Pathfinding Logic (A*) ---
    function heuristic(a, b) {
        // Euclidean distance
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    function findPath(graph, startId, endId) {
        const openSet = [startId];
        const cameFrom = {};
        
        const gScore = {};
        const fScore = {};

        for (let id in graph.nodes) {
            gScore[id] = Infinity;
            fScore[id] = Infinity;
        }
        gScore[startId] = 0;
        fScore[startId] = heuristic(graph.nodes[startId], graph.nodes[endId]);

        while (openSet.length > 0) {
            // Get node with lowest fScore
            let current = openSet.reduce((a, b) => fScore[a] < fScore[b] ? a : b);

            if (current === endId) {
                return reconstructPath(cameFrom, current);
            }

            openSet.splice(openSet.indexOf(current), 1);

            const neighbors = graph.edges[current] || [];
            for (let neighbor of neighbors) {
                const dist = heuristic(graph.nodes[current], graph.nodes[neighbor]);
                const tentativeGScore = gScore[current] + dist;

                if (tentativeGScore < gScore[neighbor]) {
                    cameFrom[neighbor] = current;
                    gScore[neighbor] = tentativeGScore;
                    fScore[neighbor] = gScore[neighbor] + heuristic(graph.nodes[neighbor], graph.nodes[endId]);
                    
                    if (!openSet.includes(neighbor)) {
                        openSet.push(neighbor);
                    }
                }
            }
        }
        return null; // No path found
    }

    function reconstructPath(cameFrom, current) {
        const totalPath = [current];
        while (current in cameFrom) {
            current = cameFrom[current];
            totalPath.unshift(current);
        }
        return totalPath;
    }

    function findNearestNode(x, y, graph) {
        let nearest = null;
        let minDistance = Infinity;

        for (let id in graph.nodes) {
            const node = graph.nodes[id];
            const dist = Math.sqrt(Math.pow(node.x - x, 2) + Math.pow(node.y - y, 2));
            if (dist < minDistance) {
                minDistance = dist;
                nearest = id;
            }
        }
        return nearest;
    }

    // --- Map Logic ---
    function renderMap(containerId, destination = null) {
        const container = document.getElementById(containerId);
        if (!container || !mapData.currentPosition) return;

        container.innerHTML = ''; // Clear previous map

        // Create Wrapper for scrolling/zooming (enable smooth transitions for zoom)
        const wrapper = document.createElement('div');
        wrapper.className = 'map-scroll-wrapper';
        wrapper.style.transition = 'width 300ms ease, height 300ms ease';
        container.appendChild(wrapper);

        // 1. SVG Layer for Path and Roads
        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("class", "map-svg-layer");
        svg.setAttribute("viewBox", "0 0 100 100");
        svg.setAttribute("preserveAspectRatio", "none");
        wrapper.appendChild(svg);

        // Draw Roads (Edges)
        if (mapData.graph) {
            const drawnEdges = new Set();
            for (const [nodeId, neighbors] of Object.entries(mapData.graph.edges)) {
                const startNode = mapData.graph.nodes[nodeId];
                neighbors.forEach(neighborId => {
                    // Avoid drawing twice
                    const edgeKey = [nodeId, neighborId].sort().join('-');
                    if (!drawnEdges.has(edgeKey)) {
                        const endNode = mapData.graph.nodes[neighborId];
                        const line = document.createElementNS(svgNS, "line");
                        line.setAttribute("x1", `${startNode.x}`);
                        line.setAttribute("y1", `${startNode.y}`);
                        line.setAttribute("x2", `${endNode.x}`);
                        line.setAttribute("y2", `${endNode.y}`);
                        line.setAttribute("class", "map-road-line");
                        line.setAttribute("stroke", "#bdc3c7");
                        line.setAttribute("stroke-width", "2");
                        svg.appendChild(line);
                        drawnEdges.add(edgeKey);
                    }
                });
            }
        }

        // 2. Render Current Position
        const currentPos = mapData.currentPosition;
        const currentMarker = createMarker(currentPos.x, currentPos.y, "🔵", currentPos.label, "current");
        wrapper.appendChild(currentMarker);

        // 4. Handle Map Interaction (Drag to Scroll vs Click to Select)
        let isDragging = false;
        let startX, startY, scrollLeft, scrollTop;
        let mouseDownTime;

        // Mouse Down / Touch Start
        const onPointerDown = (e) => {
            isDragging = false;
            mouseDownTime = new Date().getTime();
            const pageX = e.pageX || e.touches[0].pageX;
            const pageY = e.pageY || e.touches[0].pageY;
            
            startX = pageX - container.offsetLeft;
            startY = pageY - container.offsetTop;
            scrollLeft = container.scrollLeft;
            scrollTop = container.scrollTop;
            
            // Only enable drag scrolling if content is larger than container
            if (container.scrollHeight > container.clientHeight || container.scrollWidth > container.clientWidth) {
                container.style.cursor = 'grabbing';
            }
        };

        // Mouse Move / Touch Move
        const onPointerMove = (e) => {
            // If mouse is not down (and not touch), ignore
            if (e.type === 'mousemove' && e.buttons === 0) return;

            const pageX = e.pageX || e.touches[0].pageX;
            const pageY = e.pageY || e.touches[0].pageY;
            
            const x = pageX - container.offsetLeft;
            const y = pageY - container.offsetTop;
            
            const walkX = x - startX;
            const walkY = y - startY;

            // Threshold to consider it a drag
            if (Math.abs(walkX) > 5 || Math.abs(walkY) > 5) {
                isDragging = true;
                // Scroll the container
                container.scrollLeft = scrollLeft - walkX;
                container.scrollTop = scrollTop - walkY;
            }
        };

        // Mouse Up / Touch End
        const onPointerUp = () => {
            container.style.cursor = 'default';
        };

        wrapper.addEventListener('mousedown', onPointerDown);
        wrapper.addEventListener('touchstart', onPointerDown);

        wrapper.addEventListener('mousemove', onPointerMove);
        wrapper.addEventListener('touchmove', onPointerMove);

        wrapper.addEventListener('mouseup', onPointerUp);
        wrapper.addEventListener('touchend', onPointerUp);
        wrapper.addEventListener('mouseleave', onPointerUp);

        // Click Handler
        wrapper.addEventListener('click', (e) => {
            // If it was a drag, do not select destination
            if (isDragging) return;

            const rect = wrapper.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;
            
            // Find nearest node
            let nearestNodeId = null;
            let nearestNode = { x: x, y: y }; // Default to click if no graph

            if (mapData.graph) {
                nearestNodeId = findNearestNode(x, y, mapData.graph);
                nearestNode = mapData.graph.nodes[nearestNodeId];
            }
            
            const customDest = {
                x: nearestNode.x,
                y: nearestNode.y,
                label: "Destination",
                type: "custom",
                nodeId: nearestNodeId
            };
            selectDestination(customDest, wrapper);
        });

        // POI Click Handler Update
        mapData.pois.forEach(poi => {
            let icon = "📍";
            if (poi.type === "transport") icon = "🚆";
            if (poi.type === "culture") icon = "🏛️";
            if (poi.type === "nature") icon = "🌳";
            if (poi.type === "shop") icon = "🛒";
            if (poi.type === "health") icon = "🏥";

            const marker = createMarker(poi.x, poi.y, icon, poi.label, "poi");
            
            // Click event to set destination
            marker.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent map click
                if (!isDragging) {
                    selectDestination(poi, wrapper);
                }
            });

            wrapper.appendChild(marker);
        });

        // If a destination is already selected (re-render scenario), draw it
        if (destination) {
            selectDestination(destination, wrapper);
        }

        // 5. Zoom Controls Logic
        const btnZoomIn = document.getElementById('btn-zoom-in');
        const btnZoomOut = document.getElementById('btn-zoom-out');
        const btnZoomUser = document.getElementById('btn-zoom-user');
        
        if (btnZoomIn && btnZoomOut) {
            // Determine initial zoom based on active mode
            let currentZoom = 100;
            const appUi = document.getElementById('app-ui');
            if (appUi.classList.contains('mode-speed-2')) currentZoom = 150;
            if (appUi.classList.contains('mode-speed-3')) currentZoom = 200;

            // Apply manual zoom and center on user (supports smooth animation)
            const centerOnUser = (smooth = true) => {
                // Use rAF to ensure layout is updated after size changes
                requestAnimationFrame(() => {
                    const user = mapData.currentPosition;
                    if (!user) return;

                    const wrapperWidth = wrapper.scrollWidth;
                    const wrapperHeight = wrapper.scrollHeight;

                    // User position in pixels within the (scaled) wrapper
                    const userX = (user.x / 100) * wrapperWidth;
                    const userY = (user.y / 100) * wrapperHeight;

                    const maxScrollLeft = container.scrollWidth - container.clientWidth;
                    const maxScrollTop = container.scrollHeight - container.clientHeight;

                    let targetScrollLeft = Math.round(userX - container.clientWidth / 2);
                    let targetScrollTop = Math.round(userY - container.clientHeight / 2);

                    targetScrollLeft = Math.max(0, Math.min(maxScrollLeft, targetScrollLeft));
                    targetScrollTop = Math.max(0, Math.min(maxScrollTop, targetScrollTop));

                    if (smooth && container.scrollTo) {
                        container.scrollTo({ left: targetScrollLeft, top: targetScrollTop, behavior: 'smooth' });
                    } else {
                        container.scrollLeft = targetScrollLeft;
                        container.scrollTop = targetScrollTop;
                    }
                });
            };

            const updateZoom = (center = true, smooth = true) => {
                wrapper.style.width = `${currentZoom}%`;
                wrapper.style.height = `${currentZoom}%`;
                if (center) centerOnUser(smooth);
            };

            btnZoomIn.addEventListener('click', () => {
                currentZoom += 25;
                updateZoom(true, true);
            });

            btnZoomOut.addEventListener('click', () => {
                currentZoom = Math.max(100, currentZoom - 25);
                updateZoom(true, true);
            });

            // Zoom-to-user quick button (sets a comfortable zoom level and centers)
            if (btnZoomUser) {
                btnZoomUser.addEventListener('click', () => {
                    currentZoom = Math.max(currentZoom, 200);
                    updateZoom(true, true);
                });
            }

            // Apply initial zoom & center (without animation so it feels immediate)
            updateZoom(true, false);

            // Apply initial zoom & center (so mode-based zoom centers on user)
            updateZoom(true);
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
        }

        // Find Path
        let pathIds = [];
        if (mapData.graph) {
            const startNodeId = findNearestNode(mapData.currentPosition.x, mapData.currentPosition.y, mapData.graph);
            const endNodeId = dest.nodeId || findNearestNode(dest.x, dest.y, mapData.graph);
            pathIds = findPath(mapData.graph, startNodeId, endNodeId);
        }
        
        currentPath = pathIds; // Update global path immediately

        // Draw Path
        drawPath(pathIds, mapData.graph, container, mapData.currentPosition, dest);

        // Update Info Panel
        updateMapInfo(dest, pathIds);
    }

    function drawPath(pathIds, graph, container, startPos, endPos) {
        const svg = container.querySelector('svg');
        // Clear old path lines
        const oldPaths = svg.querySelectorAll('.map-path-line');
        oldPaths.forEach(p => p.remove());

        let pointsArray = [];

        // Add Start Position (User)
        if (startPos) {
             pointsArray.push({x: startPos.x, y: startPos.y});
        }

        // Add Path Nodes
        if (pathIds && pathIds.length > 0) {
             pathIds.forEach(id => {
                 pointsArray.push(graph.nodes[id]);
             });
        }

        // Add End Position (Destination)
        if (endPos) {
             pointsArray.push({x: endPos.x, y: endPos.y});
        }

        if (pointsArray.length < 2) return;

        const points = pointsArray.map(p => {
            return `${p.x},${p.y}`;
        }).join(" ");

        const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
        polyline.setAttribute("points", points);
        polyline.setAttribute("class", "map-path-line");
        polyline.setAttribute("fill", "none");
        polyline.setAttribute("stroke-linecap", "round");
        polyline.setAttribute("stroke-linejoin", "round");
        
        svg.appendChild(polyline);
    }

    function updateMapInfo(dest, pathIds = [], progress = 0) {
        const infoPanel = document.getElementById('map-info-content');
        if (!infoPanel) return;

        let dist = 0;
        
        if (pathIds && pathIds.length > 1 && mapData.graph) {
            // Calculate distance along the path
            for (let i = 0; i < pathIds.length - 1; i++) {
                const n1 = mapData.graph.nodes[pathIds[i]];
                const n2 = mapData.graph.nodes[pathIds[i+1]];
                const dx = n1.x - n2.x;
                const dy = n1.y - n2.y;
                dist += Math.sqrt(dx*dx + dy*dy);
            }
            dist *= 20; // Scale factor
        } else {
            // Fallback to direct distance
            const dx = dest.x - mapData.currentPosition.x;
            const dy = dest.y - mapData.currentPosition.y;
            dist = Math.sqrt(dx*dx + dy*dy) * 20; 
        }
        
        // Calculate time based on current speed
        let currentSpeed = parseInt(speedRange.value);
        if (currentSpeed <= 0) currentSpeed = 5; // Min walking speed
        
        // Speed in m/min = km/h * 1000 / 60
        const speedInMPerMin = currentSpeed * 16.66;
        
        // Time in minutes
        let time = Math.round(dist / speedInMPerMin);
        
        // Ensure at least 1 min (or 0 if very close)
        if (dist < 10) {
            time = 0;
        } else {
            time = Math.max(1, time);
        }

        // Calculate progress if navigating
        let progressPercent = 0;
        if (isNavigating) {
             progressPercent = Math.min(100, Math.round(progress * 100));
        }

        if (isNavigating) {
            // Show navigation progress UI
            infoPanel.innerHTML = `
                <h3>🧭 Vers : ${dest.label}</h3>
                <div style="display: flex; justify-content: space-between; margin-top: 5px;">
                    <p>📏 <strong>${Math.round(dist)} m</strong></p>
                    <p>⏱️ <strong>${time > 0 ? time + ' min' : 'Arrivée!'}</strong></p>
                </div>
            `;
        } else {
            // Show destination selection UI
            infoPanel.innerHTML = `
                <h3>${dest.label}</h3>
                <p>📏 ${Math.round(dist)} m • ⏱️ <strong>${time} min</strong></p>
                <button id="btn-start-nav" class="action-btn primary" style="margin-top: 10px; width: 100%; padding: 10px; font-size: 1em;">🚀 Y aller</button>
            `;

            // Add Start Navigation Listener
            const startBtn = document.getElementById('btn-start-nav');
            if (startBtn) {
                startBtn.addEventListener('click', () => {
                    startNavigation(dest, time, pathIds);
                });
            }
        }
    }

    function stopScenario() {
        if (activeScenarioInterval) {
            cancelAnimationFrame(activeScenarioInterval);
            activeScenarioInterval = null;
        }
        scenarioStatus.classList.add('hidden');
        transportSelect.disabled = false;
        scenarioSelect.disabled = false;
        isNavigating = false;
        isScenarioRunning = false;

        // Reset Button
        btnScenarioToggle.textContent = "▶️ Start";
        btnScenarioToggle.classList.remove('secondary');
        btnScenarioToggle.classList.add('primary');
        btnScenarioToggle.style.backgroundColor = ""; 
        
        if (watchId) {
            navigator.geolocation.clearWatch(watchId);
            watchId = null;
        }
        
        if (scenarioDesc) scenarioDesc.textContent = "Arrêté";
    }

    function runScenario(scenarioKey) {
        if (!scenarios[scenarioKey]) return;
        
        const scenario = scenarios[scenarioKey];
        const steps = scenario.steps;
        const isManual = scenario.type === 'manual';
        
        // Stop any previous scenario
        if (activeScenarioInterval) cancelAnimationFrame(activeScenarioInterval);
        
        scenarioStatus.classList.remove('hidden');
        transportSelect.disabled = !isManual; // Enable transport select in manual mode if desired
        isScenarioRunning = true;

        // Update Button to Stop
        btnScenarioToggle.textContent = "⏹️ Stop";
        btnScenarioToggle.classList.remove('primary');
        btnScenarioToggle.classList.add('secondary');
        btnScenarioToggle.style.backgroundColor = "#e74c3c";

        // Calculate total duration for position interpolation
        const totalDuration = steps.reduce((sum, step) => sum + step.duration, 0);
        let elapsedDuration = 0;

        // Store start position for animation
        userStartPosition = { ...mapData.currentPosition };

        // Calculate total path length in meters (approx)
        let totalPathLengthMeters = 0;
        if (currentPath && currentPath.length > 1 && mapData.graph) {
             for(let i=0; i<currentPath.length-1; i++) {
                const n1 = mapData.graph.nodes[currentPath[i]];
                const n2 = mapData.graph.nodes[currentPath[i+1]];
                const d = Math.sqrt(Math.pow(n2.x-n1.x, 2) + Math.pow(n2.y-n1.y, 2));
                totalPathLengthMeters += d * 20; // Scale factor 20
            }
        } else if (currentDestination && userStartPosition) {
             const dx = currentDestination.x - userStartPosition.x;
             const dy = currentDestination.y - userStartPosition.y;
             totalPathLengthMeters = Math.sqrt(dx*dx + dy*dy) * 20;
        }
        
        let traveledMeters = 0;
        let lastFrameTime = Date.now();

        const executeStep = (index) => {
            if (index >= steps.length) {
                // End of scenario - user reached destination
                scenarioDesc.textContent = "🎉 Destination atteinte !";
                isNavigating = false;
                
                // Stop geolocation watching
                if (watchId) {
                    navigator.geolocation.clearWatch(watchId);
                    watchId = null;
                }

                // Update user position to destination
                if (currentDestination) {
                    mapData.currentPosition = { 
                        x: currentDestination.x, 
                        y: currentDestination.y, 
                        label: "Vous (Arrivé)" 
                    };
                    updateUserPositionOnMap();
                    showToast(`🎉 Vous êtes arrivé à ${currentDestination.label} !`);
                }

                setTimeout(() => {
                    scenarioStatus.classList.add('hidden');
                    transportSelect.disabled = false;
                    isScenarioRunning = false;

                    // Reset Button
                    btnScenarioToggle.textContent = "▶️ Start";
                    btnScenarioToggle.classList.remove('secondary');
                    btnScenarioToggle.classList.add('primary');
                    btnScenarioToggle.style.backgroundColor = "";

                    // Reset position for next navigation
                    // Keep currentPosition at destination so subsequent navigations start from here
                }, 3000);
                return;
            }

            const step = steps[index];
            scenarioDesc.textContent = step.desc;
            
            // Target values
            const targetSpeed = step.values.speed;
            const targetNoise = step.values.noise;
            const targetBrightness = step.values.brightness;
            const targetBattery = step.values.battery;

            // Current values
            const startSpeed = parseInt(speedRange.value);
            const startNoise = parseInt(noiseRange.value);
            const startBrightness = parseInt(brightnessRange.value);
            const startBattery = parseInt(batteryRange.value);

            // Interpolation
            const startTime = Date.now();
            const duration = step.duration;
            
            const animate = () => {
                const now = Date.now();
                const dt = (now - lastFrameTime) / 1000; // seconds
                lastFrameTime = now;

                // Only interpolate variables if NOT manual
                if (!isManual) {
                    const stepProgress = Math.min(1, (now - startTime) / duration);
                    
                    speedRange.value = Math.round(startSpeed + (targetSpeed - startSpeed) * stepProgress);
                    noiseRange.value = Math.round(startNoise + (targetNoise - startNoise) * stepProgress);
                    brightnessRange.value = Math.round(startBrightness + (targetBrightness - startBrightness) * stepProgress);
                    batteryRange.value = Math.round(startBattery + (targetBattery - startBattery) * stepProgress);
                }
                
                // Update user position on map based on REAL SPEED
                let overallProgress = 0;
                if (currentDestination && userStartPosition) {
                    const currentSpeedKmh = parseInt(speedRange.value);
                    const currentSpeedMs = currentSpeedKmh / 3.6; // Convert km/h to m/s
                    
                    // Move based on speed and time delta
                    traveledMeters += currentSpeedMs * dt * 5; // *5 Speed multiplier for simulation feel
                    
                    if (totalPathLengthMeters > 0) {
                        overallProgress = traveledMeters / totalPathLengthMeters;
                    }
                    if (overallProgress > 1) overallProgress = 1;
                    
                    if (currentPath && currentPath.length > 1 && mapData.graph) {
                        // Path following logic
                        let totalDist = 0;
                        const segments = [];
                        for(let i=0; i<currentPath.length-1; i++) {
                            const n1 = mapData.graph.nodes[currentPath[i]];
                            const n2 = mapData.graph.nodes[currentPath[i+1]];
                            const d = Math.sqrt(Math.pow(n2.x-n1.x, 2) + Math.pow(n2.y-n1.y, 2));
                            segments.push({
                                start: n1,
                                end: n2,
                                length: d,
                                accumStart: totalDist
                            });
                            totalDist += d;
                        }
                        
                        const currentDist = totalDist * overallProgress;
                        let targetX = userStartPosition.x;
                        let targetY = userStartPosition.y;
                        
                        // Find current segment
                        for(const seg of segments) {
                            if (currentDist >= seg.accumStart && currentDist <= seg.accumStart + seg.length) {
                                const segProgress = (currentDist - seg.accumStart) / seg.length;
                                targetX = seg.start.x + (seg.end.x - seg.start.x) * segProgress;
                                targetY = seg.start.y + (seg.end.y - seg.start.y) * segProgress;
                                break;
                            }
                        }
                        
                        // Handle end of path (floating point errors)
                        if (overallProgress >= 0.99) {
                            const lastNode = mapData.graph.nodes[currentPath[currentPath.length-1]];
                            targetX = lastNode.x;
                            targetY = lastNode.y;
                        }

                        mapData.currentPosition.x = targetX;
                        mapData.currentPosition.y = targetY;
                    } else {
                        // Fallback to straight line
                        const newX = userStartPosition.x + (currentDestination.x - userStartPosition.x) * overallProgress;
                        const newY = userStartPosition.y + (currentDestination.y - userStartPosition.y) * overallProgress;
                        
                        mapData.currentPosition.x = newX;
                        mapData.currentPosition.y = newY;
                    }
                    
                    updateUserPositionOnMap();
                    updateMapInfo(currentDestination, currentPath, overallProgress);
                }
                
                updateUI();

                // Check if step time is up
                if ((now - startTime) >= duration || isManual) {
                    // Step time finished. Decide whether to proceed.
                    
                    const isLastStep = index === steps.length - 1;
                    const isSecondToLast = index === steps.length - 2;
                    const nextStep = isSecondToLast ? steps[index + 1] : null;
                    
                    const arrived = overallProgress >= 0.95; // 95% is close enough to start arrival sequence
                    
                    let shouldHold = false;
                    
                    if (!arrived && currentDestination) {
                        // If manual, we ALWAYS hold until arrived
                        if (isManual) {
                            shouldHold = true;
                        }
                        // If we are on the last step and it has speed (e.g. walking), hold it.
                        else if (isLastStep && targetSpeed > 0) {
                            shouldHold = true;
                        }
                        // If we are on second to last, and next is a STOP (speed 0), hold current (keep moving).
                        else if (isSecondToLast && nextStep && nextStep.values.speed === 0) {
                            shouldHold = true;
                        }
                    }

                    if (shouldHold) {
                        // Continue animation loop without advancing step
                        // Values stay clamped at target (stepProgress = 1)
                        activeScenarioInterval = requestAnimationFrame(animate);
                    } else {
                        // Advance
                        elapsedDuration += duration;
                        executeStep(index + 1);
                    }
                } else {
                    // Continue normal animation
                    activeScenarioInterval = requestAnimationFrame(animate);
                }
            };
            
            activeScenarioInterval = requestAnimationFrame(animate);
        };

        executeStep(0);
    }

    // Auto-zoom the map based on current speed mode and center on the user
    function setMapZoomForSpeed(smooth = true) {
        const mapContainer = document.getElementById('interactive-map');
        if (!mapContainer) return;

        const wrapper = mapContainer.querySelector('.map-scroll-wrapper');
        if (!wrapper) return;

        const appUi = document.getElementById('app-ui');
        let targetZoom = 100;
        if (appUi && appUi.classList.contains('mode-speed-2')) targetZoom = 150;
        if (appUi && appUi.classList.contains('mode-speed-3')) targetZoom = 200;

        // Apply zoom size
        wrapper.style.width = `${targetZoom}%`;
        wrapper.style.height = `${targetZoom}%`;

        // Center on user after layout updates
        requestAnimationFrame(() => {
            const user = mapData.currentPosition;
            if (!user) return;

            const wrapperWidth = wrapper.scrollWidth;
            const wrapperHeight = wrapper.scrollHeight;

            const userX = (user.x / 100) * wrapperWidth;
            const userY = (user.y / 100) * wrapperHeight;

            const maxScrollLeft = mapContainer.scrollWidth - mapContainer.clientWidth;
            const maxScrollTop = mapContainer.scrollHeight - mapContainer.clientHeight;

            let targetScrollLeft = Math.round(userX - mapContainer.clientWidth / 2);
            let targetScrollTop = Math.round(userY - mapContainer.clientHeight / 2);

            targetScrollLeft = Math.max(0, Math.min(maxScrollLeft, targetScrollLeft));
            targetScrollTop = Math.max(0, Math.min(maxScrollTop, targetScrollTop));

            if (smooth && mapContainer.scrollTo) {
                mapContainer.scrollTo({ left: targetScrollLeft, top: targetScrollTop, behavior: 'smooth' });
            } else {
                mapContainer.scrollLeft = targetScrollLeft;
                mapContainer.scrollTop = targetScrollTop;
            }
        });
    }

    function updateUserPositionOnMap() {
        const mapContainer = document.getElementById('interactive-map');
        if (!mapContainer) return;

        const wrapper = mapContainer.querySelector('.map-scroll-wrapper');
        if (!wrapper) return;

        // Find and update current position marker
        let currentMarker = wrapper.querySelector('.map-marker.current');
        
        if (currentMarker) {
            currentMarker.style.left = `${mapData.currentPosition.x}%`;
            currentMarker.style.top = `${mapData.currentPosition.y}%`;
            
            // Add pulsing animation during navigation
            if (isNavigating) {
                currentMarker.classList.add('navigating');
            } else {
                currentMarker.classList.remove('navigating');
            }
            
            // Update label
            const label = currentMarker.querySelector('.map-marker-label');
            if (label) {
                label.textContent = mapData.currentPosition.label;
            }
        }
        
        // Note: We do not redraw the path here to avoid performance issues.
        // The path remains static as the "planned route".
    }

    function startNavigation(dest, time, pathIds) {
        isNavigating = true;
        currentPath = pathIds;

        // Update Button State
        const startBtn = document.getElementById('btn-start-nav');
        if (startBtn) {
            startBtn.textContent = "✅ Navigation en cours...";
            startBtn.disabled = true;
            startBtn.style.backgroundColor = "#2ecc71";
        }

        // Update Main UI "Next Stop" Card
        const stationName = document.querySelector('.station-name');
        const eta = document.querySelector('.eta');
        
        if (stationName) {
            stationName.textContent = dest.label;
            stationName.style.color = "var(--primary-color)";
        }
        
        if (eta) {
            eta.innerHTML = `Arrivée dans <span class="highlight">${time} min</span>`;
        }

        showToast(`🚀 Navigation démarrée vers ${dest.label}`);

        // Check if a scenario is selected
        const selectedScenario = scenarioSelect.value;
        if (selectedScenario) {
            // Keep the map modal open to show real-time tracking
            // Do NOT close the modal - user should see the map during navigation
            
            // Start real-time geolocation tracking (if available)
            startGeolocationTracking();
            
            runScenario(selectedScenario);
        } else {
            showToast("⚠️ Sélectionnez un scénario pour démarrer la simulation");
        }
    }

    function startGeolocationTracking() {
        // Try to use real geolocation if available
        if ('geolocation' in navigator) {
            watchId = navigator.geolocation.watchPosition(
                (position) => {
                    // In a real app, we would convert GPS coordinates to map coordinates
                    // For this simulation, we'll use the simulated position from the scenario
                    console.log('Real GPS Position:', position.coords.latitude, position.coords.longitude);
                },
                (error) => {
                    console.log('Geolocation not available, using simulation:', error.message);
                },
                {
                    enableHighAccuracy: true,
                    maximumAge: 1000,
                    timeout: 5000
                }
            );
        }
    }

    function openMapWithNavigation() {
        // Open the map modal
        openModal("", `
            <div class="map-container-wrapper">
                <div id="interactive-map" class="interactive-map-container"></div>
                <div class="map-zoom-controls">
                    <button id="btn-zoom-in" class="zoom-btn">➕</button>
                    <button id="btn-zoom-out" class="zoom-btn">➖</button>
                    <button id="btn-zoom-user" class="zoom-btn" title="Zoom to you">🎯</button>
                </div>
            </div>
            <div id="map-info-panel" class="map-info-panel">
                <div id="map-info-content">
                    <p>👆 Cliquez sur la carte ou un lieu pour définir votre destination.</p>
                </div>
            </div>
        `);
        
        modalBody.classList.add('no-padding');

        // Initialize Map after modal is open
        setTimeout(() => {
            renderMap('interactive-map', currentDestination);
            if (currentDestination) {
                updateMapInfo(currentDestination, currentPath);
            }
        }, 100);
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
            if (actionName === "Itinéraire" || actionName === "Carte") {
                openMapWithNavigation();
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
