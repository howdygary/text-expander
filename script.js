// Variables in action: in each row, the trigger is typed into a text box and turns into what the snippet
// gives, using the date and time the page is read, in the formats Text Expander uses. Each row's snippet
// is read from the page: its trigger and replacement, plus data-copied, data-answer and data-then for the
// rows that copy a link, answer a question or keep typing at the cursor.
(() => {
  const list = document.querySelector(".vars");
  const toggle = document.querySelector(".demo-toggle");
  if (!list || !toggle) return;

  const now = new Date();
  const pad = n => String(n).padStart(2, "0");
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const date = `${pad(now.getMonth() + 1)}/${pad(now.getDate())}/${String(now.getFullYear()).slice(-2)}`;
  const time = `${pad(now.getHours() % 12 || 12)}:${pad(now.getMinutes())} ${now.getHours() < 12 ? "AM" : "PM"}`;
  const values = {
    "{{date}}": date,
    "{{time}}": time,
    "{{datetime}}": `${date} ${time}`,
    "{{isodate}}": `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    "{{date:dddd, MMMM d, yyyy}}": `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`,
  };
  const variable = /(\{\{[^}]*\}\}|\$\|\$)/;

  const span = (className, textContent = "") => Object.assign(document.createElement("span"), { className, textContent });

  const demos = [...list.querySelectorAll("[data-demo]")].map((el, index) => {
    const { copied, answer, then } = el.dataset;
    const ex = { trigger: el.querySelector("code.trig").textContent, copied, answer, then, question: "", text: "", rest: "" };

    // What the snippet types: the text before the cursor marker, and the text after it.
    let afterCursor = false;
    el.querySelector("code.repl").textContent.split(variable).forEach((part, i) => {
      let out = part;
      if (i % 2) {
        if (part === "$|$") {
          afterCursor = true;
          return;
        }
        if (part === "{{clipboard}}") out = copied;
        else if (part.startsWith("{{prompt:")) {
          ex.question = part.slice(9, -2);
          out = answer;
        } else out = values[part] ?? part;
      }
      if (afterCursor) ex.rest += out;
      else ex.text += out;
    });

    // An invisible copy of the longest text keeps the box from changing size while it plays.
    const field = el.querySelector(".demo-field");
    const finished = ex.text + (then || "") + ex.rest;
    const sizer = span("demo-sizer", finished.length >= ex.trigger.length ? finished : ex.trigger);
    sizer.setAttribute("aria-hidden", "true");
    field.prepend(sizer);
    field.setAttribute("aria-label",
      answer ? `Typing ${ex.trigger} opens a small window that asks for “${ex.question}”. Answering ${answer} gives “${ex.text}”.`
      : copied ? `With ${copied} copied, typing ${ex.trigger} gives “${ex.text}”.`
      : then ? `Typing ${ex.trigger} puts the cursor after “${ex.text.trim()}”, so typing “${then}” gives “${finished}”.`
      : `Typing ${ex.trigger} gives “${ex.text}”.`);

    return {
      el, ex, field,
      live: el.querySelector(".demo-live"),
      url: el.querySelector(".demo-url-text"),
      keys: el.querySelector(".demo-keys"),
      ask: el.querySelector(".demo-ask"),
      answerBox: el.querySelector(".demo-answer"),
      ok: el.querySelector(".demo-ask-ok"),
      delay: (index % 2) * 700 + 150,
      visible: !("IntersectionObserver" in window),
    };
  });

  // The finished result, shown while the demos are paused.
  function settle(d) {
    d.field.classList.remove("typing");
    d.live.classList.remove("clearing");
    d.url?.classList.remove("selected");
    d.keys?.classList.remove("on");
    d.ask?.classList.remove("open", "typing");
    d.ok?.classList.remove("pressed");
    d.live.replaceChildren(d.ex.text, ...(d.ex.then ? [span("caret"), d.ex.rest] : [d.ex.rest]));
  }

  // Each wait resolves to false once the demos are paused or restarted, which ends that round.
  let run = 0;
  const wait = (ms, id) => new Promise(done => setTimeout(() => done(id === run), ms));
  const vary = ms => ms * (0.7 + Math.random() * 0.6);

  async function type(add, text, id, ms = 95) {
    for (const ch of text) {
      if (!(await wait(vary(ms), id))) return false;
      add(ch);
    }
    return true;
  }

  async function play(d, id) {
    const { ex, field, live } = d;

    live.classList.add("clearing");
    if (!(await wait(260, id))) return false;
    const typed = span("demo-typed");
    live.replaceChildren(typed, span("caret"));
    live.classList.remove("clearing");
    d.url?.classList.remove("selected");
    d.keys?.classList.remove("on");
    d.ok?.classList.remove("pressed");
    if (d.answerBox) d.answerBox.textContent = "";

    if (ex.copied) {
      if (!(await wait(500, id))) return false;
      d.url.classList.add("selected");
      if (!(await wait(450, id))) return false;
      d.keys.classList.add("on");
      if (!(await wait(800, id))) return false;
    } else if (!(await wait(700, id))) return false;

    field.classList.add("typing");
    if (!(await type(ch => (typed.textContent += ch), ex.trigger, id))) return false;
    if (!(await wait(160, id))) return false;
    typed.classList.add("hit");

    if (ex.answer) {
      // Text Expander asks first. The trigger stays in the box until you select OK.
      if (!(await wait(260, id))) return false;
      field.classList.remove("typing");
      d.ask.classList.add("open");
      if (!(await wait(500, id))) return false;
      d.ask.classList.add("typing");
      if (!(await type(ch => (d.answerBox.textContent += ch), ex.answer, id, 110))) return false;
      d.ask.classList.remove("typing");
      if (!(await wait(420, id))) return false;
      d.ok.classList.add("pressed");
      if (!(await wait(160, id))) return false;
      d.ask.classList.remove("open");
      if (!(await wait(280, id))) return false;
    } else if (!(await wait(220, id))) return false;

    // The trigger turns into the snippet's text, and the cursor goes to $|$ if there is one.
    const after = span("demo-after");
    live.replaceChildren(span("demo-new", ex.text), after, span("caret"), ...(ex.rest ? [span("demo-new", ex.rest)] : []));
    field.classList.remove("typing");
    void live.offsetWidth;
    live.querySelectorAll(".demo-new").forEach(node => node.classList.add("settled"));

    if (ex.then) {
      if (!(await wait(900, id))) return false;
      field.classList.add("typing");
      if (!(await type(ch => (after.textContent += ch), ex.then, id))) return false;
      field.classList.remove("typing");
    }
    return wait(2600, id);
  }

  async function loop(d, id) {
    if (!(await wait(d.delay, id))) return;
    while (id === run) {
      while (!d.visible) if (!(await wait(250, id))) return;
      if (!(await play(d, id))) return;
    }
  }

  // Rows play only while they're on screen.
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) demos.find(d => d.el === entry.target).visible = entry.isIntersecting;
    }, { threshold: 0.4 });
    demos.forEach(d => observer.observe(d.el));
  }

  const label = toggle.querySelector(".demo-toggle-label");
  function setPlaying(on) {
    run += 1;
    list.classList.toggle("playing", on);
    toggle.dataset.playing = String(on);
    label.textContent = on ? "Pause animations" : "Play animations";
    demos.forEach(settle);
    if (on) demos.forEach(d => loop(d, run));
  }

  // With reduced motion turned on in Windows, the rows wait for Play.
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  reduce.addEventListener?.("change", () => { if (reduce.matches) setPlaying(false); });
  toggle.addEventListener("click", () => setPlaying(!list.classList.contains("playing")));
  toggle.hidden = false;
  setPlaying(!reduce.matches);
})();
