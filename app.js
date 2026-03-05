(() => {
  const normalize = (s) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');

  const setFeedback = (el, ok, goodText = 'Correct', badText = 'Try again') => {
    if (!el) return;
    el.textContent = ok ? goodText : badText;
    el.classList.remove('good', 'bad');
    el.classList.add(ok ? 'good' : 'bad');
  };

  document.querySelectorAll('.diagram-wrap').forEach((wrap) => {
    const output = wrap.querySelector('.diagram-output');
    const svg = wrap.querySelector('svg');
    if (!svg) return;

    const nodes = [...wrap.querySelectorAll('.diag-node')];
    const edges = [...svg.querySelectorAll('.diag-edge[data-src][data-dst]')];
    const labels = [...svg.querySelectorAll('.diag-edge-label[data-src][data-dst]')];
    const state = new Map();

    const toNumber = (value, fallback = 0) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    };

    nodes.forEach((node) => {
      const id = node.getAttribute('data-node-id');
      if (!id) return;
      const x = toNumber(node.getAttribute('data-x'));
      const y = toNumber(node.getAttribute('data-y'));
      state.set(id, { node, x, y });
      node.setAttribute('transform', `translate(${x} ${y})`);
    });

    const center = (id) => {
      const info = state.get(id);
      if (!info) return null;
      return { x: info.x + 70, y: info.y + 22 };
    };

    const updateLine = (line) => {
      const src = line.getAttribute('data-src');
      const dst = line.getAttribute('data-dst');
      const a = center(src || '');
      const b = center(dst || '');
      if (!a || !b) return;
      line.setAttribute('x1', String(a.x));
      line.setAttribute('y1', String(a.y));
      line.setAttribute('x2', String(b.x));
      line.setAttribute('y2', String(b.y));
    };

    const updateLabel = (label) => {
      const src = label.getAttribute('data-src');
      const dst = label.getAttribute('data-dst');
      const a = center(src || '');
      const b = center(dst || '');
      if (!a || !b) return;
      const tx = Math.round((a.x + b.x) / 2);
      const ty = Math.round((a.y + b.y) / 2) - 6;
      label.setAttribute('x', String(tx));
      label.setAttribute('y', String(ty));
    };

    const refreshEdges = () => {
      edges.forEach(updateLine);
      labels.forEach(updateLabel);
    };

    refreshEdges();

    const activate = (node) => {
      nodes.forEach((n) => n.classList.remove('active'));
      node.classList.add('active');
      const detail = node.getAttribute('data-detail') || '';
      if (output) output.textContent = detail;
    };

    const getSvgPoint = (evt) => {
      const point = svg.createSVGPoint();
      point.x = evt.clientX;
      point.y = evt.clientY;
      const ctm = svg.getScreenCTM();
      if (!ctm) return { x: 0, y: 0 };
      return point.matrixTransform(ctm.inverse());
    };

    const vb = svg.viewBox.baseVal;
    const maxX = Math.max(0, vb.width - 150);
    const maxY = Math.max(0, vb.height - 54);

    let drag = null;
    let suppressClick = false;

    nodes.forEach((node) => {
      const nodeId = node.getAttribute('data-node-id');
      if (!nodeId) return;

      node.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        const info = state.get(nodeId);
        if (!info) return;
        const start = getSvgPoint(e);
        drag = {
          id: nodeId,
          startX: start.x,
          startY: start.y,
          nodeStartX: info.x,
          nodeStartY: info.y,
          moved: false,
        };
        node.classList.add('dragging');
        if (node.setPointerCapture) node.setPointerCapture(e.pointerId);
        e.preventDefault();
      });

      node.addEventListener('pointermove', (e) => {
        if (!drag || drag.id !== nodeId) return;
        const info = state.get(nodeId);
        if (!info) return;

        const cur = getSvgPoint(e);
        const dx = cur.x - drag.startX;
        const dy = cur.y - drag.startY;

        let nx = drag.nodeStartX + dx;
        let ny = drag.nodeStartY + dy;
        nx = Math.min(maxX, Math.max(10, nx));
        ny = Math.min(maxY, Math.max(10, ny));

        info.x = nx;
        info.y = ny;
        node.setAttribute('data-x', nx.toFixed(1));
        node.setAttribute('data-y', ny.toFixed(1));
        node.setAttribute('transform', `translate(${nx} ${ny})`);
        refreshEdges();

        if (Math.abs(dx) + Math.abs(dy) > 1.6) {
          drag.moved = true;
        }
      });

      const stopDrag = (e) => {
        if (!drag || drag.id !== nodeId) return;
        node.classList.remove('dragging');
        if (drag.moved) {
          suppressClick = true;
          if (output) output.textContent = 'Node moved. Rearrangement updates all connected edges.';
          setTimeout(() => {
            suppressClick = false;
          }, 0);
        }
        if (node.releasePointerCapture) {
          try {
            node.releasePointerCapture(e.pointerId);
          } catch (_) {}
        }
        drag = null;
      };

      node.addEventListener('pointerup', stopDrag);
      node.addEventListener('pointercancel', stopDrag);

      node.addEventListener('click', (e) => {
        if (suppressClick) {
          e.preventDefault();
          return;
        }
        activate(node);
      });

      node.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activate(node);
        }
      });
    });
  });

  document.querySelectorAll('.single-check').forEach((card) => {
    const feedback = card.querySelector('.feedback');
    const choices = card.querySelectorAll('.choice');
    choices.forEach((btn) => {
      btn.addEventListener('click', () => {
        const ok = btn.getAttribute('data-correct') === 'true';
        choices.forEach((c) => c.classList.remove('correct-picked', 'wrong-picked'));
        btn.classList.add(ok ? 'correct-picked' : 'wrong-picked');
        setFeedback(feedback, ok);
      });
    });
  });

  document.querySelectorAll('.multi-check').forEach((card) => {
    const btn = card.querySelector('.check-multi');
    const feedback = card.querySelector('.feedback');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const boxes = card.querySelectorAll('input[type="checkbox"]');
      let ok = true;
      boxes.forEach((b) => {
        const should = b.getAttribute('data-correct') === 'true';
        if (b.checked !== should) ok = false;
      });
      setFeedback(feedback, ok);
    });
  });

  document.querySelectorAll('.blank-check').forEach((card) => {
    const btn = card.querySelector('.check-blank');
    const input = card.querySelector('.blank-input');
    const feedback = card.querySelector('.feedback');
    if (!btn || !input) return;
    btn.addEventListener('click', () => {
      const expected = (input.getAttribute('data-answers') || '').split('|').map(normalize).filter(Boolean);
      const actual = normalize(input.value);
      setFeedback(feedback, expected.includes(actual));
    });
  });

  document.querySelectorAll('.sequence-task').forEach((task) => {
    const list = task.querySelector('.sequence-list');
    const check = task.querySelector('.check-sequence');
    const feedback = task.querySelector('.feedback');
    if (!list || !check) return;

    const renumber = () => {
      [...list.children].forEach((li, idx) => {
        const n = li.querySelector('.order-num');
        if (n) n.textContent = String(idx + 1);
      });
    };

    renumber();

    list.addEventListener('click', (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      const li = t.closest('li');
      if (!li) return;
      if (t.classList.contains('move-up')) {
        const prev = li.previousElementSibling;
        if (prev) list.insertBefore(li, prev);
        renumber();
      }
      if (t.classList.contains('move-down')) {
        const next = li.nextElementSibling;
        if (next) list.insertBefore(next, li);
        renumber();
      }
    });

    check.addEventListener('click', () => {
      const ok = [...list.children].every((li, idx) => Number(li.getAttribute('data-correct')) === idx + 1);
      setFeedback(feedback, ok);
    });
  });

  document.querySelectorAll('.drag-task').forEach((task) => {
    const pool = task.querySelector('.drag-pool');
    const zones = task.querySelectorAll('.drop-zone');
    const check = task.querySelector('.check-drag');
    const reset = task.querySelector('.reset-drag');
    const feedback = task.querySelector('.feedback');
    let dragged = null;

    task.querySelectorAll('.drag-item').forEach((item) => {
      item.addEventListener('dragstart', () => { dragged = item; });
      item.addEventListener('dragend', () => { dragged = null; });
    });

    const bindDrop = (target) => {
      target.addEventListener('dragover', (e) => e.preventDefault());
      target.addEventListener('drop', (e) => {
        e.preventDefault();
        if (dragged) target.appendChild(dragged);
      });
    };

    if (pool) bindDrop(pool);
    zones.forEach(bindDrop);

    if (reset && pool) {
      reset.addEventListener('click', () => {
        zones.forEach((z) => {
          [...z.querySelectorAll('.drag-item')].forEach((it) => pool.appendChild(it));
        });
        if (feedback) feedback.textContent = '';
      });
    }

    if (check) {
      check.addEventListener('click', () => {
        let ok = true;
        zones.forEach((z) => {
          const expected = (z.getAttribute('data-answers') || '').split('|').map(normalize).filter(Boolean).sort();
          const actual = [...z.querySelectorAll('.drag-item')].map((it) => normalize(it.getAttribute('data-value'))).sort();
          if (expected.join('||') !== actual.join('||')) ok = false;
        });
        if (pool && pool.querySelector('.drag-item')) ok = false;
        setFeedback(feedback, ok);
      });
    }
  });

  document.querySelectorAll('.stepper-task').forEach((task) => {
    const box = task.querySelector('.stepper-box');
    const count = task.querySelector('.stepper-count');
    const line = task.querySelector('.stepper-line');
    const next = task.querySelector('.step-next');
    const reset = task.querySelector('.step-reset');
    if (!box || !count || !line || !next || !reset) return;

    let steps = [];
    try {
      const raw = box.getAttribute('data-steps') || '[]';
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        steps = parsed.map((s) => String(s));
      }
    } catch (_) {}
    if (!steps.length) return;

    let idx = 0;
    const render = () => {
      count.textContent = `Step ${idx + 1} of ${steps.length}`;
      line.textContent = steps[idx];
      next.textContent = idx === steps.length - 1 ? 'Restart' : 'Next Step';
    };

    next.addEventListener('click', () => {
      idx = idx === steps.length - 1 ? 0 : idx + 1;
      render();
    });

    reset.addEventListener('click', () => {
      idx = 0;
      render();
    });

    render();
  });

  document.querySelectorAll('.workflow-task').forEach((task) => {
    const check = task.querySelector('.check-workflow');
    const feedback = task.querySelector('.feedback');
    if (!check) return;
    check.addEventListener('click', () => {
      let ok = true;
      task.querySelectorAll('.workflow-select').forEach((sel) => {
        const expected = normalize(sel.getAttribute('data-answer'));
        const actual = normalize(sel.value);
        if (expected !== actual) ok = false;
      });
      setFeedback(feedback, ok);
    });
  });

  document.querySelectorAll('.pseudo-task').forEach((task) => {
    const check = task.querySelector('.check-pseudo');
    const feedback = task.querySelector('.feedback');
    if (!check) return;
    check.addEventListener('click', () => {
      let ok = true;
      task.querySelectorAll('.pseudo-select').forEach((sel) => {
        const expected = normalize(sel.getAttribute('data-answer'));
        const actual = normalize(sel.value);
        if (expected !== actual) ok = false;
      });
      setFeedback(feedback, ok);
    });
  });
})();
