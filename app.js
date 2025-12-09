document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const transportSelect = document.getElementById('transport-select');
    const speedRange = document.getElementById('speed-range');
    const brightnessRange = document.getElementById('brightness-range');
    const noiseRange = document.getElementById('noise-range');
    
    const speedVal = document.getElementById('speed-val');
    const brightnessVal = document.getElementById('brightness-val');
    const noiseVal = document.getElementById('noise-val');
    
    const appUi = document.getElementById('app-ui');
    const volumeBar = document.getElementById('volume-bar');
    
    const stateMovement = document.getElementById('state-movement');
    const stateLight = document.getElementById('state-light');
    const stateUi = document.getElementById('state-ui');

    let presets = {};

    // Load Data
    fetch('data.json')
        .then(response => response.json())
        .then(data => {
            presets = data.presets;
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

    [speedRange, brightnessRange, noiseRange].forEach(input => {
        input.addEventListener('input', () => {
            transportSelect.value = 'custom';
            updateUI();
        });
    });

    // Main Logic
    function updateUI() {
        const speed = parseInt(speedRange.value);
        const brightness = parseInt(brightnessRange.value);
        const noise = parseInt(noiseRange.value);

        // Update Labels
        speedVal.textContent = speed;
        brightnessVal.textContent = brightness;
        noiseVal.textContent = noise;

        // Reset Classes
        appUi.className = 'phone-mockup'; // Keep base class
        
        // 1. Speed Adaptation
        if (speed > 15) {
            appUi.classList.add('mode-moving');
            stateMovement.textContent = '🏃 En mouvement (UI Simplifiée)';
            stateUi.textContent = '🔍 Gros boutons / Texte large';
        } else {
            stateMovement.textContent = '🛑 À l\'arrêt';
            stateUi.textContent = '📱 UI Standard';
        }

        // 2. Brightness Adaptation
        if (brightness > 80) {
            appUi.classList.add('mode-high-contrast');
            stateLight.textContent = '☀️ Forte luminosité (Haut Contraste)';
        } else if (brightness < 30) {
            appUi.classList.add('mode-dark');
            stateLight.textContent = '🌙 Faible luminosité (Mode Sombre)';
        } else {
            stateLight.textContent = '🔅 Luminosité normale';
        }

        // 3. Noise Adaptation
        // Map noise 0-120 to width 0-100%
        const volumeWidth = Math.min(100, (noise / 120) * 100);
        volumeBar.style.width = `${volumeWidth}%`;
        
        if (noise > 70) {
            appUi.classList.add('mode-noisy');
            // Simulate volume boost visual
            volumeBar.style.backgroundColor = '#ff0000';
        } else {
            volumeBar.style.backgroundColor = ''; // Reset to CSS default
        }
    }

    // Initial call
    updateUI();
});
