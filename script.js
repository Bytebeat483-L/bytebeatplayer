let audioCtx, scriptNode, analyser, gainNode, dataArray, paused = false, t = 0;

function getURLParams() {
    let params = new URLSearchParams(window.location.search);
    return {
        code: params.get("code") || "(t>>9^(t>>9)-1^1)%13*t",
        mode: params.get("mode") || "js",
        sampleRate: params.get("rate") || 8000,
        volume: params.get("vol") || 0.85
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
        new Function("t", ` sin=Math.sin,cos=Math.cos,tan=Math.tan,log=Math.log,floor=Math.floor; return ` + formula);
    } catch (e) {
        document.getElementById("error").innerText = "Error in formula: " + e.message;
        return;
    }

    scriptNode.onaudioprocess = function(event) {
        if (paused) return;
        const output = event.outputBuffer.getChannelData(0);
        for (let i = 0; i < output.length; i++, t++) {
            try {
                let f = new Function("t", `const sin=Math.sin,cos=Math.cos,tan=Math.tan,log=Math.log,floor=Math.floor; return ` + formula);
                let val = f(t);
                if (mode === "classic") {
                    output[i] = ((eval(formula) & 255) / 128) - 1;
                } else if (mode === "js") {
                    output[i] = ((val & 255) / 128) - 1;
                } else if (mode === "float") {
                    output[i] = (val / 128) - 1;
                } else if (mode === "signed") {
                    output[i] = ((val & 255) + 128) / 128;
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
};
