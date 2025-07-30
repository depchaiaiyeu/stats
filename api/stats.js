// api/stats.js
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  try {
    // Tăng counter tổng
    const totalRequests = await kv.incr('total_requests');
    
    // Lưu timestamp của request hiện tại
    const now = Date.now();
    const currentSecond = Math.floor(now / 1000);
    
    // Tăng counter cho giây hiện tại
    await kv.incr(`requests_${currentSecond}`);
    
    // Set expiry cho key này sau 24 giờ để tránh tích tụ quá nhiều keys
    await kv.expire(`requests_${currentSecond}`, 86400);
    
    // Kiểm tra nếu request muốn JSON data
    const acceptHeader = req.headers.accept || '';
    const isJsonRequest = acceptHeader.includes('application/json');
    
    if (isJsonRequest) {
      // Lấy dữ liệu cho 300 giây gần nhất (5 phút)
      const seriesData = [];
      const promises = [];
      
      for (let i = 0; i < 300; i++) {
        const time = (currentSecond - 299 + i) * 1000;
        const secondKey = Math.floor(time / 1000);
        promises.push(
          kv.get(`requests_${secondKey}`).then(count => [time, count || 0])
        );
      }
      
      const results = await Promise.all(promises);
      seriesData.push(...results);
      
      // Trả về JSON data
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.status(200).json({
        totalRequests: totalRequests,
        seriesData: seriesData
      });
    } else {
      // Trả về HTML page
      const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <title>DStats - Real-time Requests</title>
    <script src="https://code.highcharts.com/highcharts.js"></script>
    <style>
        body { margin: 0; padding: 20px; background: #1e1e1e; color: #fff; font-family: Arial, sans-serif; }
        .container { max-width: 1200px; margin: 0 auto; background: #2d2d2d; padding: 20px; border-radius: 8px; }
        h1 { text-align: center; margin-bottom: 20px; color: #00ff88; }
        #chart { height: 400px; margin: 20px 0; }
        #counter { text-align: center; font-size: 24px; color: #00ff88; margin-bottom: 10px; }
        .stats { display: flex; justify-content: space-around; margin: 20px 0; }
        .stat-box { background: #3d3d3d; padding: 15px; border-radius: 8px; text-align: center; }
        .stat-number { font-size: 28px; color: #00ff88; font-weight: bold; }
        .stat-label { font-size: 14px; color: #ccc; }
    </style>
</head>
<body>
    <div class="container">
        <h1>DStats - Real-time Requests Analytics</h1>
        <div id="counter">Total Requests: 0</div>
        <div class="stats">
            <div class="stat-box">
                <div class="stat-number" id="currentRate">0</div>
                <div class="stat-label">Requests/sec</div>
            </div>
            <div class="stat-box">
                <div class="stat-number" id="peakRate">0</div>
                <div class="stat-label">Peak Rate</div>
            </div>
            <div class="stat-box">
                <div class="stat-number" id="avgRate">0</div>
                <div class="stat-label">Avg Rate (5min)</div>
            </div>
        </div>
        <div id="chart"></div>
    </div>
    
    <script>
let chart;
let peakRate = 0;

function initChart() {
    chart = Highcharts.chart('chart', {
        chart: { 
            type: 'areaspline', 
            animation: { duration: 1000 },
            backgroundColor: '#2d2d2d'
        },
        title: { 
            text: 'Live Requests per Second (5 minute window)',
            style: { color: '#fff' }
        },
        xAxis: { 
            type: 'datetime', 
            labels: { 
                format: '{value:%H:%M:%S}',
                style: { color: '#ccc' }
            },
            gridLineColor: '#555',
            lineColor: '#555'
        },
        yAxis: { 
            title: { 
                text: 'Requests',
                style: { color: '#ccc' }
            }, 
            min: 0, 
            allowDecimals: false,
            labels: { style: { color: '#ccc' } },
            gridLineColor: '#555'
        },
        series: [{
            name: 'Requests per Second',
            color: '#00ff88',
            fillColor: {
                linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
                stops: [
                    [0, 'rgba(0, 255, 136, 0.8)'],
                    [1, 'rgba(0, 255, 136, 0.1)']
                ]
            },
            lineWidth: 3,
            data: [],
            marker: {
                enabled: true,
                radius: 2,
                fillColor: '#00ff88',
                lineColor: '#fff',
                lineWidth: 1
            }
        }],
        plotOptions: {
            areaspline: {
                states: { 
                    hover: { 
                        lineWidth: 4,
                        marker: { radius: 4 }
                    } 
                }
            }
        },
        legend: { 
            enabled: false 
        },
        tooltip: {
            backgroundColor: '#1e1e1e',
            borderColor: '#00ff88',
            style: { color: '#fff' },
            formatter: function() {
                return '<b>' + Highcharts.dateFormat('%H:%M:%S', this.x) + '</b><br/>' +
                       'Requests: <b>' + this.y + '</b>';
            }
        }
    });
}

async function updateChart() {
    try {
        const response = await fetch('/api/stats', {
            headers: { 'Accept': 'application/json' }
        });
        if (!response.ok) return;
        const data = await response.json();
        
        if (chart && data.seriesData) {
            chart.series[0].setData(data.seriesData, true, true, true);
            
            // Cập nhật counter
            document.getElementById('counter').textContent = 'Total Requests: ' + data.totalRequests.toLocaleString();
            
            // Tính toán stats
            const recentData = data.seriesData.slice(-10); // 10 giây gần nhất
            const currentRate = recentData.length > 0 ? recentData[recentData.length - 1][1] : 0;
            const maxRate = Math.max(...data.seriesData.map(item => item[1]));
            const avgRate = data.seriesData.length > 0 ? 
                (data.seriesData.reduce((sum, item) => sum + item[1], 0) / data.seriesData.length).toFixed(1) : 0;
            
            if (maxRate > peakRate) peakRate = maxRate;
            
            document.getElementById('currentRate').textContent = currentRate;
            document.getElementById('peakRate').textContent = peakRate;
            document.getElementById('avgRate').textContent = avgRate;
        }
    } catch (error) {
        console.error('Update failed:', error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initChart();
    updateChart();
    setInterval(updateChart, 1000);
});
    </script>
</body>
</html>`;
      
      res.setHeader('Content-Type', 'text/html');
      res.status(200).send(htmlContent);
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
