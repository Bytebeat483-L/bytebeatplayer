let audioCtx, scriptNode, analyser, gainNode, dataArray, paused = false, t = 0;

function getURLParams() {
    let params = new URLSearchParams(window.location.search);
    return {
        code: params.get("code") || "t*(t&16384?7:5)*(3-(3&t>>9)+(3&t>>8))>>(3&-t>>(t&4096?2:16))|t>>3",
        mode: params.get("mode") || "js",
        sampleRate: params.get("rate") || 8000,
        volume: params.get("vol") || 1
    };
}

function updateURL() {
    let formula = encodeURIComponent(document.getElementById("formula").value);
    let mode = document.querySelector('input[name="mode"]:checked').value;
    let sampleRate = document.getElementById("sampleRate").value;
    let volume = document.getElementById("volume").value;
    
    let params = new URLSearchParams();
    params.set("code", formula);
    params.set("mode", mode);
    params.set("rate", sampleRate);
    params.set("vol", volume);
    
    history.replaceState(null, "", "?" + params.toString());
}

function loadSettings() {
    let settings = getURLParams();
    document.getElementById("formula").value = decodeURIComponent(settings.code);
    document.getElementById("sampleRate").value = settings.sampleRate;
    document.getElementById("volume").value = settings.volume;
    document.querySelector(`input[value="${settings.mode}"]`).checked = true;
}

function playBytebeat() {
    document.getElementById("error").innerText = "";
    if (audioCtx && !paused) stopBytebeat();
    if (paused) {
        paused = false;
        return;
    }
    
    const sampleRate = parseInt(document.getElementById("sampleRate").value);
    audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate });
    gainNode = audioCtx.createGain();
    gainNode.gain.value = parseFloat(document.getElementById("volume").value);
    scriptNode = audioCtx.createScriptProcessor(1024, 1, 1);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    let formula = document.getElementById("formula").value;
    const mode = document.querySelector('input[name="mode"]:checked').value;
    
    try {
        new Function("t", `const sin=Math.sin,cos=Math.cos; return ` + formula);
    } catch (e) {
        document.getElementById("error").innerText = "compilation error: " + e.message;
        return;
    }

    sscriptNode.onaudioprocess = function(event) {
    if (paused) return;
    const output = event.outputBuffer.getChannelData(0);
    
    for (let i = 0; i < output.length; i++, t++) {
        try {
            let f = new Function("t", `const sin=Math.sin,cos=Math.cos; return ` + formula);
            let val = f(t);
            
            // Ensure tValue updates properly
            tValue = t; // Update tValue with the current time index

            if (mode === "classic") {
                output[i] = ((eval(formula) & 255) / 128) - 1;
            } else if (mode === "js") {
                output[i] = ((val & 255) / 128) - 1;
            } else if (mode === "float") {
                output[i] = (val / 128) - 1;
            } else if (mode === "signed") {
                output[i] = ((val & 255) - 128) / 128;
            } else if (mode === "sinmode") {
                output[i] = Math.sin(val / (Math.PI * 13));
            } else if (mode === "lsb") {
                output[i] = ((val & 1) * 2) - 1;
            }
        } catch (e) {
            document.getElementById("error").innerText = "Runtime error: " + e.message;
            output[i] = 0;
        }
    }
};

    scriptNode.connect(gainNode);
    gainNode.connect(analyser);
    analyser.connect(audioCtx.destination);
    visualize();
}

function pauseBytebeat() {
    paused = !paused;
}

function stopBytebeat() {
    if (scriptNode) {
        scriptNode.disconnect();
        scriptNode = null;
    }
    if (gainNode) {
        gainNode.disconnect();
        gainNode = null;
    }
    if (audioCtx) {
        audioCtx.close();
        audioCtx = null;
    }
    t = 0;
    paused = false;
}

function updateVolume() {
    if (gainNode) {
        gainNode.gain.value = parseFloat(document.getElementById("volume").value);
    }
}

function visualize() {
    const canvas = document.getElementById("visualizer");
    const canvasCtx = canvas.getContext("2d");

    function draw() {
        requestAnimationFrame(draw);
        if (!analyser) return;
        analyser.getByteTimeDomainData(dataArray);
        canvasCtx.fillStyle = "white";
        canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
        canvasCtx.lineWidth = 2;
        canvasCtx.strokeStyle = "black";
        canvasCtx.beginPath();
        let sliceWidth = canvas.width / dataArray.length;
        let x = 0;
        for (let i = 0; i < dataArray.length; i++) {
            let v = dataArray[i] / 128.0;
            let y = v * canvas.height / 2;
            if (i === 0) {
                canvasCtx.moveTo(x, y);
            } else {
                canvasCtx.lineTo(x, y);
            }
            x += sliceWidth;
        }
        canvasCtx.lineTo(canvas.width, canvas.height / 2);
        canvasCtx.stroke();
    }
    draw();
}

// Load settings from URL on startup
window.onload = function() {
    loadSettings();
    document.getElementById("formula").addEventListener("input", updateURL);
    document.getElementById("sampleRate").addEventListener("input", updateURL);
    document.getElementById("volume").addEventListener("input", updateURL);
    document.querySelectorAll('input[name="mode"]').forEach(e => e.addEventListener("change", updateURL));
    document.getElementById("downloadBtn").addEventListener("click", downloadAudio);

};
function downloadAudio() {
    const sampleRate = parseInt(document.getElementById("sampleRate").value) || 8000;
    const duration = 90; // 90 seconds
    const totalSamples = sampleRate * duration;
    const mode = document.querySelector('input[name="mode"]:checked').value;
    const formula = document.getElementById("formula").value;

    let audioBuffer = new Float32Array(totalSamples);

    // Generate samples
    for (let t = 0; t < totalSamples; t++) {
        let value;
        try {
            if (mode === "js") {
                const fn = new Function("t", "with(Math) { return " + formula + "; }");
                value = fn(t) / 128; // Normalize for Floatbeat
            } else {
                value = eval(formula) / 128; // Normalize for Bytebeat
            }
        } catch (e) {
            console.error("Error generating audio:", e);
            return;
        }

        // Ensure value is within -1 to 1
        audioBuffer[t] = Math.max(-1, Math.min(1, value));
    }

    // Convert to WAV
    const wavData = encodeWAV(audioBuffer, sampleRate);
    const blob = new Blob([wavData], { type: "audio/wav" });

    // Create and trigger download
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "bytebeat.wav";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// Encode WAV file
function encodeWAV(samples, sampleRate) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    // WAV Header
    const writeString = (offset, str) => {
        for (let i = 0; i < str.length; i++) {
            view.setUint8(offset + i, str.charCodeAt(i));
        }
    };

    writeString(0, "RIFF"); // ChunkID
    view.setUint32(4, 36 + samples.length * 2, true); // ChunkSize
    writeString(8, "WAVE"); // Format
    writeString(12, "fmt ");
    view.setUint32(16, 16, true); // Subchunk1Size
    view.setUint16(20, 1, true); // AudioFormat (PCM)
    view.setUint16(22, 1, true); // NumChannels
    view.setUint32(24, sampleRate, true); // SampleRate
    view.setUint32(28, sampleRate * 2, true); // ByteRate
    view.setUint16(32, 2, true); // BlockAlign
    view.setUint16(34, 16, true); // BitsPerSample
    writeString(36, "data");
    view.setUint32(40, samples.length * 2, true); // Subchunk2Size

    // PCM Data
    for (let i = 0; i < samples.length; i++) {
        view.setInt16(44 + i * 2, samples[i] * 32767, true);
    }
for (let i = 0; i < 100; i++) {
    console.log(samples[i]); // Check if it's silent (all 0s)
}


    return buffer;
}
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const scriptNode = audioCtx.createScriptProcessor(4096, 1, 1);
let t = 0;
let paused = false;
let tValue = 0;

// Create canvas for visualization
const canvas = document.createElement('canvas');
document.body.appendChild(canvas);
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = 200;

// Default colors
let waveColor = '#00ff00'; // Green
let bgColor = '#000000';   // Black

// Add color pickers to customize visualizer colors
const waveColorPicker = document.createElement('input');
waveColorPicker.type = 'color';
waveColorPicker.value = waveColor;
waveColorPicker.addEventListener('input', (e) => {
    waveColor = e.target.value;
});
document.body.appendChild(waveColorPicker);

const bgColorPicker = document.createElement('input');
bgColorPicker.type = 'color';
bgColorPicker.value = bgColor;
bgColorPicker.addEventListener('input', (e) => {
    bgColor = e.target.value;
});
document.body.appendChild(bgColorPicker);

scriptNode.onaudioprocess = function(event) {
    if (paused) return;
    const output = event.outputBuffer.getChannelData(0);
    for (let i = 0; i < output.length; i++, t++) {
        tValue = t; // Update tValue
        output[i] = Math.sin(2 * Math.PI * 440 * t / audioCtx.sampleRate); // Example waveform
    }
    drawVisualizer(output);
};

audioCtx.resume();
scriptNode.connect(audioCtx.destination);

function drawVisualizer(data) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = waveColor;
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
        const x = (i / data.length) * canvas.width;
        const y = (1 - data[i]) * (canvas.height / 2);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();
}
