import { Redis } from '@upstash/redis';

let redis;

export default async function handler(req, res) {
  if (!redis) {
    redis = Redis.fromEnv();
  }
  
  await redis.incr('total');
  const count = await redis.get('total') || 0;
  
  const html = `<!DOCTYPE html>
<html>
<head>
<title>Stats</title>
<script src="https://code.highcharts.com/highcharts.js"></script>
<style>
body { margin: 0; padding: 20px; background: #1e1e1e; color: #fff; font-family: Arial, sans-serif; }
.container { max-width: 800px; margin: 0 auto; background: #2d2d2d; padding: 20px; border-radius: 8px; }
h1 { text-align: center; color: #00ff88; }
#counter { text-align: center; font-size: 32px; color: #00ff88; margin: 20px 0; }
#chart { height: 300px; margin: 20px 0; }
</style>
</head>
<body>
<div class="container">
<h1>Request Counter</h1>
<div id="counter">${count}</div>
<div id="chart"></div>
</div>
<script>
Highcharts.chart('chart', {
  chart: { type: 'column', backgroundColor: '#2d2d2d' },
  title: { text: 'Total Requests', style: { color: '#fff' } },
  xAxis: { categories: ['Requests'], labels: { style: { color: '#ccc' } } },
  yAxis: { title: { text: 'Count', style: { color: '#ccc' } }, labels: { style: { color: '#ccc' } } },
  series: [{ name: 'Count', data: [${count}], color: '#00ff88' }],
  legend: { enabled: false }
});
setInterval(() => location.reload(), 2000);
</script>
</body>
</html>`;
  
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
}
