// Variables in action: in each row, the trigger is typed into a text box and turns into what the snippet
// gives, using the date and time the page is read, in the formats Text Expander uses. Each row's snippet
// is read from the page: its trigger and replacement, plus data-copied, data-answer and data-then for the
// rows that copy a link, answer a question or keep typing at the cursor.
(() => {
  const list = document.querySelector(".vars");
  const toggle = document.querySelector(".vars-toggle");
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

// How it works, in action: the switch turns on, a snippet is added, and then its trigger is typed in an
// email and turns into the snippet's text. The step that's playing lights up.
(() => {
  const steps = document.querySelector(".how");
  const toggle = document.querySelector(".how-toggle");
  if (!steps || !toggle) return;

  const cards = [...steps.children];
  const sw = steps.querySelector(".mini-switch");
  const swText = steps.querySelector(".mini-switch-text");
  const [triggerBox, replBox] = steps.querySelectorAll(".mini-box");
  const trigger = steps.querySelector(".how-trigger");
  const repl = steps.querySelector(".how-repl");
  const save = steps.querySelector(".mini-btn.accent");
  const mailBody = steps.querySelector(".mini-mail-body");
  const live = steps.querySelector(".how-live");

  // The snippet comes from the page: its trigger, and its text with each <br> as a new line.
  const textOf = el => [...el.childNodes].map(n => (n.nodeName === "BR" ? "\n" : n.textContent)).join("");
  const TRIGGER = trigger.textContent;
  const TEXT = textOf(repl);

  const span = (className, textContent = "") => Object.assign(document.createElement("span"), { className, textContent });
  const light = n => cards.forEach((card, i) => card.classList.toggle("on", i === n - 1));
  const setSwitch = on => {
    sw.classList.toggle("on", on);
    swText.textContent = on ? "On" : "Off";
  };

  // Each wait resolves to false once the animation is paused or restarted, which ends that round.
  let run = 0;
  let visible = !("IntersectionObserver" in window);
  const wait = (ms, id) => new Promise(done => setTimeout(() => done(id === run), ms));
  const vary = ms => ms * (0.7 + Math.random() * 0.6);
  async function type(add, text, id, ms) {
    for (const ch of text) {
      if (!(await wait(vary(ms), id))) return false;
      add(ch);
    }
    return true;
  }

  // How each step ends, shown while paused.
  function settle() {
    light(0);
    setSwitch(true);
    trigger.textContent = TRIGGER;
    repl.textContent = TEXT;
    [triggerBox, replBox, mailBody].forEach(box => box.classList.remove("focus", "typing"));
    save.classList.remove("pressed");
    live.replaceChildren(TEXT);
  }

  async function play(id) {
    // 1. Start with the switch off, then turn it on.
    light(1);
    setSwitch(false);
    trigger.textContent = "";
    repl.textContent = "";
    live.replaceChildren();
    if (!(await wait(900, id))) return false;
    setSwitch(true);
    if (!(await wait(1100, id))) return false;

    // 2. Type the trigger and the replacement, then save.
    light(2);
    triggerBox.classList.add("focus", "typing");
    if (!(await type(ch => (trigger.textContent += ch), TRIGGER, id, 110))) return false;
    triggerBox.classList.remove("focus", "typing");
    replBox.classList.add("focus", "typing");
    if (!(await wait(250, id))) return false;
    if (!(await type(ch => (repl.textContent += ch), TEXT, id, 70))) return false;
    replBox.classList.remove("typing");
    if (!(await wait(450, id))) return false;
    save.classList.add("pressed");
    if (!(await wait(180, id))) return false;
    save.classList.remove("pressed");
    replBox.classList.remove("focus");
    if (!(await wait(700, id))) return false;

    // 3. In an email, the trigger turns into the snippet's text.
    light(3);
    mailBody.classList.add("typing");
    const typed = span("demo-typed");
    live.replaceChildren(typed);
    if (!(await wait(400, id))) return false;
    if (!(await type(ch => (typed.textContent += ch), TRIGGER, id, 110))) return false;
    if (!(await wait(160, id))) return false;
    typed.classList.add("hit");
    if (!(await wait(240, id))) return false;
    const result = span("demo-new", TEXT);
    live.replaceChildren(result);
    mailBody.classList.remove("typing");
    void live.offsetWidth;
    result.classList.add("settled");
    return wait(3200, id);
  }

  async function loop(id) {
    while (id === run) {
      while (!visible) if (!(await wait(250, id))) return;
      if (!(await play(id))) return;
    }
  }

  // It plays only while it's on screen.
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }, { threshold: 0.3 }).observe(steps);
  }

  const label = toggle.querySelector(".demo-toggle-label");
  function setPlaying(on) {
    run += 1;
    steps.classList.toggle("playing", on);
    toggle.dataset.playing = String(on);
    label.textContent = on ? "Pause animation" : "Play animation";
    settle();
    if (on) loop(run);
  }

  // With reduced motion turned on in Windows, it waits for Play.
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  reduce.addEventListener?.("change", () => { if (reduce.matches) setPlaying(false); });
  toggle.addEventListener("click", () => setPlaying(!steps.classList.contains("playing")));
  toggle.hidden = false;
  setPlaying(!reduce.matches);
})();
