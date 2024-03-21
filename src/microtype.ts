import { hyphenateSync } from "hyphen/en";

type MicrotypeOptions = {
  selector: string;
  maxSpaceShrink: number;
  maxSpaceGrow: number;
  maxTrackingShrink: number;
  maxTrackingGrow: number;
  protrusion: { [key: string]: number };
  hyphenate: boolean;
  showFrame: boolean;
};

const defaultOptions: MicrotypeOptions = {
  selector: "p.microtype", // The CSS selector to perform formatting on
  maxSpaceShrink: 0.15, // How much space characters can shrink (em)
  maxSpaceGrow: 0.25, // How much space characters can grow (em)
  maxTrackingShrink: 0.01, // How much letter spacing can shrink (em)
  maxTrackingGrow: 0.01, // How much letter spacing can grow (em)
  protrusion: {
    // How much certain characters may protrude from the right margin (em)
    ",": 0.1,
    ".": 0.15,
    "!": 0.1,
    "-": 0.2,
  },
  hyphenate: true, // Whether or not words may hyphenate across lines
  showFrame: false, // Whether or not to show the target frame for formatted elements (for debugging)
};

function microtype({
  selector = defaultOptions.selector,
  maxSpaceShrink = defaultOptions.maxSpaceShrink,
  maxSpaceGrow = defaultOptions.maxSpaceGrow,
  maxTrackingShrink = defaultOptions.maxTrackingShrink,
  maxTrackingGrow = defaultOptions.maxTrackingGrow,
  protrusion = defaultOptions.protrusion,
  hyphenate = defaultOptions.hyphenate,
  showFrame = defaultOptions.showFrame,
}: MicrotypeOptions = defaultOptions) {
  // Initialise some meta info
  const t0 = Date.now();
  let counter = 0;
  console.log("microtype: initialising...");

  // Ensure created <span> elements do not inherit text-indent
  if (!document.querySelector("style[data-mt__style]")) {
    const styleEl = document.createElement("style");
    styleEl.dataset.mt__style = "true";
    document.head.appendChild(styleEl);

    const styleSheet = styleEl.sheet;
    if (styleSheet) {
      styleSheet.insertRule(
        `${selector} span { text-indent: 0!important; }`,
        0,
      );
      if (showFrame) {
        styleSheet.insertRule(`${selector} { outline: 1px solid red; }`, 0);
      }
    }
  }

  // Get the list of elements to format
  const paragraphs: NodeListOf<HTMLParagraphElement> =
    document.querySelectorAll(selector);

  for (const paragraph of paragraphs) {
    // Get paragraph text and empty the element of it's default contents
    let text = paragraph.innerText;
    paragraph.innerHTML = "";

    // If this paragraph has it's original contents saved, format that
    // Else save the current contents as original
    if (paragraph.dataset.mt__original) {
      text = paragraph.dataset.mt__original;
    } else {
      paragraph.dataset.mt__original = text;
    }

    // Keep track of how many paragraphs were formatted
    counter++;

    // Get px equivalent values for 1em and text indentation (if any)
    const em = parseFloat(getComputedStyle(paragraph).fontSize);
    const indent = parseFloat(getComputedStyle(paragraph).textIndent);

    // Ensure no default text wrapping
    paragraph.style.whiteSpace = "nowrap";

    // Keep track of which line we're working on and how long it is
    let currentLine = 0;
    let currentLineWidth = currentLine === 0 ? indent : 0;

    // Measure the current paragraph width
    let paragraphWidth = paragraph.offsetWidth;

    const words = text.split(" ");

    for (let i = 0; i < words.length; i++) {
      const word = words[i];

      // If the first line is indented, the target width is the element width less the indentation
      const targetWidth = paragraphWidth - (currentLine === 0 ? indent : 0);

      // Create (or get) the <span> element for the current line
      // The line will already have a <span> element if we wrapped a word from the previous line
      let lineEl: HTMLSpanElement | null;
      if ((currentLine === 0 && i === 0) || currentLineWidth === 0) {
        lineEl = document.createElement("span");
        lineEl.dataset.mt__li = currentLine.toString();
        paragraph.appendChild(lineEl);
      } else {
        lineEl = paragraph.querySelector(`span[data-mt__li="${currentLine}"]`);
      }

      if (!lineEl) {
        throw new Error(`microtype: line ${currentLine} does not exist`);
      }

      // Create the <span> element for the current word, fill it, and append it to the line
      const wordEl = document.createElement("span");
      wordEl.innerHTML = word;
      lineEl.appendChild(wordEl);

      // Update the current line width
      currentLineWidth += wordEl.offsetWidth;

      // If another word follows, create a <span> element for the space character, fill it, and append it
      let spaceEl;
      if (words[i + 1]) {
        spaceEl = document.createElement("span");

        spaceEl.innerHTML = "&nbsp;";
        lineEl.appendChild(spaceEl);

        spaceEl.dataset.mt__sp = "true";

        currentLineWidth += spaceEl.offsetWidth;
      }

      // If the current line is wider than the target, we have some formatting to do
      if (currentLineWidth >= targetWidth) {
        // How far beyond the limit does it extend?
        let widthOver = currentLineWidth - targetWidth;

        // First, try to hyphenate the protruding word
        let didHyphenate = false;

        if (hyphenate) {
          const hyphenChar = "-";
          const hyphenated = hyphenateSync(word, {
            hyphenChar,
          });

          const split = hyphenated.split(hyphenChar);

          // Calculate the best option: either leave the word as is, wrap the whole word, or hyphenate it
          // 'Best' is the closest to the target width (over or under)
          // N.B. There may be multiple ways to hyphenate a word
          let bestWidthDiff = widthOver;
          let bestSegments = [word];

          if (split.length > 1) {
            const widthWordRemoved = Math.abs(
              targetWidth - currentLineWidth - wordEl.offsetWidth,
            );
            if (widthWordRemoved < bestWidthDiff) {
              bestWidthDiff = widthWordRemoved;
              bestSegments = [];
            }

            const nOptions = split.length - 1;
            for (let j = 1; j <= nOptions; j++) {
              const head = split.slice(0, j);
              const tail = split.slice(j);

              wordEl.innerText = head.join("") + hyphenChar;

              const newWidth = lineEl.offsetWidth;
              const newDiff = Math.abs(newWidth - targetWidth);

              if (newDiff < bestWidthDiff) {
                bestWidthDiff = newDiff;
                bestSegments = [head.join(""), tail.join("")];
              }
            }

            const [head, tail] = bestSegments;

            // If the word is hyphenated, wrap the second segment to the next line
            // Create all of the relevant elements, append them, and reduce current line width by wrapped amount
            if (tail) {
              wordEl.innerText = head + hyphenChar;

              const trailingSpaceEl = lineEl.querySelector(
                'span[data-mt__sp="true"]:last-child',
              );
              if (trailingSpaceEl) trailingSpaceEl.remove();

              const nextLineEl = document.createElement("span");
              nextLineEl.dataset.mt__li = (currentLine + 1).toString();
              paragraph.appendChild(nextLineEl);

              const remainingWord = document.createElement("span");
              remainingWord.innerText = tail;
              nextLineEl.appendChild(remainingWord);

              const remainingWordSpaceEl = document.createElement("span");

              remainingWordSpaceEl.innerHTML = "&nbsp;";
              nextLineEl.appendChild(remainingWordSpaceEl);

              remainingWordSpaceEl.dataset.mt__sp = "true";

              const breakEl = document.createElement("br");
              lineEl.appendChild(breakEl);

              currentLineWidth -= nextLineEl.offsetWidth;

              didHyphenate = true;
            } else {
              // Word was not hyphenated, leave it as it was
              wordEl.innerText = word;
            }
          }
        }

        // If word was not hyphenated already, work out whether line would be closer to target width if entire word was wrapped
        // If so, remove it (and following space) and step index back so word is added again on next line
        if (!didHyphenate) {
          widthOver = currentLineWidth - targetWidth;
          const widthUnder = Math.abs(
            currentLineWidth - wordEl.offsetWidth - targetWidth,
          );

          if (widthOver > widthUnder) {
            wordEl.remove();
            if (spaceEl) spaceEl.remove();
            i--;
          }
        }

        // Remove any trailing space from the line
        const trailingSpaceEl = lineEl.querySelector(
          'span[data-mt__sp="true"]:last-child',
        );
        if (trailingSpaceEl) trailingSpaceEl.remove();

        // If word was not hyphenated, append a line break to current line and reset width to 0 for next line
        // Else find the following line (created during hyphenation) and update existing line width
        if (!didHyphenate) {
          const breakEl = document.createElement("br");
          lineEl.appendChild(breakEl);

          currentLineWidth = 0;
        } else {
          const existingNextLine: HTMLSpanElement | null =
            paragraph.querySelector(`span[data-mt__li="${currentLine + 1}"]`);

          currentLineWidth = existingNextLine?.offsetWidth ?? 0;
        }

        // Move on to next line
        currentLine++;
      }
    }

    // Re-measure current paragraph width
    paragraphWidth = paragraph.offsetWidth;

    // Get all of the now hyphenated & wrapped lines
    const lines: NodeListOf<HTMLSpanElement> =
      paragraph.querySelectorAll("span[data-mt__li]");

    // For each line, adjust inter-word and inter-letter spacing to get as close as possible to target width
    lines.forEach((lineEl, i) => {
      // No formatting required if this is the last line
      if (i === lines.length - 1) return;

      // Get the target width (accounting for indent if this is the first line) and the current width
      const targetWidth = paragraphWidth - (i === 0 ? indent : 0);
      let currentLineWidth = lineEl.offsetWidth;

      // Get the last word of the line and determine whether it ends in a protrude-able character
      const lastWordEl: HTMLSpanElement | null =
        lineEl.querySelector("span:last-of-type");
      const protrusionAmount = lastWordEl
        ? protrusion?.[lastWordEl.innerText[lastWordEl.innerText.length - 1]] ??
          0
        : 0;

      // The actual target width taking protrusion into account
      let adjustedTargetWidth = targetWidth + protrusionAmount * em;

      // Get all of the spaces in the line
      const spaces: NodeListOf<HTMLSpanElement> = lineEl.querySelectorAll(
        'span[data-mt__sp="true"]',
      );
      const defaultWidth = spaces[0].offsetWidth;

      // If the line is wider than the target, distribute the difference and shrink all spaces
      // If the target is wider than the line, distribute the difference and grow all spaces
      if (currentLineWidth > adjustedTargetWidth) {
        const toShrink =
          (currentLineWidth - adjustedTargetWidth) / spaces.length;
        spaces.forEach((spEl) => {
          spEl.style.display = "inline-block";
          spEl.style.width = `${defaultWidth - Math.min(toShrink, maxSpaceShrink * em)}px`;
        });
      } else if (currentLineWidth < adjustedTargetWidth) {
        const toGrow = (adjustedTargetWidth - currentLineWidth) / spaces.length;
        spaces.forEach((spEl) => {
          spEl.style.display = "inline-block";
          spEl.style.width = `${defaultWidth + Math.min(toGrow, maxSpaceGrow * em)}px`;
        });
      }

      // If target is still not met after adjusting spaces, adjust the letter spacing by the same principle
      adjustedTargetWidth = targetWidth + protrusionAmount * em;
      currentLineWidth = lineEl.offsetWidth;

      if (currentLineWidth > adjustedTargetWidth) {
        const diff = currentLineWidth - adjustedTargetWidth;
        const letterDiff = Math.min(
          diff / lineEl.innerText.length,
          maxTrackingShrink * em,
        );
        lineEl.style.letterSpacing = `-${letterDiff}px`;
      } else if (currentLineWidth < adjustedTargetWidth) {
        const diff = adjustedTargetWidth - currentLineWidth;
        const letterDiff = Math.min(
          diff / lineEl.innerText.length,
          maxTrackingGrow * em,
        );
        lineEl.style.letterSpacing = `${letterDiff}px`;
      }
    });
  }

  // Print some useful meta info
  console.log(
    `microtype: done. formatted ${counter} elements in ${Date.now() - t0}ms`,
  );
}

if (typeof window !== "undefined") {
  (window as any).microtype = microtype;
}

export default microtype;
