// Global variables
let processCount = 1;

// Initialize input fields
function initializeInputs() {
    const inputs = document.querySelectorAll('input[type="number"]');
    inputs.forEach(input => {
        input.addEventListener('change', function() {
            const value = parseInt(this.value);
            const min = parseInt(this.min);
            
            if (isNaN(value) || value < min) {
                this.value = min;
            }
        });
    });
}

// Process management functions
function addProcess() {
    processCount++;
    const newRow = document.createElement('tr');
    newRow.innerHTML = `
        <td class="process-id">P${processCount}</td>
        <td class="arrival-time"><input type="number" min="0" step="1" value="0"></td>
        <td class="burst-time"><input type="number" min="1" step="1" value="5"></td>
        <td class="actions">
            <button type="button" class="remove-process-btn">-</button>
        </td>
    `;
    document.querySelector('.main-table tbody').appendChild(newRow);
    initializeInputs();
}

function deleteProcess() {
    if (processCount > 1) {
        const rows = document.querySelectorAll('.main-table tbody tr');
        rows[rows.length - 1].remove();
        processCount--;
    }
}

// Event listeners
document.querySelector('.add-btn').addEventListener('click', addProcess);
document.querySelector('.remove-btn').addEventListener('click', deleteProcess);

// Data structures for scheduling
class Process {
    constructor(id, arrivalTime, burstTime) {
        this.id = id;
        this.arrivalTime = arrivalTime;
        this.burstTime = burstTime;
        this.remainingTime = burstTime;
        this.startTime = null;
        this.finishTime = null;
    }
}

class Scheduler {
    constructor(processes, timeQuantum, contextSwitchTime) {
        this.processes = processes;
        this.timeQuantum = timeQuantum;
        this.contextSwitchTime = contextSwitchTime;
        this.readyQueue = [];
        this.currentTime = 0;
        this.schedule = [];
        this.completedProcesses = [];
    }

    run() {
        // Sort processes by arrival time
        this.processes.sort((a, b) => a.arrivalTime - b.arrivalTime);
        
        while (this.processes.length > 0 || this.readyQueue.length > 0) {
            // Add arriving processes to ready queue
            while (this.processes.length > 0 && this.processes[0].arrivalTime <= this.currentTime) {
                this.readyQueue.push(this.processes.shift());
            }
            
            if (this.readyQueue.length > 0) {
                const currentProcess = this.readyQueue.shift();
                
                // Record start time if not set
                if (currentProcess.startTime === null) {
                    currentProcess.startTime = this.currentTime;
                }
                
                // Execute for time quantum or remaining time, whichever is smaller
                const executionTime = Math.min(currentProcess.remainingTime, this.timeQuantum);
                this.schedule.push({
                    process: currentProcess.id,
                    start: this.currentTime,
                    end: this.currentTime + executionTime
                });
                
                this.currentTime += executionTime;
                currentProcess.remainingTime -= executionTime;
                
                // Check if process completed
                if (currentProcess.remainingTime === 0) {
                    currentProcess.finishTime = this.currentTime;
                    this.completedProcesses.push(currentProcess);
                } else {
                    // Add context switch time if needed
                    if (this.contextSwitchTime > 0) {
                        this.schedule.push({
                            process: 'CS',
                            start: this.currentTime,
                            end: this.currentTime + this.contextSwitchTime
                        });
                        this.currentTime += this.contextSwitchTime;
                    }
                    
                    // Re-add to ready queue if not completed
                    this.readyQueue.push(currentProcess);
                }
            } else {
                // No processes ready, advance time
                this.currentTime++;
            }
        }
        
        return {
            schedule: this.schedule,
            processes: this.completedProcesses
        };
    }
}

// Visualization functions
function showGanttChart(scheduleData, outputDiv) {
    const ganttChartHeading = document.createElement("h3");
    ganttChartHeading.innerHTML = "Gantt Chart";
    outputDiv.appendChild(ganttChartHeading);
    
    const ganttChartData = [['Task', 'Start', 'End']];
    scheduleData.forEach(item => {
        ganttChartData.push([
            item.process === 'CS' ? 'Context Switch' : `P${item.process}`,
            new Date(0, 0, 0, 0, 0, item.start),
            new Date(0, 0, 0, 0, 0, item.end)
        ]);
    });
    
    const ganttChartDiv = document.createElement("div");
    ganttChartDiv.id = "gantt-chart";
    outputDiv.appendChild(ganttChartDiv);
    
    google.charts.load('current', {'packages':['timeline']});
    google.charts.setOnLoadCallback(() => {
        const container = document.getElementById('gantt-chart');
        const chart = new google.visualization.Timeline(container);
        const dataTable = new google.visualization.DataTable();
        
        dataTable.addColumn({ type: 'string', id: 'Process' });
        dataTable.addColumn({ type: 'date', id: 'Start' });
        dataTable.addColumn({ type: 'date', id: 'End' });
        dataTable.addRows(ganttChartData);
        
        const options = {
            timeline: { 
                showRowLabels: false,
                avoidOverlappingGridLines: false
            },
            colors: ['#4285F4', '#EA4335', '#FBBC05', '#34A853']
        };
        
        chart.draw(dataTable, options);
    });
}

function showResultsTable(processes, outputDiv) {
    const tableHeading = document.createElement("h3");
    tableHeading.innerHTML = "Process Metrics";
    outputDiv.appendChild(tableHeading);
    
    const table = document.createElement("table");
    table.classList.add("results-table");
    
    // Create table header
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    ['Process', 'Arrival', 'Burst', 'Completion', 'Turnaround', 'Waiting', 'Response'].forEach(text => {
        const th = document.createElement("th");
        th.textContent = text;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Create table body
    const tbody = document.createElement("tbody");
    
    let totalTurnaround = 0;
    let totalWaiting = 0;
    let totalResponse = 0;
    
    processes.forEach(proc => {
        const turnaround = proc.finishTime - proc.arrivalTime;
        const waiting = turnaround - proc.burstTime;
        const response = proc.startTime - proc.arrivalTime;
        
        totalTurnaround += turnaround;
        totalWaiting += waiting;
        totalResponse += response;
        
        const row = document.createElement("tr");
        [
            `P${proc.id}`,
            proc.arrivalTime,
            proc.burstTime,
            proc.finishTime,
            turnaround,
            waiting,
            response
        ].forEach(text => {
            const cell = document.createElement("td");
            cell.textContent = text;
            row.appendChild(cell);
        });
        tbody.appendChild(row);
    });
    
    table.appendChild(tbody);
    outputDiv.appendChild(table);
    
    // Add summary metrics
    const summary = document.createElement("div");
    summary.classList.add("summary-metrics");
    
    const avgTurnaround = (totalTurnaround / processes.length).toFixed(2);
    const avgWaiting = (totalWaiting / processes.length).toFixed(2);
    const avgResponse = (totalResponse / processes.length).toFixed(2);
    
    summary.innerHTML = `
        <h4>Summary Metrics</h4>
        <p>Average Turnaround Time: ${avgTurnaround}</p>
        <p>Average Waiting Time: ${avgWaiting}</p>
        <p>Average Response Time: ${avgResponse}</p>
    `;
    
    outputDiv.appendChild(summary);
}

// Main calculation function
function calculateOutput() {
    const outputDiv = document.getElementById("output");
    outputDiv.innerHTML = "";
    
    // Get input values
    const timeQuantum = parseInt(document.getElementById("tq").value) || 2;
    const contextSwitchTime = parseInt(document.getElementById("context-switch").value) || 0;
    
    // Get process data
    const processes = [];
    const rows = document.querySelectorAll('.main-table tbody tr');
    
    rows.forEach((row, index) => {
        const arrivalTime = parseInt(row.querySelector('.arrival-time input').value) || 0;
        const burstTime = parseInt(row.querySelector('.burst-time input').value) || 1;
        processes.push(new Process(index + 1, arrivalTime, burstTime));
    });
    
    // Run scheduler
    const scheduler = new Scheduler([...processes], timeQuantum, contextSwitchTime);
    const results = scheduler.run();
    
    // Display results
    showGanttChart(results.schedule, outputDiv);
    outputDiv.insertAdjacentHTML("beforeend", "<hr>");
    showResultsTable(results.processes, outputDiv);
    
    // Enable AI review button
    document.getElementById("ai-review-btn").style.display = "inline-block";
    window.schedulingResults = results;
}

// AI Review functionality
function analyzeResults() {
    const results = window.schedulingResults;
    if (!results) return;
    
    const aiOutput = document.getElementById("ai-review-output");
    aiOutput.style.display = "block";
    
    // Calculate metrics
    const totalTime = results.schedule[results.schedule.length - 1].end;
    const totalBurstTime = results.processes.reduce((sum, proc) => sum + proc.burstTime, 0);
    const cpuUtilization = (totalBurstTime / totalTime * 100).toFixed(2);
    const throughput = (results.processes.length / totalTime).toFixed(4);
    
    const turnaroundTimes = results.processes.map(p => p.finishTime - p.arrivalTime);
    const avgTurnaround = (turnaroundTimes.reduce((a, b) => a + b, 0) / turnaroundTimes.length).toFixed(2);
    
    const waitingTimes = results.processes.map(p => (p.finishTime - p.arrivalTime) - p.burstTime);
    const avgWaiting = (waitingTimes.reduce((a, b) => a + b, 0) / waitingTimes.length).toFixed(2);
    
    const contextSwitches = results.schedule.filter(item => item.process === 'CS').length;
    
    // Generate recommendations
    const timeQuantum = parseInt(document.getElementById("tq").value);
    const avgBurst = totalBurstTime / results.processes.length;
    
    let recommendation = '';
    if (contextSwitches > results.processes.length * 2) {
        recommendation = `Consider increasing time quantum from ${timeQuantum} to ${Math.ceil(avgBurst)} to reduce context switches (currently ${contextSwitches}).`;
    } else if (avgWaiting > avgBurst * 1.5) {
        recommendation = `Consider decreasing time quantum to improve waiting times (current avg: ${avgWaiting}).`;
    } else {
        recommendation = `Current time quantum of ${timeQuantum} seems well balanced for these processes.`;
    }
    
    aiOutput.innerHTML = `
        <h3>AI Analysis</h3>
        <div class="metrics">
            <p><strong>CPU Utilization:</strong> ${cpuUtilization}%</p>
            <p><strong>Throughput:</strong> ${throughput} processes/unit time</p>
            <p><strong>Average Turnaround Time:</strong> ${avgTurnaround}</p>
            <p><strong>Average Waiting Time:</strong> ${avgWaiting}</p>
            <p><strong>Context Switches:</strong> ${contextSwitches}</p>
        </div>
        <div class="recommendation">
            <h4>Recommendation</h4>
            <p>${recommendation}</p>
        </div>
    `;
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeInputs();
    document.getElementById("calculate").addEventListener("click", calculateOutput);
    document.getElementById("ai-review-btn").addEventListener("click", analyzeResults);
});