// Global variables
let process = 1;
let selectedAlgorithm = "srtf";
let apiKey = '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';

// Initialize API key status
document.addEventListener('DOMContentLoaded', () => {
    const apiKeyInput = document.getElementById('api-key');
    const apiStatus = document.getElementById('api-status');
    
    // Pre-load the API key
    apiKeyInput.value = apiKey;
    localStorage.setItem('openai_api_key', apiKey);
    apiStatus.textContent = '✓ API Key loaded';
    apiStatus.style.color = 'green';

    document.getElementById('save-key').addEventListener('click', () => {
        apiKey = apiKeyInput.value.trim();
        if (apiKey) {
            localStorage.setItem('openai_api_key', apiKey);
            apiStatus.textContent = '✓ API Key saved';
            apiStatus.style.color = 'green';
        } else {
            apiStatus.textContent = '✗ Please enter an API key';
            apiStatus.style.color = 'red';
        }
    });
});

// Data structures for scheduling
class Input {
    constructor() {
        this.processId = [];
        this.arrivalTime = [];
        this.burstTime = [];
        this.algorithm = "srtf";
        this.contextSwitch = 0;
    }
}

class Output {
    constructor() {
        this.completionTime = [];
        this.turnAroundTime = [];
        this.waitingTime = [];
        this.responseTime = [];
        this.schedule = [];
        this.timeLog = [];
        this.contextSwitches = 0;
        this.averageTimes = [];
    }
}

class TimeLog {
    constructor() {
        this.time = -1;
        this.ready = [];
        this.running = [];
        this.terminate = [];
    }
}

// Core scheduling algorithm
function srtfScheduler(input, output) {
    let remainingTime = [...input.burstTime];
    let currentTime = 0;
    let completed = new Array(input.processId.length).fill(false);
    let started = new Array(input.processId.length).fill(false);
    let completedCount = 0;
    
    while (completedCount < input.processId.length) {
        let shortestJob = -1;
        let minBurst = Number.MAX_VALUE;
        
        // Find process with shortest remaining time
        for (let i = 0; i < input.processId.length; i++) {
            if (!completed[i] && input.arrivalTime[i] <= currentTime && remainingTime[i] < minBurst && remainingTime[i] > 0) {
                shortestJob = i;
                minBurst = remainingTime[i];
            }
        }
        
        if (shortestJob === -1) {
            // No process available, add idle time
            currentTime++;
            output.schedule.push([-1, 1]);
            continue;
        }
        
        // Record response time if first time running
        if (!started[shortestJob]) {
            output.responseTime[shortestJob] = currentTime - input.arrivalTime[shortestJob];
            started[shortestJob] = true;
        }
        
        // Execute process for 1 time unit
        remainingTime[shortestJob]--;
        output.schedule.push([shortestJob + 1, 1]);
        currentTime++;
        
        // Check if process completed
        if (remainingTime[shortestJob] === 0) {
            completedCount++;
            completed[shortestJob] = true;
            output.completionTime[shortestJob] = currentTime;
            
            // Add context switch if not the last process
            if (completedCount < input.processId.length && input.contextSwitch > 0) {
                output.schedule.push([-2, input.contextSwitch]);
                currentTime += input.contextSwitch;
                output.contextSwitches++;
            }
        }
    }
    
    // Calculate turnaround and waiting times
    for (let i = 0; i < input.processId.length; i++) {
        output.turnAroundTime[i] = output.completionTime[i] - input.arrivalTime[i];
        output.waitingTime[i] = output.turnAroundTime[i] - input.burstTime[i];
    }
    
    // Calculate averages
    let avgCT = output.completionTime.reduce((a, b) => a + b, 0) / output.completionTime.length;
    let avgTAT = output.turnAroundTime.reduce((a, b) => a + b, 0) / output.turnAroundTime.length;
    let avgWT = output.waitingTime.reduce((a, b) => a + b, 0) / output.waitingTime.length;
    let avgRT = output.responseTime.reduce((a, b) => a + b, 0) / output.responseTime.length;
    output.averageTimes = [avgCT, avgTAT, avgWT, avgRT];
}

async function analyzeResults(input, output) {
    const aiOutput = document.getElementById("ai-review-output");
    aiOutput.innerHTML = '<p>Analyzing scheduling results...</p>';
    
    if (!apiKey) {
        aiOutput.innerHTML = '<p style="color: red;">Please enter an OpenAI API key first.</p>';
        return;
    }

    try {
        const processData = input.processId.map((id, index) => ({
            id: id + 1,
            arrivalTime: input.arrivalTime[index],
            burstTime: input.burstTime[index],
            completionTime: output.completionTime[index],
            turnaroundTime: output.turnAroundTime[index],
            waitingTime: output.waitingTime[index],
            responseTime: output.responseTime[index]
        }));

        const metrics = {
            averageCompletionTime: output.averageTimes[0],
            averageTurnaroundTime: output.averageTimes[1],
            averageWaitingTime: output.averageTimes[2],
            averageResponseTime: output.averageTimes[3],
            contextSwitches: output.contextSwitches
        };

        const prompt = `Analyze this CPU scheduling scenario using SRTF algorithm:
Process Data: ${JSON.stringify(processData)}
Performance Metrics: ${JSON.stringify(metrics)}

Please provide:
1. Analysis of the current performance
2. Comparison with other scheduling algorithms
3. Suggestions for improvement
4. Best use cases for this workload`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo",
                messages: [{
                    role: "user",
                    content: prompt
                }],
                temperature: 0.7
            })
        });

        if (!response.ok) {
            throw new Error('API request failed');
        }

        const data = await response.json();
        const analysis = data.choices[0].message.content;

        // Format and display the analysis
        aiOutput.innerHTML = `
            <div class="ai-analysis-section">
                <h3>AI Scheduling Analysis</h3>
                <div class="analysis-content">
                    ${analysis.split('\n').map(line => `<p>${line}</p>`).join('')}
                </div>
            </div>`;

    } catch (error) {
        aiOutput.innerHTML = `
            <div class="error-message">
                <p>Error getting AI analysis: ${error.message}</p>
                <p>Please check your API key and try again.</p>
            </div>`;
    }
}

// Visualization functions
function showGanttChart(output, outputDiv) {
    google.charts.load('current', { 'packages': ['timeline'] });
    google.charts.setOnLoadCallback(drawGanttChart);

    function drawGanttChart() {
        let container = document.createElement("div");
        container.style.width = '100%';
        container.style.height = '200px';
        container.style.marginTop = '20px';
        outputDiv.appendChild(container);

        let chart = new google.visualization.Timeline(container);
        let dataTable = new google.visualization.DataTable();

        dataTable.addColumn({ type: 'string', id: 'Process' });
        dataTable.addColumn({ type: 'string', id: 'dummy bar label' });
        dataTable.addColumn({ type: 'date', id: 'Start' });
        dataTable.addColumn({ type: 'date', id: 'End' });

        let currentTime = 0;
        let rows = [];

        output.schedule.forEach(([process, duration]) => {
            let start = new Date(0, 0, 0, 0, 0, currentTime);
            let end = new Date(0, 0, 0, 0, 0, currentTime + duration);
            let processName = process === -1 ? 'Idle' : 
                            process === -2 ? 'CS' : 
                            'P' + process;
            rows.push([processName, '', start, end]);
            currentTime += duration;
        });

        dataTable.addRows(rows);
        chart.draw(dataTable);
    }
}

function showFinalTable(input, output, outputDiv) {
    let table = document.createElement("table");
    table.className = "result-table";
    table.innerHTML = `
        <tr>
            <th>Process</th>
            <th>Arrival Time</th>
            <th>Burst Time</th>
            <th>Completion Time</th>
            <th>Turnaround Time</th>
            <th>Waiting Time</th>
            <th>Response Time</th>
        </tr>
    `;
    
    for (let i = 0; i < input.processId.length; i++) {
        table.innerHTML += `
            <tr>
                <td>P${input.processId[i] + 1}</td>
                <td>${input.arrivalTime[i]}</td>
                <td>${input.burstTime[i]}</td>
                <td>${output.completionTime[i]}</td>
                <td>${output.turnAroundTime[i]}</td>
                <td>${output.waitingTime[i]}</td>
                <td>${output.responseTime[i]}</td>
            </tr>
        `;
    }
    
    table.innerHTML += `
        <tr class="average-row">
            <td colspan="3">Average</td>
            <td>${output.averageTimes[0].toFixed(2)}</td>
            <td>${output.averageTimes[1].toFixed(2)}</td>
            <td>${output.averageTimes[2].toFixed(2)}</td>
            <td>${output.averageTimes[3].toFixed(2)}</td>
        </tr>
    `;
    
    outputDiv.appendChild(table);
}

function showOutput(input, output, outputDiv) {
    showGanttChart(output, outputDiv);
    outputDiv.insertAdjacentHTML("beforeend", "<hr>");
    showFinalTable(input, output, outputDiv);
    // Store data for AI review but don't show it yet
    window.schedulingData = {
        input: input,
        output: output
    };
    document.getElementById("ai-review-btn").style.display = "inline-block";
}

// Input handling
function inputOnChange() {
    let inputs = document.querySelectorAll("input");
    inputs.forEach(input => {
        input.addEventListener("change", () => {
            let val = input.value;
            let isInt = Number.isInteger(Number(val));
            
            if (input.parentElement.className.includes("arrival-time")) {
                if (!isInt || val === "") {
                    input.value = 0;
                }
            } else {
                if (!isInt || val < 1 || val === "") {
                    input.value = 1;
                }
            }
        });
    });
}

function addProcess() {
    process++;
    let rowHTML1 = `
        <td class="process-id" rowspan="2">P${process}</td>
        <td class="arrival-time" rowspan="2"><input type="number" min="0" step="1" value="0"></td>
        <td class="process-time cpu process-heading" colspan="">CPU</td>
        <td class="process-btn"><button type="button" class="add-process-btn">+</button></td>
        <td class="process-btn"><button type="button" class="remove-process-btn">-</button></td>
    `;
    let rowHTML2 = `
        <td class="process-time cpu process-input"><input type="number" min="1" step="1" value="1"></td>
    `;
    let table = document.querySelector(".main-table tbody");
    table.insertRow(table.rows.length).innerHTML = rowHTML1;
    table.insertRow(table.rows.length).innerHTML = rowHTML2;
    inputOnChange();
}

function deleteProcess() {
    if (process > 1) {
        let table = document.querySelector(".main-table tbody");
        table.deleteRow(table.rows.length - 1);
        table.deleteRow(table.rows.length - 1);
        process--;
    }
}

// Main calculation function
function calculateOutput() {
    let outputDiv = document.getElementById("output");
    outputDiv.innerHTML = "";
    let input = new Input();
    let output = new Output();
    
    // Get context switch time
    input.contextSwitch = Number(document.getElementById("context-switch").value);
    
    // Get process data
    for (let i = 1; i <= process; i++) {
        let arrivalRow = document.querySelector(`.main-table tr:nth-child(${2*i-1})`);
        let burstRow = document.querySelector(`.main-table tr:nth-child(${2*i})`);
        
        input.processId.push(i - 1);
        input.arrivalTime.push(Number(arrivalRow.cells[1].firstElementChild.value));
        input.burstTime.push(Number(burstRow.cells[0].firstElementChild.value));
    }
    
    // Run scheduler and show output
    srtfScheduler(input, output);
    showOutput(input, output, outputDiv);
}

// Event listeners
document.getElementById("calculate").onclick = calculateOutput;

document.getElementById("ai-review-btn").onclick = () => {
    if (window.schedulingData) {
        analyzeResults(window.schedulingData.input, window.schedulingData.output);
        document.getElementById("ai-review-output").style.display = "block";
    }
};
