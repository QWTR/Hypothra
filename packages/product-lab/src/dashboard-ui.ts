export interface DashboardUI {
  busy(button: HTMLButtonElement | null, active: boolean, label?: string): void;
  navigate(index: number): void;
  connection(online: boolean): void;
  announce(text: string, error?: boolean): void;
}

/** Native, offline UI feedback shared by the serialized clients. No model work is simulated. */
export function dashboardUI(): DashboardUI {
  const originals = new WeakMap<HTMLButtonElement, string>();
  function busy(button: HTMLButtonElement | null, active: boolean, label = "Working…") {
    if (!button) return;
    if (active) {
      if (!originals.has(button)) originals.set(button, button.innerHTML);
      button.textContent = label; button.setAttribute("aria-busy", "true"); button.disabled = true;
    } else if (originals.has(button)) {
      button.innerHTML = originals.get(button)!; originals.delete(button);
      button.removeAttribute("aria-busy"); button.disabled = false;
    }
  }
  function navigate(index: number) {
    document.querySelectorAll<HTMLElement>("[data-panel]").forEach(panel => { panel.hidden = panel.dataset.panel !== String(index); });
    document.querySelectorAll<HTMLElement>(".step").forEach(button => { if (button.dataset.step === String(index)) button.setAttribute("aria-current", "step"); else button.removeAttribute("aria-current"); });
    const title = document.querySelector<HTMLElement>(`[data-panel="${index}"] h2`);
    const hint = document.getElementById("status");
    if (hint?.classList.contains("initial-ready")) hint.textContent = ["Review the brief. Edit anything AI misunderstood, then continue.", "An idea is optional. AI can propose the plan; you choose when it runs.", "Let interested visitors explore a local test app with dummy data.", "Follow the evidence, then choose what to improve next."][index] ?? "";
    if (title) { title.tabIndex = -1; title.focus({ preventScroll: true }); }
    const main = document.querySelector("main");
    if (main && window.scrollY > main.getBoundingClientRect().top + window.scrollY) window.scrollTo({ top: Math.max(0, main.getBoundingClientRect().top + window.scrollY - 110), behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }
  function connection(online: boolean) {
    document.body.dataset.offline = String(!online);
    const badge = document.getElementById("connection-status");
    if (badge) { badge.dataset.offline = String(!online); badge.textContent = online ? "Local workspace" : "Reconnecting…"; }
  }
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  function announce(text: string, error = false) {
    const toast = document.getElementById("feedback-toast");
    if (!toast) return;
    clearTimeout(toastTimer); toast.textContent = text; toast.dataset.error = String(error); toast.hidden = false;
    toastTimer = setTimeout(() => { toast.hidden = true; }, 5500);
  }
  document.addEventListener("click", event => { const target = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-next-step]"); if (target && !target.disabled) navigate(Number(target.dataset.nextStep)); });
  return { busy, navigate, connection, announce };
}
