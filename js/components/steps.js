// Tutorial step progressive disclosure

export function initSteps(container) {
  container.querySelectorAll('.steps-block').forEach(block => {
    const steps = block.querySelectorAll('.step');
    const progressBar = block.querySelector('.steps-progress-bar');
    const total = steps.length;
    let openCount = 0;

    steps.forEach(step => {
      const header = step.querySelector('.step-header');
      const body = step.querySelector('.step-body');
      const toggle = step.querySelector('.step-toggle');

      // Start collapsed
      body.style.maxHeight = '0';
      body.style.overflow = 'hidden';
      body.style.transition = 'max-height 0.3s ease';

      header.addEventListener('click', () => {
        const isOpen = step.classList.contains('open');
        if (isOpen) {
          step.classList.remove('open');
          body.style.maxHeight = '0';
          toggle.textContent = '+';
          openCount = Math.max(0, openCount - 1);
        } else {
          step.classList.add('open');
          body.style.maxHeight = body.scrollHeight + 'px';
          toggle.textContent = '−';
          openCount++;
        }
        if (progressBar) {
          progressBar.style.width = `${(openCount / total) * 100}%`;
        }
      });
    });
  });
}
