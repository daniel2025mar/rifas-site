/**
 * Gráfico de movimentação (vendas x reservas) — Chart.js
 */
const GraficoVendas = (() => {
  let chart = null;
  let keys = [];
  let onBarClick = null;

  function themeColors() {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
      text: dark ? '#e4e4e7' : '#3f3f46',
      grid: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
      sold: '#e11d2e',
      soldBg: 'rgba(225, 29, 46, 0.75)',
      reserved: '#d97706',
      reservedBg: 'rgba(217, 119, 6, 0.75)'
    };
  }

  function handleClick(event) {
    if (!chart || typeof onBarClick !== 'function') return;
    const points = chart.getElementsAtEventForMode(event, 'nearest', { intersect: true }, true);
    if (!points.length) return;
    const point = points[0];
    const index = point.index;
    const datasetIndex = point.datasetIndex;
    const key = keys[index];
    const label = chart.data.labels?.[index] || '';
    const value = Number(chart.data.datasets?.[datasetIndex]?.data?.[index]) || 0;
    if (!key || value <= 0) return;
    onBarClick({
      index,
      datasetIndex,
      key,
      label,
      value,
      kind: datasetIndex === 1 ? 'reservado' : 'vendido'
    });
  }

  function ensureChart(canvas) {
    if (!canvas || typeof Chart === 'undefined') return null;
    if (chart && chart.canvas === canvas) return chart;
    if (chart) {
      try { chart.destroy(); } catch { /* ignore */ }
      chart = null;
    }

    const colors = themeColors();
    chart = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Vendidos (qtd)',
            data: [],
            backgroundColor: colors.soldBg,
            borderColor: colors.sold,
            borderWidth: 1,
            borderRadius: 6,
            maxBarThickness: 28
          },
          {
            label: 'Reservados (qtd)',
            data: [],
            backgroundColor: colors.reservedBg,
            borderColor: colors.reserved,
            borderWidth: 1,
            borderRadius: 6,
            maxBarThickness: 28
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 350 },
        onHover(event, elements) {
          const el = event?.native?.target || event?.target;
          if (el && el.style) el.style.cursor = elements?.length ? 'pointer' : 'default';
        },
        onClick: handleClick,
        plugins: {
          legend: {
            position: 'top',
            align: 'end',
            labels: {
              boxWidth: 12,
              boxHeight: 12,
              usePointStyle: true,
              pointStyle: 'rectRounded',
              color: colors.text,
              font: { size: 12, weight: '600' }
            }
          },
          tooltip: {
            mode: 'nearest',
            intersect: true,
            callbacks: {
              afterBody() {
                return 'Clique para ver o resumo';
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: colors.text, font: { size: 11, weight: '600' } }
          },
          y: {
            beginAtZero: true,
            ticks: {
              color: colors.text,
              precision: 0,
              stepSize: 1,
              font: { size: 11 }
            },
            grid: { color: colors.grid }
          }
        }
      }
    });
    return chart;
  }

  function mount(canvas, opts = {}) {
    if (typeof opts.onBarClick === 'function') onBarClick = opts.onBarClick;
    return ensureChart(canvas);
  }

  function setOnBarClick(fn) {
    onBarClick = typeof fn === 'function' ? fn : null;
  }

  function update(data) {
    const canvas = document.getElementById('sales-chart');
    if (!canvas) return;
    const instance = ensureChart(canvas);
    if (!instance) return;

    keys = Array.isArray(data?.keys) ? data.keys.slice() : [];
    const colors = themeColors();
    instance.data.labels = data?.labels || [];
    instance.data.datasets[0].data = data?.vendidos || [];
    instance.data.datasets[1].data = data?.reservados || [];
    instance.data.datasets[0].backgroundColor = colors.soldBg;
    instance.data.datasets[0].borderColor = colors.sold;
    instance.data.datasets[1].backgroundColor = colors.reservedBg;
    instance.data.datasets[1].borderColor = colors.reserved;
    instance.options.plugins.legend.labels.color = colors.text;
    instance.options.scales.x.ticks.color = colors.text;
    instance.options.scales.y.ticks.color = colors.text;
    instance.options.scales.y.grid.color = colors.grid;
    instance.update('active');
  }

  function destroy() {
    if (!chart) return;
    try { chart.destroy(); } catch { /* ignore */ }
    chart = null;
    keys = [];
  }

  return { mount, update, destroy, setOnBarClick };
})();

window.GraficoVendas = GraficoVendas;
