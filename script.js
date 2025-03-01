window.onload = function() {
    let params = new URLSearchParams(window.location.search);
    if (params.has("formula")) document.getElementById("formula").value = params.get("formula");
    if (params.has("sampleRate")) document.getElementById("sampleRate").value = params.get("sampleRate");
    if (params.has("volume")) document.getElementById("volume").value = params.get("volume");
    if (params.has("mode")) {
        document.querySelector(`input[name="mode"][value="${params.get("mode")}"]`).checked = true;
    }
};

let audioCtx, scriptNode, analyser, gainNode, dataArray, paused = false, t = 0;

function playBytebeat() {
    document.getElementById("error").innerText = "";
    if (audioCtx && !paused) stopBytebeat();
    if (paused) {
        paused = false;
        return;
        updateURL();

    
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
        document.getElementById("error").innerText = "Error in formula: " + e.message;
        return;
    }

    scriptNode.onaudioprocess = function(event) {
        if (paused) return;
        const output = event.outputBuffer.getChannelData(0);
        for (let i = 0; i < output.length; i++, t++) {
            try {
                let f = new Function("t", `const sin=Math.sin,cos=Math.cos; return ` + formula);
                let val = f(t);
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
    updateURL();
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
function updateURL() {
    const formula = encodeURIComponent(document.getElementById("formula").value);
    const sampleRate = document.getElementById("sampleRate").value;
    const mode = document.querySelector('input[name="mode"]:checked').value;
    const volume = document.getElementById("volume").value;

    const params = new URLSearchParams();
    params.set("formula", formula);
    params.set("sampleRate", sampleRate);
    params.set("mode", mode);
    params.set("volume", volume);

    const newURL = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, "", newURL);
}
window.onload = function () {
    const params = new URLSearchParams(window.location.search);
    if (params.has("formula")) document.getElementById("formula").value = decodeURIComponent(params.get("formula"));
    if (params.has("sampleRate")) document.getElementById("sampleRate").value = params.get("sampleRate");
    if (params.has("mode")) document.querySelector(`input[name="mode"][value="${params.get("mode")}"]`).checked = true;
    if (params.has("volume")) document.getElementById("volume").value = params.get("volume");

    document.getElementById("formula").addEventListener("input", updateURL);
    document.getElementById("sampleRate").addEventListener("input", updateURL);
    document.getElementById("volume").addEventListener("input", updateURL);
    document.querySelectorAll('input[name="mode"]').forEach(radio => radio.addEventListener("change", updateURL));
};
