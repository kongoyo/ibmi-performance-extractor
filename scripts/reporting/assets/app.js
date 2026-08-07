// Track currently selected time for each metric card
        const currentTimes = {};
        metricsConfig.forEach(cfg => {
            let absMax = -1;
            let absTime = "00:00";
            dates.forEach(d => {
                const arr = rawData[d][cfg.key] || [];
                if (arr.length > 0) {
                    const maxVal = Math.max(...arr);
                    if (maxVal > absMax) {
                        absMax = maxVal;
                        const idx = arr.indexOf(maxVal);
                        absTime = times[idx] || "00:00";
                    }
                }
            });
            currentTimes[cfg.key] = absTime;
        });

        // Hover trigger logic
        const chartElements = document.querySelectorAll('canvas');
        chartElements.forEach(canvas => {
            canvas.addEventListener('mousemove', (e) => {
                const chart = Chart.getChart(canvas);
                if (!chart) return;
                
                const points = chart.getElementsAtEventForMode(e, 'index', { intersect: false }, true);
                if (points.length) {
                    const firstPoint = points[0];
                    const absTime = chart.data.labels[firstPoint.index];
                    const metricKey = chart.canvas.id.replace('chart-', '').replace('cpu-', '').replace('fault', 'usr').replace('disk', 'dsk');
                    const cfgKey = metricKey.charAt(0).toUpperCase() + metricKey.slice(1);
                    
                    dates.forEach((d, idx) => {
                        const pt = points.find(p => p.datasetIndex === idx);
                        if (pt) {
                            const btn = document.getElementById(`${chart.canvas.id}-btn-${idx}`);
                            if (btn && btn.classList.contains('active')) {
                                updateJobsList(cfgKey, d, absTime);
                            }
                        }
                    });
                    currentTimes[cfgKey] = absTime;
                }
            });
        });

        // Global switch tab helper (manual click)
        function switchTab(evt, tabId, date, metricKey) {
            const cardElement = evt.currentTarget.closest('.jobs-panel');
            
            const contents = cardElement.querySelectorAll('.tab-content');
            contents.forEach(c => c.style.display = 'none');
            
            const buttons = cardElement.querySelectorAll('.tab-btn');
            buttons.forEach(b => b.classList.remove('active'));
            
            document.getElementById(tabId).style.display = 'block';
            evt.currentTarget.classList.add('active');
            
            const currentTime = currentTimes[metricKey];
            updateJobsList(metricKey, date, currentTime);
        }

        // Dynamic jobs list renderer
        function updateJobsList(metricKey, date, time) {
            currentTimes[metricKey] = time; 
            
            const dateJobs = peakJobsByDate[date];
            if (!dateJobs || !dateJobs[metricKey]) return;
            
            const timeJobs = dateJobs[metricKey][time] || [];
            
            const headers = {
                "Rsp": { valHeader: "回應時間", lastHeader: "交易次數", valUnit: "秒", lastUnit: "次" },
                "Count": { valHeader: "交易次數", lastHeader: "平均回應時間", valUnit: "次", lastUnit: "秒" },
                "Dsk": { valHeader: "I/O 次數", lastHeader: "CPU 耗時", valUnit: "次", lastUnit: "ms" },
                "Usr": { valHeader: "分頁缺失", lastHeader: "CPU 耗時", valUnit: "次", lastUnit: "ms" },
                "Tot": { valHeader: "CPU 耗時", lastHeader: "總 I/O 次數", valUnit: "ms", lastUnit: "次" },
                "Int": { valHeader: "CPU 耗時", lastHeader: "交易回應時間", valUnit: "ms", lastUnit: "秒" },
                "Bch": { valHeader: "CPU 耗時", lastHeader: "實體 I/O 次數", valUnit: "ms", lastUnit: "次" }
            };
            const cfg = headers[metricKey] || headers["Tot"];

            let jobRows = "";
            if (timeJobs.length === 0) {
                jobRows = `<tr><td colspan='5' style='text-align: center; color: var(--text-secondary); padding: 1rem;'>該時段 (${time}) 無 Job 負載數據</td></tr>`;
            } else {
                timeJobs.forEach((j, rank) => {
                    let val1_formatted = "N/A";
                    let val2_formatted = "N/A";
                    
                    if (j.val1 !== null && j.val1 !== undefined) {
                        if (metricKey === "Rsp") {
                            val1_formatted = parseFloat(j.val1).toFixed(2);
                        } else {
                            val1_formatted = parseInt(j.val1).toLocaleString();
                        }
                    }
                    
                    if (j.val2 !== null && j.val2 !== undefined) {
                        if (metricKey === "Count" || (metricKey === "Int" && j.val2 < 100)) {
                            val2_formatted = parseFloat(j.val2).toFixed(2);
                        } else {
                            val2_formatted = parseInt(j.val2).toLocaleString();
                        }
                    }

                    let isSuspect = false;
                    let suspectReason = "";
                    if (metricKey === "Rsp" && j.val1 !== null && parseFloat(j.val1) >= 5.0) {
                        isSuspect = true;
                        suspectReason = "異常高延遲 (>=5秒)";
                    } else if (metricKey === "Count" && j.val1 !== null && parseFloat(j.val1) >= 50000) {
                        isSuspect = true;
                        suspectReason = "異常高頻呼叫";
                    } else if ((metricKey === "Tot" || metricKey === "Int" || metricKey === "Bch") && j.val1 !== null && parseFloat(j.val1) >= 10000) {
                        isSuspect = true;
                        suspectReason = "高 CPU 佔用";
                    } else if (metricKey === "Usr" && j.val1 !== null && parseFloat(j.val1) >= 10000) {
                        isSuspect = true;
                        suspectReason = "極高分頁缺失";
                    } else if (metricKey === "Dsk" && j.val1 !== null && parseFloat(j.val1) >= 50000) {
                        isSuspect = true;
                        suspectReason = "密集磁碟 I/O";
                    }
                    
                    const rowStyle = isSuspect ? "background: rgba(244, 63, 94, 0.15); border-left: 2px solid #f43f5e;" : "border-left: 2px solid transparent;";
                    const warningIcon = isSuspect ? `<span title="${suspectReason}" style="color: #f43f5e; margin-left: 6px; font-size: 0.9rem; cursor: help;">⚠️</span>` : "";

                    jobRows += `
                    <tr style="${rowStyle}">
                        <td style="padding: 0.4rem 0.5rem; color: var(--text-secondary); font-size: 0.85rem;">#${rank + 1}</td>
                        <td style="padding: 0.4rem 0.5rem; font-family: monospace; font-weight: 600; color: var(--text-primary);">${j.job_name}${warningIcon}</td>
                        <td style="padding: 0.4rem 0.5rem; color: var(--text-secondary);">${j.user_name}</td>
                        <td style="padding: 0.4rem 0.5rem; text-align: right; color: var(--accent-blue); font-weight: 500;">${val1_formatted} ${cfg.valUnit}</td>
                        <td style="padding: 0.4rem 0.5rem; text-align: right; color: var(--accent-purple);">${val2_formatted} ${cfg.lastUnit}</td>
                    </tr>
                    `;
                });
            }

            const dateIdx = dates.indexOf(date);
            const cardId = `chart-${metricKey.toLowerCase() === 'usr' ? 'fault' : metricKey.toLowerCase() === 'tot' ? 'cpu-tot' : metricKey.toLowerCase() === 'int' ? 'cpu-int' : metricKey.toLowerCase() === 'bch' ? 'cpu-bch' : metricKey.toLowerCase() === 'dsk' ? 'disk' : metricKey.toLowerCase()}`;
            
            const tbody = document.getElementById(`${cardId}-tbody-${dateIdx}`);
            if (tbody) tbody.innerHTML = jobRows;
            
            const timeSpan = document.getElementById(`${cardId}-time-${dateIdx}`);
            if (timeSpan) timeSpan.textContent = time;
        }

        // Hover event programmatically switch tab and update data
        function triggerTabSwitch(metricKey, date, time) {
            const dateIdx = dates.indexOf(date);
            const cardId = `chart-${metricKey.toLowerCase() === 'usr' ? 'fault' : metricKey.toLowerCase() === 'tot' ? 'cpu-tot' : metricKey.toLowerCase() === 'int' ? 'cpu-int' : metricKey.toLowerCase() === 'bch' ? 'cpu-bch' : metricKey.toLowerCase() === 'dsk' ? 'disk' : metricKey.toLowerCase()}`;
            const btn = document.getElementById(`${cardId}-btn-${dateIdx}`);
            
            if (btn && !btn.classList.contains('active')) {
                const panel = btn.closest('.jobs-panel');
                
                panel.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                panel.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
                
                const content = document.getElementById(`${cardId}-tab-${dateIdx}`);
                if (content) content.style.display = 'block';
            }
            
            // Always update table contents for the active date tab
            updateJobsList(metricKey, date, time);
        }

        const colors = ['#38bdf8', '#c084fc', '#4ade80', '#fbbf24', '#f43f5e'];

        metricsConfig.forEach(cfg => {
            const ctx = document.getElementById(cfg.id).getContext('2d');
            
            const datasets = [];
            dates.forEach((d, idx) => {
                const color = colors[idx % colors.length];
                
                const grad = ctx.createLinearGradient(0, 0, 0, 300);
                grad.addColorStop(0, color + '30'); // 18% opacity
                grad.addColorStop(1, color + '00'); // transparent

                datasets.push({
                    label: `${d}`,
                    data: rawData[d][cfg.key],
                    borderColor: color,
                    backgroundColor: grad,
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3,
                    pointRadius: 1.5,
                    pointHoverRadius: 6
                });
            });

            const yScaleConfig = {
                grid: { color: 'rgba(255, 255, 255, 0.04)' },
                ticks: {
                    color: '#94a3b8',
                    font: { size: 11 }
                },
                beginAtZero: true
            };

            if (cfg.is_percent) {
                yScaleConfig.min = 0;
                yScaleConfig.max = 100;
            }

            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: times,
                    datasets: datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        mode: 'index',
                        intersect: false,
                    },
                    onHover: (event, elements, chart) => {
                        const nearest = chart.getElementsAtEventForMode(event, 'nearest', { intersect: false }, true);
                        if (nearest && nearest.length > 0) {
                            const index = nearest[0].index;
                            const datasetIndex = nearest[0].datasetIndex;
                            const date = dates[datasetIndex];
                            const time = times[index];
                            triggerTabSwitch(cfg.key, date, time);
                        }
                    },
                    plugins: {
                        legend: {
                            labels: {
                                color: '#94a3b8',
                                font: { family: 'Inter', size: 12 }
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(15, 23, 42, 0.95)',
                            titleColor: '#f8fafc',
                            bodyColor: '#cbd5e1',
                            borderColor: 'rgba(255, 255, 255, 0.08)',
                            borderWidth: 1,
                            padding: 12,
                            usePointStyle: true
                        }
                    },
                    scales: {
                        x: {
                            grid: { color: 'rgba(255, 255, 255, 0.04)' },
                            ticks: {
                                color: '#94a3b8',
                                font: { size: 10 },
                                maxTicksLimit: 24
                            }
                        },
                        y: yScaleConfig
                    }
                }
            });
        });