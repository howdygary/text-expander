// Variables in action: each demo types a trigger into a text box and shows what the snippet turns
// into, using the date and time the page is read, in the formats Text Expander uses.
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
  const isodate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  // "before" is already in the box. For $|$, "rest" is the text after the cursor and "then" is
  // what you type there once the snippet expands.
  const scripts = {
    date: { before: "Due ", trigger: "!ddate", text: date },
    time: { before: "Called at ", trigger: "!ttime", text: time },
    datetime: { before: "Updated ", trigger: "!ddt", text: `${date} ${time}` },
    isodate: { before: "report-", trigger: "!isodate", text: isodate },
    longdate: { before: "", trigger: "!longdate", text: `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}` },
    clipboard: { before: "", trigger: "!link", copied: "contoso.com/q4-plan", text: "Here’s the link: contoso.com/q4-plan" },
    prompt: { before: "", trigger: "!hello", answer: "Elaine", text: "Hi Elaine, thanks for reaching out!" },
    cursor: { before: "", trigger: "!todo", text: "// TODO: ", rest: ` (${isodate})`, then: "call Elaine" },
  };

  const span = (className, text = "") => {
    const node = document.createElement("span");
    node.className = className;
    node.textContent = text;
    return node;
  };

  const demos = [...list.querySelectorAll(".demo[data-demo]")].map((el, index) => {
    const s = scripts[el.dataset.demo];
    const field = el.querySelector(".demo-field");

    // An invisible copy of the longest text keeps the box from changing size while it plays.
    const finished = s.before + s.text + (s.then || "") + (s.rest || "");
    const typing = s.before + s.trigger;
    const sizer = span("demo-sizer", finished.length >= typing.length ? finished : typing);
    sizer.setAttribute("aria-hidden", "true");
    field.prepend(sizer);

    field.setAttribute("aria-label",
      s.answer ? `Typing ${s.trigger} opens a small window that asks for Name. Entering ${s.answer} gives “${s.text}”`
      : s.copied ? `With ${s.copied} copied, typing ${s.trigger} gives “${s.text}”`
      : s.rest ? `Typing ${s.trigger} gives “${s.text}${s.rest}”, with the cursor after “${s.text.trim()}” so you can keep typing`
      : `Typing ${s.trigger}${s.before ? ` after “${s.before.trim()}”` : ""} gives “${s.before}${s.text}”`);

    return {
      el, s, field,
      live: el.querySelector(".demo-live"),
      url: el.querySelector(".demo-url-text"),
      keys: el.querySelector(".demo-keys"),
      ask: el.querySelector(".demo-ask"),
      answer: el.querySelector(".demo-answer"),
      ok: el.querySelector(".demo-ask-ok"),
      delay: (index % 2) * 900 + 150,
      visible: !("IntersectionObserver" in window),
    };
  });

  // The finished result, shown while the demos are paused.
  function settle(d) {
    const { s } = d;
    d.field.classList.remove("typing");
    d.live.classList.remove("clearing");
    d.url?.classList.remove("selected");
    d.keys?.classList.remove("on");
    d.ask?.classList.remove("open", "typing");
    d.live.replaceChildren(s.before + s.text, ...(s.rest ? [span("caret"), s.rest] : []));
  }

  // Each wait resolves to false once the demos are paused or restarted, which ends that round.
  let run = 0;
  const wait = (ms, id) => new Promise(done => setTimeout(() => done(id === run), ms));
  const vary = ms => ms * (0.7 + Math.random() * 0.6);

  async function type(node, text, id, ms = 95) {
    for (const ch of text) {
      if (!(await wait(vary(ms), id))) return false;
      node.textContent += ch;
    }
    return true;
  }

  async function play(d, id) {
    const { s, field, live } = d;

    live.classList.add("clearing");
    if (!(await wait(260, id))) return false;
    const typed = span("demo-typed");
    live.replaceChildren(s.before, typed, span("caret"));
    live.classList.remove("clearing");
    d.url?.classList.remove("selected");
    d.keys?.classList.remove("on");
    d.ok?.classList.remove("pressed");
    if (d.answer) d.answer.textContent = "";

    if (s.copied) {
      if (!(await wait(500, id))) return false;
      d.url.classList.add("selected");
      if (!(await wait(450, id))) return false;
      d.keys.classList.add("on");
      if (!(await wait(800, id))) return false;
    } else if (!(await wait(700, id))) return false;

    field.classList.add("typing");
    if (!(await type(typed, s.trigger, id))) return false;
    if (!(await wait(160, id))) return false;
    typed.classList.add("hit");

    if (s.answer) {
      // Text Expander asks first. The trigger stays in the box until you select OK.
      if (!(await wait(260, id))) return false;
      field.classList.remove("typing");
      d.ask.classList.add("open");
      if (!(await wait(500, id))) return false;
      d.ask.classList.add("typing");
      if (!(await type(d.answer, s.answer, id, 110))) return false;
      d.ask.classList.remove("typing");
      if (!(await wait(420, id))) return false;
      d.ok.classList.add("pressed");
      if (!(await wait(160, id))) return false;
      d.ask.classList.remove("open");
      if (!(await wait(280, id))) return false;
    } else if (!(await wait(220, id))) return false;

    // The trigger turns into the snippet, and the cursor goes to $|$ if there is one.
    const after = span("demo-after");
    live.replaceChildren(s.before, span("demo-new", s.text), after, span("caret"), ...(s.rest ? [span("demo-new", s.rest)] : []));
    field.classList.remove("typing");
    void live.offsetWidth;
    live.querySelectorAll(".demo-new").forEach(node => node.classList.add("settled"));

    if (s.then) {
      if (!(await wait(900, id))) return false;
      field.classList.add("typing");
      if (!(await type(after, s.then, id))) return false;
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

  // Demos play only while they're on screen.
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) demos.find(d => d.el === entry.target).visible = entry.isIntersecting;
    }, { threshold: 0.5 });
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

  // With reduced motion turned on in Windows, the demos wait for Play.
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  reduce.addEventListener?.("change", () => { if (reduce.matches) setPlaying(false); });
  toggle.addEventListener("click", () => setPlaying(!list.classList.contains("playing")));
  toggle.hidden = false;
  setPlaying(!reduce.matches);
})();
